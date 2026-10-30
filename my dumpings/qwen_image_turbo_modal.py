import base64
import io
from pathlib import Path

import modal

APP_NAME = "qwen-image-21-turbo-t4"
MODEL_ID = "Qwen/Qwen-Image-2.1-Turbo"
MODEL_DIR = "/model-cache/Qwen-Image-2.1-Turbo"

app = modal.App(APP_NAME)
model_volume = modal.Volume.from_name("qwen-image-21-turbo-cache", create_if_missing=True)

# The checkpoint is about 32 GB. Keep it in a Volume so cold starts do not
# download it again. T4 uses FP16 (it does not have native BF16 support).
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
    """POST JSON: {"prompt":"...", "width":512, "height":512, "seed":42}."""
    from fastapi import HTTPException
    import torch

    prompt = request.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")

    width = request.get("width", 512)
    height = request.get("height", 512)
    seed = request.get("seed", 42)

    for name, value in (("width", width), ("height", height)):
        if not isinstance(value, int) or value < 512 or value > 1536 or value % 32 != 0:
            raise HTTPException(
                status_code=400,
                detail=f"{name} must be a multiple of 32 between 512 and 1536",
            )
    if width * height > 1_100_000:
        raise HTTPException(
            status_code=400,
            detail="The image must contain no more than 1,100,000 pixels",
        )
    if not isinstance(seed, int):
        raise HTTPException(status_code=400, detail="seed must be an integer")

    pipe = get_pipeline()
    result = pipe(
        prompt=prompt,
        width=width,
        height=height,
        use_kv_cache=True,
        generator=torch.Generator(device="cpu").manual_seed(seed),
    ).images[0]

    buffer = io.BytesIO()
    result.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return {
        "model": MODEL_ID,
        "seed": seed,
        "width": width,
        "height": height,
        "image_base64": encoded,
    }
