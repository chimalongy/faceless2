import json
import re
import time
from pathlib import Path

import modal


# ============================================================
# Modal configuration
# ============================================================

app = modal.App("qwen-image-2-1-pe-t2i-t4")

# Persistent Hugging Face cache across container restarts
hf_cache = modal.Volume.from_name(
    "qwen-pe-t2i-hf-cache",
    create_if_missing=True,
)


# ============================================================
# Container image
# ============================================================

image = (
    modal.Image.debian_slim(python_version="3.11")
    .uv_pip_install(
        "torch==2.10.0",
        "transformers==5.4.0",
        "tokenizers==0.22.1",
        "huggingface_hub==1.27.0",
        "accelerate==1.11.0",
        "bitsandbytes>=0.46.0",
        "pillow==11.1.0",
        "fastapi",
    )
)


# ============================================================
# Model configuration
# ============================================================

MODEL_ID = "Qwen/Qwen-Image-2.1-PE-T2I"

# Context limit for prompt input
MAX_INPUT_TOKENS = 8192

# Maximum generated tokens (accommodates Qwen's thinking tokens + rewritten prompt)
MAX_NEW_TOKENS = 4096

TEMPERATURE = 1.0
TOP_P = 0.95
TOP_K = 20
PRESENCE_PENALTY = 1.5


# ============================================================
# Helper functions
# ============================================================

def remove_thinking(text: str) -> str:
    """Remove Qwen's internal <think>...</think> block if present."""
    text = re.sub(
        r"<think>.*?</think>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if "</think>" in text:
        text = text.split("</think>", 1)[1]
    return text.strip()


def extract_json(text: str) -> dict:
    """Extract the JSON answer from the model output."""
    text = remove_thinking(text)

    # Remove markdown JSON fences
    text = re.sub(r"```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```\s*$", "", text, flags=re.IGNORECASE)
    text = text.strip()

    # Attempt 1: parse full text as JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Attempt 2: find first JSON object in text
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Model did not return valid JSON. Raw output:\n{text}")


# ============================================================
# Model service
# ============================================================

@app.cls(
    image=image,
    gpu="T4",
    volumes={
        "/root/.cache/huggingface": hf_cache,
    },
    timeout=900,
    scaledown_window=300,
)
class QwenPET2I:

    @modal.enter()
    def load_model(self):
        import torch
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            BitsAndBytesConfig,
        )
        from huggingface_hub import hf_hub_download

        print("=" * 60)
        print("Loading Qwen-Image-2.1-PE-T2I on Tesla T4")
        print("=" * 60)

        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is not available. The deployment requires a GPU.")

        gpu_name = torch.cuda.get_device_name(0)
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)

        print(f"GPU: {gpu_name} ({gpu_memory:.2f} GB)")
        print(f"Model: {MODEL_ID}")
        print("Quantization: 4-bit bitsandbytes (NF4)")
        print("Compute dtype: float16")

        # 1. Load tokenizer (NOT AutoProcessor - this is a causal LLM)
        print("Loading tokenizer...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL_ID,
            trust_remote_code=True,
        )

        # 2. Load official system prompt
        print("Loading official system prompt...")
        system_prompt_path = hf_hub_download(
            repo_id=MODEL_ID,
            filename="system_prompt.txt",
        )
        self.system_prompt = Path(system_prompt_path).read_text(encoding="utf-8").strip()

        # 3. 4-bit quantization config to fit comfortably in T4's 16 GB VRAM
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )

        # 4. Load CausalLM model
        print("Loading model weights into T4...")
        start = time.time()
        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            quantization_config=quantization_config,
            low_cpu_mem_usage=True,
            dtype=torch.float16,
            device_map="auto",
            attn_implementation="sdpa",
            trust_remote_code=True,
        ).eval()

        elapsed = time.time() - start
        print(f"Model loaded in {elapsed:.2f} seconds")
        print(f"Allocated VRAM: {torch.cuda.memory_allocated() / (1024 ** 3):.2f} GB")
        print(f"Reserved VRAM: {torch.cuda.memory_reserved() / (1024 ** 3):.2f} GB")
        print("=" * 60)
        print("Qwen PE-T2I READY")
        print("=" * 60)

    def _generate_sync(self, prompt: str) -> dict:
        import torch
        from transformers import LogitsProcessor, LogitsProcessorList

        if not prompt or not prompt.strip():
            raise ValueError("prompt is required")

        # Qwen's official presence penalty logits processor
        class PresencePenalty(LogitsProcessor):
            def __init__(self, penalty: float, prompt_len: int):
                self.penalty = penalty
                self.prompt_len = prompt_len

            def __call__(self, input_ids, scores):
                for batch_index in range(input_ids.shape[0]):
                    generated = input_ids[batch_index, self.prompt_len:]
                    if generated.numel():
                        scores[batch_index, generated.unique()] -= self.penalty
                return scores

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt},
        ]

        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=True,
        )

        inputs = self.tokenizer(text, return_tensors="pt").to(self.model.device)
        prompt_len = inputs["input_ids"].shape[1]

        logits_processors = LogitsProcessorList()
        if PRESENCE_PENALTY:
            logits_processors.append(PresencePenalty(PRESENCE_PENALTY, prompt_len))

        start = time.time()
        with torch.inference_mode():
            output = self.model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                do_sample=True,
                temperature=TEMPERATURE,
                top_p=TOP_P,
                top_k=TOP_K,
                logits_processor=logits_processors,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        generation_time = time.time() - start

        generated_tokens = output[0, prompt_len:]
        raw_output = self.tokenizer.decode(generated_tokens, skip_special_tokens=True)

        result = extract_json(raw_output)
        rewritten_prompt = result.get("rewritten_prompt", "")
        wh_ratio = result.get("wh_ratio", "")

        if not rewritten_prompt:
            raise ValueError("Model returned JSON but 'rewritten_prompt' was empty.")

        return {
            "success": True,
            "rewritten_prompt": rewritten_prompt,
            "wh_ratio": wh_ratio,
            "generation_time_seconds": round(generation_time, 2),
        }

    @modal.method()
    def generate(self, prompt: str) -> dict:
        return self._generate_sync(prompt)

    @modal.fastapi_endpoint(method="POST")
    def web(self, request: dict):
        prompt = request.get("prompt")
        if not prompt:
            return {"success": False, "error": "prompt is required"}
        try:
            return self._generate_sync(prompt)
        except Exception as e:
            return {"success": False, "error": str(e)}


# ============================================================
# Local test
# ============================================================

@app.local_entrypoint()
def main():
    print("Testing Qwen Image 2.1 PE-T2I on T4...")
    service = QwenPET2I()
    result = service.generate.remote(
        "An extreme close-up highlights the main character's feet resting near the vehicle's floor pedals, showcasing premium sneakers."
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
