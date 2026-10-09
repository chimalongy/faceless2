# qwen3_tts.py
# Deploy: modal deploy qwen3_tts.py
# Serve:  modal serve qwen3_tts.py   (ephemeral dev mode)

import io
import modal

# ---------------------------------------------------------------------------
# 1. Container Image Configuration
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "torchaudio",
        "transformers",
        "soundfile",
        "numpy",
        "qwen-tts",
        "fastapi[standard]",
    )
)

app = modal.App("qwen3-tts-custom", image=image)

# Official Qwen3-TTS 1.7B CustomVoice supported speakers & native metadata
SUPPORTED_SPEAKERS = {
    "Vivian": {
        "description": "Bright, slightly edgy young female",
        "language": "Chinese",
        "gender": "female",
    },
    "Serena": {
        "description": "Warm, gentle young female",
        "language": "Chinese",
        "gender": "female",
    },
    "Uncle_Fu": {
        "description": "Seasoned male, low and mellow timbre",
        "language": "Chinese",
        "gender": "male",
    },
    "Dylan": {
        "description": "Youthful male, clear and natural",
        "language": "Chinese",
        "dialect": "Beijing dialect",
        "gender": "male",
    },
    "Eric": {
        "description": "Lively male, slightly husky brightness",
        "language": "Chinese",
        "dialect": "Sichuan dialect",
        "gender": "male",
    },
    "Ryan": {
        "description": "Dynamic male with strong rhythmic drive",
        "language": "English",
        "gender": "male",
    },
    "Aiden": {
        "description": "Sunny American male, clear midrange",
        "language": "English",
        "gender": "male",
    },
    "Ono_Anna": {
        "description": "Playful female, light and nimble",
        "language": "Japanese",
        "gender": "female",
    },
    "Sohee": {
        "description": "Warm female with rich emotion",
        "language": "Korean",
        "gender": "female",
    },
}


# ---------------------------------------------------------------------------
# 2. Serverless GPU Class for Qwen3-TTS 1.7B CustomVoice
# ---------------------------------------------------------------------------
@app.cls(
    gpu="T4",
    scaledown_window=300,
    timeout=180,
)
class Qwen3TTSDeployment:

    @modal.enter()
    def load_model(self):
        """Loads the Qwen3-TTS 1.7B CustomVoice model into T4 VRAM on container startup."""
        import torch
        from qwen_tts import Qwen3TTSModel

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        model_id = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"

        print(f"[Modal] Loading {model_id} on device={self.device}...")

        # Use torch.float16 for native hardware performance on T4 GPUs
        self.model = Qwen3TTSModel.from_pretrained(
            model_id,
            device_map=self.device,
            dtype=torch.float16,
        )
        print("[Modal] Qwen3-TTS model loaded successfully!")

    @modal.method()
    def synthesize(
        self,
        text: str,
        language: str = "English",
        speaker: str = "Ryan",
        instruct: str | None = None,
    ) -> bytes:
        """Runs custom voice synthesis with optional style instructions and returns raw WAV audio bytes."""
        import soundfile as sf

        print(
            f"[Modal] Generating speech | Speaker: '{speaker}' | Lang: '{language}' | Instruct: '{instruct}'"
        )

        # Pass the optional instruct string into the generation call
        wavs, sr = self.model.generate_custom_voice(
            text=text,
            language=language,
            speaker=speaker,
            instruct=instruct,
        )

        # Write waveform numpy array into an in-memory bytes buffer as WAV
        buf = io.BytesIO()
        sf.write(buf, wavs[0], samplerate=sr, format="WAV")
        buf.seek(0)
        return buf.read()


