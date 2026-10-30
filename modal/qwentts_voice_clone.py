from pathlib import Path
import hashlib
import json
from datetime import datetime, timezone
import io
import base64
import shutil
import time
import os
import re
import subprocess
import wave

import modal


MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
MODEL_DIR = Path("/model-cache/qwen3-tts-1.7b")
VOICE_DIR = Path("/voice-store/voices")
MAX_REFERENCE_AUDIO_BYTES = 20 * 1024 * 1024

model_volume = modal.Volume.from_name(
    "qwen3-tts-model-cache",
    create_if_missing=True,
)
voice_volume = modal.Volume.from_name(
    "qwen3-tts-registered-voices",
    create_if_missing=True,
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

app = modal.App("qwen3-tts-voice-cloning")

# These packages are installed in Modal's remote container image.
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .uv_pip_install(
        "qwen-tts",
        "fastapi[standard]",
        "soundfile",
        "boto3",
    )
)


# Run once to download and persist the model weights.
@app.function(
    image=image,
    volumes={"/model-cache": model_volume},
    timeout=1800,
)
def download_model():
    from huggingface_hub import snapshot_download

    if (MODEL_DIR / "config.json").exists():
        print("Model is already in the Modal Volume.")
        return

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=MODEL_ID,
        local_dir=str(MODEL_DIR),
    )
    model_volume.commit()
    print(f"Model downloaded to {MODEL_DIR}")


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


