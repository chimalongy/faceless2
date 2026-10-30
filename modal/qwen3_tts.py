# qwen3_tts.py
# Deploy: modal deploy qwen3_tts.py
# Serve:  modal serve qwen3_tts.py   (ephemeral dev mode)

import io
import time
import os
import hashlib
import re
import subprocess
import wave
import modal

# ---------------------------------------------------------------------------
# 1. Container Image Configuration
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "torch",
        "torchaudio",
        "transformers",
        "soundfile",
        "numpy",
        "qwen-tts",
        "fastapi[standard]",
        "boto3",
    )
)



def apply_audio_effects_to_wav(wav_bytes: bytes, config: dict | None) -> tuple[bytes, str]:
    """Apply the channel's precompiled FFmpeg filter before a bulk WAV upload."""
    if not isinstance(config, dict) or not config.get("enabled"):
        return wav_bytes, "none"

    filter_string = str(config.get("filter") or "").strip()
    if not filter_string:
        return wav_bytes, "none"

    def run_filter(audio_filter: str) -> bytes:
        result = subprocess.run(
            [
                "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                "-i", "pipe:0", "-af", audio_filter, "-c:a", "pcm_s16le",
                "-f", "wav", "pipe:1",
            ],
            input=wav_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode("utf-8", errors="replace")[-4000:])
        if not result.stdout:
            raise RuntimeError("FFmpeg returned an empty WAV.")
        return result.stdout

    try:
        return run_filter(filter_string), filter_string
    except RuntimeError as exc:
        error_text = str(exc)
        missing_rubberband = (
            "no such filter" in error_text.lower()
            and re.search(r"rubberband\s*=\s*pitch\s*=", filter_string, re.IGNORECASE)
        )
        if not missing_rubberband:
            raise

        with wave.open(io.BytesIO(wav_bytes), "rb") as audio_file:
            sample_rate = audio_file.getframerate()
        if not sample_rate:
            raise RuntimeError("FFmpeg lacks rubberband and the WAV sample rate could not be read.") from exc

        def replace_pitch(match):
            pitch = float(match.group(1))
            if pitch <= 0:
                raise RuntimeError(f"Invalid rubberband pitch factor: {pitch}")
            shifted_rate = round(sample_rate * pitch)
            tempo = f"{1 / pitch:.6f}".rstrip("0").rstrip(".")
            return f"asetrate={shifted_rate},aresample={sample_rate},atempo={tempo}"

        fallback_filter = re.sub(
            r"rubberband=pitch=([0-9]*\.?[0-9]+)",
            replace_pitch,
            filter_string,
            flags=re.IGNORECASE,
        )
        return run_filter(fallback_filter), fallback_filter

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

    def create_r2_client(credentials: dict):
        import boto3
        from botocore.config import Config

        account_id = (
            credentials.get("CLOUDFLARE_R2_ACCOUNT_ID")
            or credentials.get("account_id")
            or os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
        )
        access_key = (
            credentials.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
            or credentials.get("access_key_id")
            or os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
        )
        secret_key = (
            credentials.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
            or credentials.get("secret_access_key")
            or os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
        )

        if not (account_id and access_key and secret_key):
            return None

        endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
            config=Config(signature_version="s3v4", retries={"max_attempts": 4}),
        )

    def upload_wav_to_r2(wav_bytes: bytes, key: str, credentials: dict) -> str:
        r2 = create_r2_client(credentials)
        if not r2:
            raise ValueError("Cloudflare R2 credentials missing or incomplete")

        bucket = (
            credentials.get("CLOUDFLARE_R2_BUCKET_NAME")
            or credentials.get("bucket_name")
            or os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "faceless-media")
        )
        public_base = (
            credentials.get("CLOUDFLARE_R2_PUBLIC_URL")
            or credentials.get("public_url")
            or os.environ.get("CLOUDFLARE_R2_PUBLIC_URL", "")
        ).rstrip("/")

        clean_key = key.lstrip("/")
        r2.put_object(
            Bucket=bucket,
            Key=clean_key,
            Body=wav_bytes,
            ContentType="audio/wav",
        )
        return f"{public_base}/{clean_key}" if public_base else f"/{clean_key}"

    @api.post("/bulk-generate")
    def bulk_generate_endpoint(data: dict):
        raw_speaker = str(data.get("speaker") or data.get("voice") or "Ryan").strip()
        channel_slug = str(data.get("channel_slug", "")).strip()
        topic_slug = str(data.get("topic_slug", "")).strip()
        scenes = data.get("scenes") or []
        r2_credentials = data.get("r2_credentials") or data.get("credentials") or {}
        audio_effects = data.get("audio_effects") or {}

        if not scenes or not isinstance(scenes, list):
            raise HTTPException(status_code=400, detail="scenes list is required")

        matched_speaker = "Ryan"
        for canonical in SUPPORTED_SPEAKERS:
            if canonical.lower() == raw_speaker.lower():
                matched_speaker = canonical
                break

        raw_instruct = (
            data.get("instruct") or data.get("audio_theme") or data.get("audioTheme") or ""
        ).strip()

        speed_multiplier = float(data.get("speed", 1.0))
        final_instruct = raw_instruct
        if speed_multiplier != 1.0:
            speed_note = (
                f"with faster deliberate pacing ({speed_multiplier}x)"
                if speed_multiplier > 1.0
                else f"with slower, measured pacing ({speed_multiplier}x)"
            )
            final_instruct = f"{raw_instruct}. Deliver speech {speed_note}." if raw_instruct else f"Deliver speech {speed_note}."

        final_instruct = final_instruct.strip() if final_instruct else None

        req_lang = data.get("language")
        if req_lang and str(req_lang).strip() and str(req_lang).strip().lower() not in ("auto", "default"):
            resolved_lang = str(req_lang).strip()
        else:
            meta = SUPPORTED_SPEAKERS.get(matched_speaker, {})
            resolved_lang = meta.get("language", "English")

        tts_worker = Qwen3TTSDeployment()
        results = []

        for scene in scenes:
            scene_idx = scene.get("scene_index", scene.get("scene_number", 1))
            scene_text = str(scene.get("text") or scene.get("audio_text") or scene.get("narration") or "").strip()
            if not scene_text:
                continue

            try:
                audio_bytes = tts_worker.synthesize.remote(
                    text=scene_text,
                    language=resolved_lang,
                    speaker=matched_speaker,
                    instruct=final_instruct,
                )
                audio_bytes, audio_filter = apply_audio_effects_to_wav(audio_bytes, audio_effects)

                timestamp = int(time.time() * 1000)
                random_suffix = hashlib.md5(f"{scene_idx}-{timestamp}".encode()).hexdigest()[:6]

                if channel_slug and topic_slug:
                    r2_key = f"channels/{channel_slug}/topics/{topic_slug}/audio/scene-{scene_idx}-{timestamp}-{random_suffix}.wav"
                else:
                    safe_speaker = matched_speaker.lower().replace(" ", "_")
                    r2_key = f"qwen-tts/{safe_speaker}/scene-{scene_idx}-{timestamp}.wav"

                public_url = upload_wav_to_r2(audio_bytes, r2_key, r2_credentials)

                duration = 0.0
                try:
                    info = sf.info(io.BytesIO(audio_bytes))
                    duration = round(info.duration, 2)
                except Exception:
                    pass

                results.append({
                    "scene_index": scene_idx,
                    "success": True,
                    "public_url": public_url,
                    "r2_key": r2_key,
                    "duration": duration,
                    "size_bytes": len(audio_bytes),
                    "audio_filter": audio_filter,
                })
            except Exception as exc:
                print(f"[Qwen3 Bulk] Error on scene {scene_idx}: {exc}")
                results.append({
                    "scene_index": scene_idx,
                    "success": False,
                    "error": str(exc),
                })

        return {
            "success": any(r.get("success") for r in results),
            "count": len(results),
            "audios": results,
            "engine": "qwen3-tts",
        }

    return api
