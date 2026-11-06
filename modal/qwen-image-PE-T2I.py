import json
import os
import re

import modal


# ============================================================
# Modal App
# ============================================================

app = modal.App(
    "qwen-image-2-1-pe-t2i-cpu"
)


# ============================================================
# Model configuration
# ============================================================

MODEL_REPO = (
    "Moseyanling/"
    "Qwen-Image-2.1-PE-T2I-GGUF"
)

MODEL_FILENAME = (
    "Qwen-Image-2.1-PE-T2I.Q5_K_M.gguf"
)

SYSTEM_PROMPT_REPO = (
    "Qwen/Qwen-Image-2.1-PE-T2I"
)

SYSTEM_PROMPT_FILENAME = (
    "system_prompt.txt"
)


# ============================================================
# Persistent Modal Volume
# ============================================================

model_volume = modal.Volume.from_name(
    "qwen-pe-t2i-cache",
    create_if_missing=True,
)


# ============================================================
# Container
# ============================================================

image = (
    modal.Image.debian_slim(
        python_version="3.11"
    )
    .apt_install(
        "build-essential",
        "cmake",
        "git",
    )
    .pip_install(
        "huggingface_hub",
        "llama-cpp-python",
        "fastapi",
    )
)


# ============================================================
# Qwen PE-T2I Service
# ============================================================

