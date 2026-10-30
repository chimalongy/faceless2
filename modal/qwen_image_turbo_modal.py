import base64
import io
from pathlib import Path
import modal

APP_NAME = "qwen-image-21-turbo-t4"
MODEL_ID = "Qwen/Qwen-Image-2.1-Turbo"
MODEL_DIR = "/model-cache/Qwen-Image-2.1-Turbo"

app = modal.App(APP_NAME)
model_volume = modal.Volume.from_name("qwen-image-21-turbo-cache", create_if_missing=True)

# Container Image with PyTorch, Diffusers, and FastAPI
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install(
        "torch",
        "torchvision",
        "git+https://github.com/huggingface/diffusers.git",
        "transformers>=5.17.0",
        "accelerate",
        "huggingface_hub",
        "safetensors",
        "pillow",
        "fastapi[standard]",
    )
    .env({"HF_HOME": "/model-cache/hf-home"})
)


@app.function(
    image=image,
    volumes={"/model-cache": model_volume},
    timeout=3600,
)
def download_model():
    """Run once to cache the Turbo checkpoint in the persistent Modal Volume."""
    from huggingface_hub import snapshot_download

    Path(MODEL_DIR).mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=MODEL_ID,
        local_dir=MODEL_DIR,
    )
    model_volume.commit()
    return f"Cached {MODEL_ID} at {MODEL_DIR}"


@app.local_entrypoint()
def prepare_model():
    print(download_model.remote())


_pipe = None


def get_pipeline():
    global _pipe
    if _pipe is None:
        import torch
        from diffusers import DiffusionPipeline

        _pipe = DiffusionPipeline.from_pretrained(
            MODEL_DIR,
            dtype=torch.float16,
            local_files_only=True,
        )
        # Keeps the large transformer/text encoder off the T4 except while in use.
        _pipe.enable_sequential_cpu_offload()
        _pipe.set_progress_bar_config(disable=True)
    return _pipe


@app.function(
    image=image,
    gpu="T4",
    volumes={"/model-cache": model_volume},
    timeout=600,
    max_containers=1,
)
@modal.fastapi_endpoint(method="POST")
def generate(request: dict):
    """
    POST JSON endpoint compatible with Faceless 2.0 image-generator:
    Request: {
        "prompt": "...",
        "width": 1664,
        "height": 928,
        "num_inference_steps": 50,
        "seed": 42
    }
    Response: {
        "status": "success",
        "image_base64": "<base64 string>",
        "seed": 42,
        "width": 1344,
        "height": 768
    }
    """
    from fastapi import HTTPException
    import torch

    prompt = request.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")

    req_width = request.get("width", 1376)
    req_height = request.get("height", 768)
    req_seed = request.get("seed")
    num_inference_steps = request.get("num_inference_steps", None)

    import random
    if req_seed is None:
        seed = random.randint(1, 2147483647)
    else:
        try:
            seed = int(req_seed)
        except (TypeError, ValueError):
            seed = random.randint(1, 2147483647)

    # Coerce dimensions to integer
    try:
        req_width = int(req_width)
        req_height = int(req_height)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="width and height must be integers")

    # Strictly enforce 1376x768 for landscape and 768x1376 for portrait/shorts (multiple of 32, 1,056,768 px <= 1.1M)
    aspect = req_width / req_height if req_height > 0 else 1.0
    if aspect >= 1.0:
        w, h = 1376, 768
    else:
        w, h = 768, 1376

    pipe = get_pipeline()
    pipe_kwargs = {
        "prompt": prompt.strip(),
        "width": w,
        "height": h,
        "use_kv_cache": True,
        "generator": torch.Generator(device="cpu").manual_seed(seed),
    }

    if isinstance(num_inference_steps, int) and num_inference_steps > 0:
        pipe_kwargs["num_inference_steps"] = min(50, num_inference_steps)

    result = pipe(**pipe_kwargs).images[0]

    buffer = io.BytesIO()
    # Save as PNG or high quality WebP/JPEG
    result.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

    # Returns both status: "success" (expected by faceless2) and original metadata
    return {
        "status": "success",
        "image_base64": encoded,
        "model": MODEL_ID,
        "seed": seed,
        "width": w,
        "height": h,
    }


@app.function(
    image=image,
    volumes={"/model-cache": model_volume},
    timeout=60,
)
@modal.fastapi_endpoint(method="GET")
def health():
    """Health check endpoint for endpoint verification."""
    return {"status": "ok", "model": MODEL_ID}