@app.cls(
    image=image,
    gpu="L4",
    volumes={
        "/model-cache": model_volume,
        "/voice-store": voice_volume,
    },
    timeout=900,
    scaledown_window=60,
    max_containers=1,
)
class qwentts_voice_cloner:
    @modal.enter()
    def load_model(self):
        import torch
        from qwen_tts import Qwen3TTSModel

        if not (MODEL_DIR / "config.json").exists():
            raise RuntimeError(
                "Model files are missing. First run "
                "'modal run qwentts_voice_clone.py::download_model'."
            )

        dtype = (
            torch.bfloat16
            if torch.cuda.is_bf16_supported()
            else torch.float16
        )
        self.model = Qwen3TTSModel.from_pretrained(
            str(MODEL_DIR),
            device_map="cuda:0",
            dtype=dtype,
        )

    @modal.asgi_app(label="qwen3-tts-voice-cloner")
    def web(self):
        from fastapi import FastAPI, HTTPException
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import Response
        import soundfile as sf

        web_app = FastAPI(
            title="Qwen3-TTS Voice Cloner",
            docs_url=None,
            redoc_url=None,
        )

        web_app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        def voice_key(voice_name: str) -> str:
            # Hash names for safe filesystem paths while preserving the display name in metadata.
            return hashlib.sha256(voice_name.casefold().encode("utf-8")).hexdigest()

        @web_app.post("/new-clone")
        def new_clone(data: dict):
            voice_name = str(data.get("voice_name", "")).strip()
            ref_text = str(data.get("ref_text", "")).strip()
            encoded_audio = data.get("ref_audio_base64", "")

            if not voice_name:
                raise HTTPException(status_code=400, detail="voice_name is required")
            if len(voice_name) > 100:
                raise HTTPException(status_code=400, detail="voice_name must be 100 characters or fewer")
            if not ref_text:
                raise HTTPException(status_code=400, detail="ref_text is required")
            if not isinstance(encoded_audio, str) or not encoded_audio:
                raise HTTPException(status_code=400, detail="ref_audio_base64 is required")
            if len(encoded_audio) > (MAX_REFERENCE_AUDIO_BYTES * 4 // 3) + 8:
                raise HTTPException(status_code=413, detail="Reference audio must be 20 MB or smaller")

            try:
                audio_bytes = base64.b64decode(encoded_audio, validate=True)
            except Exception as exc:
                raise HTTPException(status_code=400, detail="ref_audio_base64 must contain valid Base64 data") from exc

            if not audio_bytes:
                raise HTTPException(status_code=400, detail="Reference audio is empty")
            if len(audio_bytes) > MAX_REFERENCE_AUDIO_BYTES:
                raise HTTPException(status_code=413, detail="Reference audio must be 20 MB or smaller")

            # Decode and re-encode the upload as WAV. This validates the audio and avoids
            # treating MP3 bytes as WAV merely because of a temporary filename suffix.
            try:
                waveform, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
                wav_buffer = io.BytesIO()
                sf.write(wav_buffer, waveform, sample_rate, format="WAV", subtype="PCM_16")
                normalized_wav = wav_buffer.getvalue()
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail="Could not decode reference audio. Upload a supported WAV or MP3 file.",
                ) from exc

            voice_volume.reload()
            key = voice_key(voice_name)
            voice_path = VOICE_DIR / key
            metadata_path = voice_path / "metadata.json"
            audio_path = voice_path / "reference.wav"

            if metadata_path.exists():
                raise HTTPException(status_code=409, detail="That voice_name is already registered")

            voice_path.mkdir(parents=True, exist_ok=True)
            created_at = datetime.now(timezone.utc).isoformat()
            metadata = {
                "voice_name": voice_name,
                "ref_text": ref_text,
                "audio_file": "reference.wav",
                "created_at": created_at,
            }

            audio_tmp = voice_path / "reference.wav.tmp"
            metadata_tmp = voice_path / "metadata.json.tmp"
            audio_tmp.write_bytes(normalized_wav)
            metadata_tmp.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
            audio_tmp.replace(audio_path)
            metadata_tmp.replace(metadata_path)
            voice_volume.commit()

            return {
                "message": "Voice registered successfully",
                "voice_name": voice_name,
                "ref_text": ref_text,
                "created_at": created_at,
            }

        @web_app.post("/create-clone")
        def create_clone_alias(data: dict):
            return new_clone(data)

        @web_app.get("/voices")
        def list_voices():
            voice_volume.reload()
            if not VOICE_DIR.exists():
                return {"voices": [], "count": 0}

            voices = []
            for entry in VOICE_DIR.iterdir():
                if entry.is_dir():
                    metadata_path = entry / "metadata.json"
                    if metadata_path.is_file():
                        try:
                            meta = json.loads(metadata_path.read_text(encoding="utf-8"))
                            has_ref_audio = (entry / "reference.wav").is_file()
                            audio_size = (entry / "reference.wav").stat().st_size if has_ref_audio else 0
                            voices.append({
                                "voice_name": meta.get("voice_name", entry.name),
                                "ref_text": meta.get("ref_text", ""),
                                "created_at": meta.get("created_at", ""),
                                "has_reference_audio": has_ref_audio,
                                "reference_audio_bytes": audio_size,
                            })
                        except Exception:
                            continue

            # Sort most recently created first
            voices.sort(key=lambda v: (v.get("created_at") or ""), reverse=True)
            return {"voices": voices, "count": len(voices)}

        @web_app.get("/list-clones")
        def list_clones_alias():
            return list_voices()

        def _delete_voice_internal(voice_name: str):
            target_name = str(voice_name or "").strip()
            if not target_name:
                raise HTTPException(status_code=400, detail="voice_name is required")

            voice_volume.reload()
            key = voice_key(target_name)
            voice_path = VOICE_DIR / key

            # Check if hashed dir exists or search by case-insensitive name in metadata
            target_dir = None
            if voice_path.is_dir():
                target_dir = voice_path
            elif VOICE_DIR.exists():
                for entry in VOICE_DIR.iterdir():
                    if entry.is_dir():
                        meta_file = entry / "metadata.json"
                        if meta_file.is_file():
                            try:
                                data = json.loads(meta_file.read_text(encoding="utf-8"))
                                if data.get("voice_name", "").casefold() == target_name.casefold():
                                    target_dir = entry
                                    break
                            except Exception:
                                pass

            if not target_dir or not target_dir.exists():
                raise HTTPException(status_code=404, detail=f"Voice clone not found: {target_name}")

            shutil.rmtree(target_dir, ignore_errors=True)
            voice_volume.commit()
            return {
                "success": True,
                "message": f"Voice clone '{target_name}' deleted successfully",
                "voice_name": target_name,
            }

        @web_app.delete("/voices/{voice_name}")
        def delete_voice(voice_name: str):
            return _delete_voice_internal(voice_name)

        @web_app.post("/delete-clone")
        def delete_clone_post(data: dict):
            return _delete_voice_internal(data.get("voice_name", ""))

        @web_app.get("/voices/{voice_name}/reference-audio")
        def get_reference_audio(voice_name: str):
            voice_volume.reload()
            target_name = str(voice_name or "").strip()
            key = voice_key(target_name)
            voice_path = VOICE_DIR / key

            if not voice_path.is_dir() and VOICE_DIR.exists():
                for entry in VOICE_DIR.iterdir():
                    if entry.is_dir():
                        meta_file = entry / "metadata.json"
                        if meta_file.is_file():
                            try:
                                data = json.loads(meta_file.read_text(encoding="utf-8"))
                                if data.get("voice_name", "").casefold() == target_name.casefold():
                                    voice_path = entry
                                    break
                            except Exception:
                                pass

            audio_file = voice_path / "reference.wav"
            if not audio_file.is_file():
                raise HTTPException(status_code=404, detail=f"Reference audio not found for voice: {target_name}")

            return Response(
                content=audio_file.read_bytes(),
                media_type="audio/wav",
                headers={"Content-Disposition": f'inline; filename="{target_name}-reference.wav"'},
            )

        def _locate_voice_internal(voice_name: str):
            voice_volume.reload()
            voice_path = VOICE_DIR / voice_key(voice_name)
            metadata_path = voice_path / "metadata.json"
            audio_path = voice_path / "reference.wav"

            if not metadata_path.is_file() or not audio_path.is_file():
                # Case-insensitive directory lookup fallback
                matched = False
                if VOICE_DIR.exists():
                    for entry in VOICE_DIR.iterdir():
                        if entry.is_dir():
                            m_file = entry / "metadata.json"
                            a_file = entry / "reference.wav"
                            if m_file.is_file() and a_file.is_file():
                                try:
                                    m_data = json.loads(m_file.read_text(encoding="utf-8"))
                                    if m_data.get("voice_name", "").casefold() == voice_name.casefold():
                                        voice_path = entry
                                        metadata_path = m_file
                                        audio_path = a_file
                                        matched = True
                                        break
                                except Exception:
                                    pass
                if not matched:
                    raise HTTPException(status_code=404, detail=f"Registered voice not found: {voice_name}")

            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except Exception as exc:
                raise HTTPException(status_code=500, detail="Could not read registered voice metadata") from exc

            return audio_path, metadata.get("ref_text", "")

        @web_app.post("/generate")
        def generate(data: dict):
            voice_name = str(data.get("voice_name", "")).strip()
            text = str(data.get("text", "")).strip()
            language = str(data.get("language", "English")).strip() or "English"

            if not voice_name:
                raise HTTPException(status_code=400, detail="voice_name is required")
            if not text:
                raise HTTPException(status_code=400, detail="text is required")

            audio_path, ref_text = _locate_voice_internal(voice_name)

            try:
                wavs, sample_rate = self.model.generate_voice_clone(
                    text=text,
                    language=language,
                    ref_audio=str(audio_path),
                    ref_text=ref_text,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

            output = io.BytesIO()
            sf.write(output, wavs[0], sample_rate, format="WAV")
            return Response(
                content=output.getvalue(),
                media_type="audio/wav",
                headers={"Content-Disposition": 'attachment; filename="clone.wav"'},
            )

        @web_app.post("/bulk-generate")
        def bulk_generate(data: dict):
            voice_name = str(data.get("voice_name", "")).strip()
            channel_slug = str(data.get("channel_slug", "")).strip()
            topic_slug = str(data.get("topic_slug", "")).strip()
            scenes = data.get("scenes") or []
            language = str(data.get("language", "English")).strip() or "English"
            audio_effects = data.get("audio_effects") or {}
            r2_credentials = data.get("r2_credentials") or data.get("credentials") or {}

            if not voice_name:
                raise HTTPException(status_code=400, detail="voice_name is required for bulk generation.")
            if not scenes or not isinstance(scenes, list):
                raise HTTPException(status_code=400, detail="scenes list is required.")

            audio_path, ref_text = _locate_voice_internal(voice_name)

            results = []
            for scene in scenes:
                scene_idx = scene.get("scene_index", scene.get("scene_number", 1))
                scene_text = str(scene.get("text") or scene.get("audio_text") or scene.get("narration") or "").strip()
                if not scene_text:
                    continue

                try:
                    wavs, sample_rate = self.model.generate_voice_clone(
                        text=scene_text,
                        language=language,
                        ref_audio=str(audio_path),
                        ref_text=ref_text,
                    )
                    buf = io.BytesIO()
                    sf.write(buf, wavs[0], sample_rate, format="WAV")
                    wav_bytes = buf.getvalue()
                    wav_bytes, audio_filter = apply_audio_effects_to_wav(wav_bytes, audio_effects)

                    timestamp = int(time.time() * 1000)
                    random_suffix = hashlib.md5(f"{scene_idx}-{timestamp}".encode()).hexdigest()[:6]

                    if channel_slug and topic_slug:
                        r2_key = f"channels/{channel_slug}/topics/{topic_slug}/audio/scene-{scene_idx}-{timestamp}-{random_suffix}.wav"
                    else:
                        safe_voice = voice_name.lower().replace(" ", "_")
                        r2_key = f"voice-clones/{safe_voice}/scene-{scene_idx}-{timestamp}.wav"

                    public_url = upload_wav_to_r2(wav_bytes, r2_key, r2_credentials)
                    duration = round(len(wavs[0]) / float(sample_rate), 2)

                    results.append({
                        "scene_index": scene_idx,
                        "success": True,
                        "public_url": public_url,
                        "r2_key": r2_key,
                        "duration": duration,
                        "size_bytes": len(wav_bytes),
                        "audio_filter": audio_filter,
                    })
                except Exception as exc:
                    print(f"[Qwen Voice Clone Bulk] Error on scene {scene_idx}: {exc}")
                    results.append({
                        "scene_index": scene_idx,
                        "success": False,
                        "error": str(exc),
                    })

            return {
                "success": any(r.get("success") for r in results),
                "count": len(results),
                "audios": results,
                "engine": "qwen3-tts-clone",
            }

        @web_app.get("/health")
        def health():
            voice_count = 0
            try:
                voice_volume.reload()
                if VOICE_DIR.exists():
                    voice_count = sum(1 for e in VOICE_DIR.iterdir() if e.is_dir() and (e / "metadata.json").is_file())
            except Exception:
                pass
            return {"status": "ok", "voices_registered": voice_count}

        return web_app