@app.cls(
    image=image,

    # --------------------------------------------------------
    # CPU ONLY
    # --------------------------------------------------------
    cpu=16,

    # --------------------------------------------------------
    # 32 GB RAM
    # --------------------------------------------------------
    memory=32768,

    # --------------------------------------------------------
    # Persistent Hugging Face / model storage
    # --------------------------------------------------------
    volumes={
        "/models": model_volume,
    },

    # --------------------------------------------------------
    # Allow enough time for:
    # - container startup
    # - model download
    # - model loading
    # - CPU inference
    # --------------------------------------------------------
    timeout=900,

    # --------------------------------------------------------
    # Keep the loaded model alive for 5 minutes
    # --------------------------------------------------------
    scaledown_window=300,
)
class QwenPET2I:

    # ========================================================
    # MODEL INITIALIZATION
    # ========================================================

    @modal.enter()
    def load_model(self):

        from huggingface_hub import hf_hub_download
        from llama_cpp import Llama

        print()
        print("=" * 60)
        print("QWEN IMAGE 2.1 PE-T2I")
        print("=" * 60)
        print()
        print(f"Repository : {MODEL_REPO}")
        print(f"Model      : {MODEL_FILENAME}")
        print("Quant      : Q5_K_M")
        print("CPU        : 16 cores")
        print("RAM        : 32 GB")
        print("GPU        : None")
        print()

        # ====================================================
        # Download GGUF model
        # ====================================================

        print("Checking model cache...")

        self.model_path = hf_hub_download(
            repo_id=MODEL_REPO,
            filename=MODEL_FILENAME,
            cache_dir="/models",
        )

        print()
        print(
            f"Model path: {self.model_path}"
        )
        print()

        # ====================================================
        # Download official PE-T2I system prompt
        # ====================================================

        print(
            "Downloading official system prompt..."
        )

        self.system_prompt_path = hf_hub_download(
            repo_id=SYSTEM_PROMPT_REPO,
            filename=SYSTEM_PROMPT_FILENAME,
            cache_dir="/models",
        )

        with open(
            self.system_prompt_path,
            "r",
            encoding="utf-8",
        ) as f:

            self.system_prompt = f.read().strip()

        print()
        print("System prompt loaded.")
        print()

        # ====================================================
        # Load GGUF with llama.cpp
        # ====================================================

        print(
            "Loading Q5_K_M model into CPU memory..."
        )

        self.llm = Llama(
            model_path=self.model_path,

            # ------------------------------------------------
            # CPU ONLY
            # ------------------------------------------------
            n_gpu_layers=0,

            # ------------------------------------------------
            # CPU threads
            # ------------------------------------------------
            n_threads=16,

            n_threads_batch=16,

            # ------------------------------------------------
            # Context
            #
            # The official PE-T2I production configuration
            # allows long outputs. 24576 gives us comfortable
            # headroom for the prompt + thinking + output.
            # ------------------------------------------------
            n_ctx=24576,

            # ------------------------------------------------
            # Batch processing
            # ------------------------------------------------
            n_batch=512,

            # ------------------------------------------------
            # Memory mapping
            # ------------------------------------------------
            use_mmap=True,

            # Don't lock all pages into RAM.
            use_mlock=False,

            # ------------------------------------------------
            # Chat template
            # ------------------------------------------------
            chat_format=None,

            verbose=False,
        )

        print()
        print("=" * 60)
        print("QWEN PE-T2I READY")
        print("=" * 60)
        print()


    # ========================================================
    # POST /generate
    # ========================================================

    @modal.fastapi_endpoint(
        method="POST"
    )
    def generate(
        self,
        request: dict,
    ):

        # ====================================================
        # Validate request
        # ====================================================

        if not isinstance(request, dict):

            return {
                "success": False,
                "error": "Request body must be JSON.",
            }

        prompt = request.get(
            "prompt"
        )

        if not prompt:

            return {
                "success": False,
                "error": (
                    "Missing required field: 'prompt'"
                ),
            }

        if not isinstance(
            prompt,
            str
        ):

            return {
                "success": False,
                "error": (
                    "'prompt' must be a string"
                ),
            }


        # ====================================================
        # Log request
        # ====================================================

        print()
        print("=" * 60)
        print("NEW PE-T2I REQUEST")
        print("=" * 60)
        print()
        print(prompt)
        print()


        # ====================================================
        # Build conversation
        # ====================================================

        messages = [
            {
                "role": "system",
                "content": self.system_prompt,
            },
            {
                "role": "user",
                "content": prompt,
            },
        ]


        # ====================================================
        # Generate
        # ====================================================

        print(
            "Generating rewritten prompt..."
        )

        result = self.llm.create_chat_completion(
            messages=messages,

            # ------------------------------------------------
            # Official PE-T2I T2I settings
            # ------------------------------------------------
            temperature=1.0,

            top_p=0.95,

            top_k=20,

            presence_penalty=1.5,

            max_tokens=16256,

            # ------------------------------------------------
            # Ask llama.cpp to return the expected JSON
            # structure.
            #
            # This helps prevent extra text around the result.
            # ------------------------------------------------
            response_format={
                "type": "json_object"
            },
        )


        # ====================================================
        # Extract response
        # ====================================================

        choice = result.get(
            "choices",
            [{}]
        )[0]

        message = choice.get(
            "message",
            {}
        )

        generated_text = message.get(
            "content",
            ""
        )

        if generated_text is None:

            generated_text = ""

        generated_text = generated_text.strip()


        # ====================================================
        # Log raw result
        # ====================================================

        print()
        print("=" * 60)
        print("RAW PE-T2I OUTPUT")
        print("=" * 60)
        print()
        print(generated_text)
        print()


        # ====================================================
        # Remove thinking block if present
        # ====================================================

        generated_text = (
            self.remove_thinking(
                generated_text
            )
        )


        # ====================================================
        # Clean markdown JSON fences
        # ====================================================

        generated_text = (
            self.clean_json(
                generated_text
            )
        )


        # ====================================================
        # Parse JSON
        # ====================================================

        try:

            parsed = json.loads(
                generated_text
            )

        except json.JSONDecodeError:

            # ------------------------------------------------
            # Last attempt:
            # Find the first JSON object in the response.
            # ------------------------------------------------

            json_match = re.search(
                r"\{.*\}",
                generated_text,
                re.DOTALL,
            )

            if json_match:

                try:

                    parsed = json.loads(
                        json_match.group(0)
                    )

                except json.JSONDecodeError:

                    return {
                        "success": False,
                        "error": (
                            "PE-T2I returned "
                            "invalid JSON."
                        ),
                        "raw_output": (
                            generated_text
                        ),
                    }

            else:

                return {
                    "success": False,
                    "error": (
                        "PE-T2I returned "
                        "invalid JSON."
                    ),
                    "raw_output": (
                        generated_text
                    ),
                }


        # ====================================================
        # Extract expected fields
        # ====================================================

        rewritten_prompt = parsed.get(
            "rewritten_prompt"
        )

        wh_ratio = parsed.get(
            "wh_ratio"
        )


        # ====================================================
        # Validate rewritten prompt
        # ====================================================

        if not rewritten_prompt:

            return {
                "success": False,

                "error": (
                    "PE-T2I response did not "
                    "contain 'rewritten_prompt'."
                ),

                "raw_output": generated_text,
            }


        # ====================================================
        # Build response
        # ====================================================

        response = {
            "success": True,

            "rewritten_prompt": (
                rewritten_prompt
            ),

            "wh_ratio": (
                wh_ratio
                if wh_ratio
                else "16:9"
            ),
        }


        # ====================================================
        # Log final result
        # ====================================================

        print()
        print("=" * 60)
        print("PE-T2I RESULT")
        print("=" * 60)
        print()

        print(
            json.dumps(
                response,
                indent=2,
                ensure_ascii=False,
            )
        )

        print()


        return response


    # ========================================================
    # Remove <think>...</think>
    # ========================================================

    @staticmethod
    def remove_thinking(
        text: str
    ) -> str:

        # ----------------------------------------------------
        # Complete thinking block
        # ----------------------------------------------------

        text = re.sub(
            r"<think>.*?</think>",
            "",
            text,
            flags=re.DOTALL,
        )

        # ----------------------------------------------------
        # If the model returned only the closing tag
        # ----------------------------------------------------

        if "</think>" in text:

            text = text.split(
                "</think>",
                1
            )[1]

        return text.strip()


    # ========================================================
    # Clean markdown JSON
    # ========================================================

    @staticmethod
    def clean_json(
        text: str
    ) -> str:

        text = text.strip()

        if text.startswith(
            "```json"
        ):

            text = text[
                len("```json"):
            ].strip()

        elif text.startswith(
            "```"
        ):

            text = text[
                len("```"):
            ].strip()

        if text.endswith(
            "```"
        ):

            text = text[
                :-3
            ].strip()

        return text


# ============================================================
# Local test
# ============================================================

@app.local_entrypoint()
def main():

    print()
    print("=" * 60)
    print("Testing Qwen Image 2.1 PE-T2I")
    print("=" * 60)
    print()

    service = QwenPET2I()

    result = service.generate.remote(
        {
            "prompt": (
                "Create an extreme close-up of a "
                "premium white sneaker resting near "
                "the pedals of a modern luxury car. "
                "Only the feet and lower legs should "
                "be visible. The camera is positioned "
                "at floor level with a worm's-eye macro "
                "perspective. Do not show the face, "
                "head, torso, or upper body. Preserve "
                "the established visual identity and "
                "animation style. Wide 16:9 composition."
            )
        }
    )

    print()
    print(
        json.dumps(
            result,
            indent=2,
            ensure_ascii=False,
        )
    )