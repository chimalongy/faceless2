# modal/kokorotts.py — Kokoro-82M on Modal with Bulk Generation & Direct R2 Upload
# Deploy:  modal deploy modal/kokorotts.py
# Serve:   modal serve modal/kokorotts.py   (ephemeral, dev)

import io
import time
import os
import hashlib
import re
import subprocess
import wave
import modal

# ---------------------------------------------------------------------------
# 1. Container image
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("espeak-ng", "ffmpeg")
    .pip_install(
        "kokoro>=0.9.4",
        "misaki[en]",   # American + British English, Spanish, French, Hindi, Italian, Portuguese
        "misaki[ja]",   # Japanese
        "misaki[zh]",   # Mandarin Chinese
        "soundfile",
        "numpy",
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

app = modal.App("kokoro-tts", image=image)

# ---------------------------------------------------------------------------
# 2. Voice registry — all 54 voices from Kokoro v1.0
# ---------------------------------------------------------------------------
VOICES = {
    "american_english": {
        "lang_code": "a",
        "female": [
            "af_heart",    # ❤️ Grade A  — best overall quality
            "af_bella",    # 🔥 Grade A-
            "af_nicole",   # 🎧 Grade B-
            "af_aoede",    # Grade C+
            "af_kore",     # Grade C+
            "af_sarah",    # Grade C+
            "af_alloy",    # Grade C
            "af_nova",     # Grade C
            "af_jessica",  # Grade D
            "af_river",    # Grade D
            "af_sky",      # Grade C-
        ],
        "male": [
            "am_fenrir",   # Grade C+
            "am_michael",  # Grade C+
            "am_puck",     # Grade C+
            "am_echo",     # Grade D
            "am_eric",     # Grade D
            "am_liam",     # Grade D
            "am_onyx",     # Grade D
            "am_santa",    # Grade D-
            "am_adam",     # Grade F+
        ],
    },
    "british_english": {
        "lang_code": "b",
        "female": [
            "bf_emma",      # Grade B-
            "bf_isabella",  # Grade C
            "bf_alice",     # Grade D
            "bf_lily",      # Grade D
        ],
        "male": [
            "bm_fable",     # Grade C
            "bm_george",    # Grade C
            "bm_lewis",     # Grade D+
            "bm_daniel",    # Grade D
        ],
    },
    "japanese": {
        "lang_code": "j",
        "female": [
            "jf_alpha",      # Grade C+
            "jf_gongitsune", # Grade C
            "jf_tebukuro",   # Grade C
            "jf_nezumi",     # Grade C-
        ],
        "male": [
            "jm_kumo",       # Grade C-
        ],
    },
    "mandarin_chinese": {
        "lang_code": "z",
        "female": [
            "zf_xiaobei",
            "zf_xiaoni",
            "zf_xiaoxiao",
            "zf_xiaoyi",
        ],
        "male": [
            "zm_yunjian",
            "zm_yunxi",
            "zm_yunxia",
            "zm_yunyang",
        ],
    },
    "spanish": {
        "lang_code": "e",
        "female": ["ef_dora"],
        "male":   ["em_alex", "em_santa"],
    },
    "french": {
        "lang_code": "f",
        "female": ["ff_siwis"],
        "male":   [],
    },
    "hindi": {
        "lang_code": "h",
        "female": ["hf_alpha", "hf_beta"],
        "male":   ["hm_omega", "hm_psi"],
    },
    "italian": {
        "lang_code": "i",
        "female": ["if_sara"],
        "male":   ["im_nicola"],
    },
    "brazilian_portuguese": {
        "lang_code": "p",
        "female": ["pf_dora"],
        "male":   ["pm_alex", "pm_santa"],
    },
}

VOICE_TO_LANG: dict[str, str] = {}
for lang_meta in VOICES.values():
    code = lang_meta["lang_code"]
    for voice_name in lang_meta["female"] + lang_meta["male"]:
        VOICE_TO_LANG[voice_name] = code


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


# ---------------------------------------------------------------------------
# 3. Model worker class
# ---------------------------------------------------------------------------
@app.cls(
    scaledown_window=300,
)
class KokoroTTS:
    @modal.enter()
    def load(self):
        from kokoro import KPipeline

        lang_codes = {meta["lang_code"] for meta in VOICES.values()}
        self.pipelines: dict[str, KPipeline] = {}
        for code in lang_codes:
            try:
                self.pipelines[code] = KPipeline(lang_code=code)
                print(f"[kokoro] pipeline ready: lang_code='{code}'")
            except Exception as exc:
                print(f"[kokoro] WARNING: failed to load lang_code='{code}': {exc}")

    @modal.method()
    def synthesize(
        self,
        text: str,
        voice: str = "af_heart",
        speed: float = 1.0,
        fmt: str = "wav",
        lang_code: str | None = None,
    ) -> bytes:
        import numpy as np
        import soundfile as sf

        resolved_lang = lang_code or VOICE_TO_LANG.get(voice, "a")
        pipeline = self.pipelines.get(resolved_lang)
        if pipeline is None:
            raise ValueError(f"No pipeline loaded for lang_code='{resolved_lang}'")

        chunks = []
        for _i, (_gs, _ps, audio) in enumerate(
            pipeline(text, voice=voice, speed=speed, split_pattern=r"\n+")
        ):
            chunks.append(audio)

        if not chunks:
            return b""

        combined = np.concatenate(chunks)
        if fmt == "pcm":
            return combined.astype(np.float32).tobytes()

        buf = io.BytesIO()
        sf.write(buf, combined, samplerate=24000, format="WAV")
        buf.seek(0)
        return buf.read()


# ---------------------------------------------------------------------------
# 4. FastAPI web endpoint
# ---------------------------------------------------------------------------
@app.function(
    scaledown_window=300,
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def web():
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import Response
    from pydantic import BaseModel, Field

    api = FastAPI(title="Kokoro TTS", version="2.0.0")

    class TTSRequest(BaseModel):
        text: str = Field(..., max_length=10_000)
        voice: str = Field("af_heart")
        speed: float = Field(1.0, ge=0.5, le=2.0)
        format: str = Field("wav", pattern="^(wav|pcm)$")
        lang_code: str | None = None

    @api.get("/health")
    def health():
        return {
            "status": "ok",
            "model": "kokoro-82m",
            "sample_rate": 24000,
            "total_voices": len(VOICE_TO_LANG),
        }

    @api.get("/voices")
    def voices():
        return {"voices": VOICES}

    @api.get("/voices/flat")
    def voices_flat():
        return {
            "voices": [
                {"name": name, "lang_code": code}
                for name, code in sorted(VOICE_TO_LANG.items())
            ]
        }

    @api.post("/synthesize")
    def synthesize(req: TTSRequest):
        if not req.text.strip():
            raise HTTPException(400, "text must not be empty")

        if req.voice not in VOICE_TO_LANG:
            raise HTTPException(400, f"Unknown voice '{req.voice}'.")

        tts = KokoroTTS()
        audio = tts.synthesize.remote(
            text=req.text,
            voice=req.voice,
            speed=req.speed,
            fmt=req.format,
            lang_code=req.lang_code,
        )
        media = "audio/wav" if req.format == "wav" else "audio/pcm"
        return Response(content=audio, media_type=media)

    @api.post("/bulk-generate")
    def bulk_generate(data: dict):
        voice = str(data.get("voice") or data.get("voice_name") or "af_heart").strip()
        channel_slug = str(data.get("channel_slug", "")).strip()
        topic_slug = str(data.get("topic_slug", "")).strip()
        scenes = data.get("scenes") or []
        speed = float(data.get("speed", 1.0))
        audio_effects = data.get("audio_effects") or {}
        r2_credentials = data.get("r2_credentials") or data.get("credentials") or {}

        if not scenes or not isinstance(scenes, list):
            raise HTTPException(400, "scenes list is required")

        if voice not in VOICE_TO_LANG:
            voice = "af_heart"

        tts = KokoroTTS()
        results = []

        for scene in scenes:
            scene_idx = scene.get("scene_index", scene.get("scene_number", 1))
            scene_text = str(scene.get("text") or scene.get("audio_text") or scene.get("narration") or "").strip()
            if not scene_text:
                continue

            try:
                audio_bytes = tts.synthesize.remote(
                    text=scene_text,
                    voice=voice,
                    speed=speed,
                    fmt="wav",
                )
                audio_bytes, audio_filter = apply_audio_effects_to_wav(audio_bytes, audio_effects)

                timestamp = int(time.time() * 1000)
                random_suffix = hashlib.md5(f"{scene_idx}-{timestamp}".encode()).hexdigest()[:6]

                if channel_slug and topic_slug:
                    r2_key = f"channels/{channel_slug}/topics/{topic_slug}/audio/scene-{scene_idx}-{timestamp}-{random_suffix}.wav"
                else:
                    r2_key = f"kokoro-tts/{voice}/scene-{scene_idx}-{timestamp}.wav"

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
                print(f"[Kokoro Bulk] Error on scene {scene_idx}: {exc}")
                results.append({
                    "scene_index": scene_idx,
                    "success": False,
                    "error": str(exc),
                })

        return {
            "success": any(r.get("success") for r in results),
            "count": len(results),
            "audios": results,
            "engine": "kokoro-82m",
        }

    return api