# ---------------------------------------------------------------------------
# 3. FastAPI Web Endpoint Layer
# ---------------------------------------------------------------------------
@app.function(
    scaledown_window=300,
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def web():
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import Response
    from pydantic import BaseModel, Field

    api = FastAPI(
        title="Qwen3-TTS 1.7B REST API",
        version="1.2.0",
        description="High-fidelity voice synthesis powered by Qwen3-TTS with style instructions",
    )

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class TTSRequest(BaseModel):
        text: str = Field(..., max_length=10000, description="Text to convert to speech")
        speaker: str | None = Field(
            None,
            description="Speaker name: Vivian, Serena, Uncle_Fu, Dylan, Eric, Ryan, Aiden, Ono_Anna, Sohee",
        )
        voice: str | None = Field(None, description="Alias for speaker")
        language: str | None = Field(
            None,
            description="Target language (English, Chinese, Japanese, Korean). Defaults to speaker's native language.",
        )
        instruct: str | None = Field(
            None,
            description="Style & tone instructions (e.g. 'Speak in a calm investigative documentary style')",
        )
        audio_theme: str | None = Field(None, description="Alias for instruct (channel audio theme)")
        audioTheme: str | None = Field(None, description="CamelCase alias for instruct")
        speed: float | None = Field(1.0, description="Playback speed multiplier")

    @api.get("/health")
    def health():
        return {
            "status": "ok",
            "model": "Qwen3-TTS-12Hz-1.7B-CustomVoice",
            "supported_speakers": list(SUPPORTED_SPEAKERS.keys()),
        }

    @api.get("/voices")
    def list_voices():
        return {
            "model": "Qwen3-TTS-12Hz-1.7B-CustomVoice",
            "voices": [
                {
                    "id": spk,
                    "name": f"{spk} ({meta['description']})",
                    "speaker": spk,
                    "description": meta["description"],
                    "language": meta["language"],
                    "gender": meta.get("gender", "unknown"),
                    "dialect": meta.get("dialect"),
                }
                for spk, meta in SUPPORTED_SPEAKERS.items()
            ],
        }

    @api.post("/synthesize")
    def synthesize_endpoint(req: TTSRequest):
        text = req.text.strip() if req.text else ""
        if not text:
            raise HTTPException(status_code=400, detail="Text cannot be empty.")

        # Resolve speaker (supporting both 'speaker' and 'voice')
        raw_speaker = (req.speaker or req.voice or "Ryan").strip()
        matched_speaker = None
        for canonical in SUPPORTED_SPEAKERS:
            if canonical.lower() == raw_speaker.lower():
                matched_speaker = canonical
                break

        if not matched_speaker:
            # Fallback to Ryan with warning if unknown speaker
            matched_speaker = "Ryan"

        # Resolve style instruction (supporting instruct, audio_theme, audioTheme)
        raw_instruct = (
            req.instruct or req.audio_theme or req.audioTheme or ""
        ).strip()

        # If speed multiplier is notably different from 1.0, inject speed guidance into instruct
        speed_multiplier = float(req.speed) if req.speed is not None else 1.0
        final_instruct = raw_instruct
        if speed_multiplier != 1.0:
            speed_note = (
                f"with faster deliberate pacing ({speed_multiplier}x)"
                if speed_multiplier > 1.0
                else f"with slower, measured pacing ({speed_multiplier}x)"
            )
            final_instruct = f"{raw_instruct}. Deliver speech {speed_note}." if raw_instruct else f"Deliver speech {speed_note}."

        final_instruct = final_instruct.strip() if final_instruct else None

        # Resolve language: default to speaker's primary language if not provided
        if req.language and req.language.strip() and req.language.strip().lower() not in ("auto", "default"):
            resolved_lang = req.language.strip()
        else:
            meta = SUPPORTED_SPEAKERS.get(matched_speaker, {})
            resolved_lang = meta.get("language", "English")

        try:
            tts_worker = Qwen3TTSDeployment()
            audio_bytes = tts_worker.synthesize.remote(
                text=text,
                language=resolved_lang,
                speaker=matched_speaker,
                instruct=final_instruct,
            )
            return Response(content=audio_bytes, media_type="audio/wav")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return api