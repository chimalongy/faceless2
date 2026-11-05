# qwen3_tts.py
# Deploy: modal deploy qwen3_tts.py
# Serve:  modal serve qwen3_tts.py   (ephemeral dev mode)

import io
import time
import os
import uuid
import json
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
        "psycopg[binary]",
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
# Cloudflare R2 Helpers
# ---------------------------------------------------------------------------
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
# Database Persistence Helpers (Direct Storage to Neon Postgres)
# ---------------------------------------------------------------------------
def _save_bulk_audio_asset(context: dict, audio: dict) -> list[str]:
    """Register a completed R2 upload directly into topic_assets and return replaced keys."""
    import psycopg

    with psycopg.connect(context["database_url"], connect_timeout=20) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT file_key FROM topic_assets
                WHERE topic_id = %s AND channel_id = %s AND asset_type = 'audio' AND scene_index = %s
                """,
                (context["topic_id"], context["channel_id"], audio["scene_index"]),
            )
            old_keys = [row[0] for row in cur.fetchall() if row[0]]
            cur.execute(
                """
                DELETE FROM topic_assets
                WHERE topic_id = %s AND channel_id = %s AND asset_type = 'audio' AND scene_index = %s
                """,
                (context["topic_id"], context["channel_id"], audio["scene_index"]),
            )
            cur.execute(
                """
                INSERT INTO topic_assets (
                    topic_id, channel_id, asset_type, scene_index, file_url,
                    file_key, file_name, mime_type, size_bytes, created_at
                ) VALUES (%s, %s, 'audio', %s, %s, %s, %s, 'audio/wav', %s, NOW())
                """,
                (
                    context["topic_id"],
                    context["channel_id"],
                    audio["scene_index"],
                    audio["public_url"],
                    audio["r2_key"],
                    f"Scene {audio['scene_index']} Audio.wav",
                    audio.get("size_bytes"),
                ),
            )
            if context.get("generation_id"):
                _append_bulk_audio_job_result(cur, context, audio)
    return old_keys


def _record_bulk_audio_job_scene(context: dict, result: dict):
    """Persist per-scene failure/progress directly without polling the HTTP route."""
    if not context.get("generation_id") or not context.get("database_url"):
        return
    import psycopg
    with psycopg.connect(context["database_url"], connect_timeout=20) as conn:
        with conn.cursor() as cur:
            _append_bulk_audio_job_result(cur, context, result)


def _append_bulk_audio_job_result(cursor, context: dict, result: dict):
    succeeded = bool(result.get("success"))
    success_increment = 1 if succeeded else 0
    failure_increment = 0 if succeeded else 1
    cursor.execute(
        """
        UPDATE audio_generation_jobs
        SET processed_scenes = processed_scenes + 1,
            succeeded_scenes = succeeded_scenes + %s,
            failed_scenes = failed_scenes + %s,
            results = results || %s::jsonb,
            status = CASE
                WHEN processed_scenes + 1 < total_scenes THEN 'running'
                WHEN failed_scenes + %s = total_scenes THEN 'failed'
                WHEN failed_scenes + %s > 0 THEN 'completed_with_errors'
                ELSE 'completed'
            END,
            updated_at = NOW()
        WHERE generation_id = %s
        """,
        (
            success_increment,
            failure_increment,
            json.dumps([result]),
            failure_increment,
            failure_increment,
            context["generation_id"],
        ),
    )


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
# Background Processing Worker for Bulk Generation
# ---------------------------------------------------------------------------
def _process_qwen_bulk_job_impl(data: dict) -> dict:
    import soundfile as sf
    import psycopg

    raw_speaker = str(data.get("speaker") or data.get("voice") or "Ryan").strip()
    channel_slug = str(data.get("channel_slug", "")).strip()
    topic_slug = str(data.get("topic_slug", "")).strip()
    scenes = data.get("scenes") or []
    r2_credentials = data.get("r2_credentials") or data.get("credentials") or {}
    audio_effects = data.get("audio_effects") or {}
    database_url = str(data.get("database_url") or "").strip()
    generation_id = str(data.get("generation_id") or "").strip()

    matched_speaker = "Ryan"
    for canonical in SUPPORTED_SPEAKERS:
        if canonical.lower() == raw_speaker.lower():
            matched_speaker = canonical
            break

    # Strictly use the audio theme as instruction. If empty, pass no instruction.
    raw_instruct = (
        data.get("instruct") or data.get("audio_theme") or data.get("audioTheme") or ""
    ).strip()
    final_instruct = raw_instruct if raw_instruct else None

    req_lang = data.get("language")
    if req_lang and str(req_lang).strip() and str(req_lang).strip().lower() not in ("auto", "default"):
        resolved_lang = str(req_lang).strip()
    else:
        meta = SUPPORTED_SPEAKERS.get(matched_speaker, {})
        resolved_lang = meta.get("language", "English")

    database_context = None
    if database_url and channel_slug and topic_slug:
        try:
            with psycopg.connect(database_url, connect_timeout=20) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS audio_generation_jobs (
                            generation_id TEXT PRIMARY KEY,
                            channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
                            topic_id INT REFERENCES topics(id) ON DELETE CASCADE,
                            total_scenes INT NOT NULL DEFAULT 0,
                            processed_scenes INT NOT NULL DEFAULT 0,
                            succeeded_scenes INT NOT NULL DEFAULT 0,
                            failed_scenes INT NOT NULL DEFAULT 0,
                            status TEXT NOT NULL DEFAULT 'queued',
                            results JSONB NOT NULL DEFAULT '[]'::jsonb,
                            error TEXT,
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        )
                        """
                    )
                    cur.execute("SELECT id FROM channels WHERE slug = %s LIMIT 1", (channel_slug,))
                    channel_row = cur.fetchone()
                    channel_id = channel_row[0] if channel_row else None
                    cur.execute(
                        "SELECT id FROM topics WHERE slug = %s AND channel_id = %s LIMIT 1",
                        (topic_slug, channel_id),
                    )
                    topic_row = cur.fetchone()
                    topic_id = topic_row[0] if topic_row else None

                    if channel_id and topic_id:
                        database_context = {
                            "database_url": database_url,
                            "channel_id": channel_id,
                            "topic_id": topic_id,
                            "generation_id": generation_id,
                        }
                        if generation_id:
                            cur.execute(
                                """
                                INSERT INTO audio_generation_jobs (
                                    generation_id, channel_id, topic_id, total_scenes, status, updated_at
                                ) VALUES (%s, %s, %s, %s, 'running', NOW())
                                ON CONFLICT (generation_id) DO UPDATE SET
                                    status = 'running', error = NULL, updated_at = NOW()
                                """,
                                (generation_id, channel_id, topic_id, len(scenes)),
                            )
        except Exception as db_init_err:
            print(f"[Qwen3 Bulk] Failed to resolve database context: {db_init_err}")

    tts_worker = Qwen3TTSDeployment()
    results = []
    r2_client = create_r2_client(r2_credentials)
    bucket = (
        r2_credentials.get("CLOUDFLARE_R2_BUCKET_NAME")
        or r2_credentials.get("bucket_name")
        or os.environ.get("CLOUDFLARE_R2_BUCKET_NAME", "faceless-media")
    )

    for scene in scenes:
        scene_idx = scene.get("scene_index", scene.get("scene_number", 1))
        scene_text = str(scene.get("text") or scene.get("audio_text") or scene.get("narration") or "").strip()
        if not scene_text:
            result_item = {
                "scene_index": scene_idx,
                "success": False,
                "error": "Scene narration text is empty.",
            }
            results.append(result_item)
            if database_context:
                _record_bulk_audio_job_scene(database_context, result_item)
            continue

        uploaded_key = None
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
            uploaded_key = r2_key

            duration = 0.0
            try:
                info = sf.info(io.BytesIO(audio_bytes))
                duration = round(info.duration, 2)
            except Exception:
                pass

            result_item = {
                "scene_index": scene_idx,
                "success": True,
                "public_url": public_url,
                "r2_key": r2_key,
                "duration": duration,
                "size_bytes": len(audio_bytes),
                "audio_filter": audio_filter,
            }

            if database_context:
                old_keys = _save_bulk_audio_asset(database_context, result_item)
                uploaded_key = None
                if r2_client and bucket:
                    for old_key in old_keys:
                        if old_key and old_key != r2_key:
                            try:
                                r2_client.delete_object(Bucket=bucket, Key=old_key)
                            except Exception as del_err:
                                print(f"[Qwen3 Bulk Job] Could not delete old R2 object {old_key}: {del_err}")

            results.append(result_item)
            print(f"[Qwen3 Bulk] Scene {scene_idx} generated and stored directly into database.")
        except Exception as exc:
            if uploaded_key and r2_client and bucket:
                try:
                    r2_client.delete_object(Bucket=bucket, Key=uploaded_key)
                except Exception:
                    pass
            print(f"[Qwen3 Bulk] Error on scene {scene_idx}: {exc}")
            result_item = {
                "scene_index": scene_idx,
                "success": False,
                "error": str(exc),
            }
            results.append(result_item)
            if database_context:
                _record_bulk_audio_job_scene(database_context, result_item)

    return {
        "success": any(r.get("success") for r in results),
        "count": len(results),
        "audios": results,
        "engine": "qwen3-tts",
    }


@app.function(
    image=image,
    timeout=3600,
)
def process_qwen_bulk_job(data: dict):
    import psycopg

    try:
        return _process_qwen_bulk_job_impl(data)
    except Exception as exc:
        generation_id = str(data.get("generation_id") or "").strip()
        database_url = str(data.get("database_url") or "").strip()
        if generation_id and database_url:
            try:
                with psycopg.connect(database_url, connect_timeout=20) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE audio_generation_jobs SET status = 'failed', error = %s, updated_at = NOW() WHERE generation_id = %s",
                            (str(exc)[:4000], generation_id),
                        )
            except Exception as db_exc:
                print(f"[Qwen3 Bulk Job] Could not persist terminal job failure: {db_exc}")
        raise


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
    from fastapi.responses import Response, JSONResponse
    from pydantic import BaseModel, Field

    api = FastAPI(
        title="Qwen3-TTS 1.7B REST API",
        version="1.3.0",
        description="High-fidelity voice synthesis powered by Qwen3-TTS with style instructions and direct database persistence",
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
            description="Style & tone instructions (e.g. channel audio theme)",
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
            matched_speaker = "Ryan"

        # Strictly use audio theme as instruction. If empty, pass no instruction.
        raw_instruct = (
            req.instruct or req.audio_theme or req.audioTheme or ""
        ).strip()
        final_instruct = raw_instruct if raw_instruct else None

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

    @api.post("/bulk-generate")
    async def bulk_generate_endpoint(data: dict):
        scenes = data.get("scenes") or []
        if not scenes or not isinstance(scenes, list):
            raise HTTPException(status_code=400, detail="scenes list is required")

        database_url = str(data.get("database_url") or "").strip()
        channel_slug = str(data.get("channel_slug") or "").strip()
        topic_slug = str(data.get("topic_slug") or "").strip()

        # If database_url is provided along with channel and topic, run as detached background job
        if database_url and channel_slug and topic_slug:
            import psycopg

            generation_id = str(uuid.uuid4())
            worker_data = {**data, "generation_id": generation_id}

            try:
                with psycopg.connect(database_url, connect_timeout=20) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            CREATE TABLE IF NOT EXISTS audio_generation_jobs (
                                generation_id TEXT PRIMARY KEY,
                                channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
                                topic_id INT REFERENCES topics(id) ON DELETE CASCADE,
                                total_scenes INT NOT NULL DEFAULT 0,
                                processed_scenes INT NOT NULL DEFAULT 0,
                                succeeded_scenes INT NOT NULL DEFAULT 0,
                                failed_scenes INT NOT NULL DEFAULT 0,
                                status TEXT NOT NULL DEFAULT 'queued',
                                results JSONB NOT NULL DEFAULT '[]'::jsonb,
                                error TEXT,
                                created_at TIMESTAMPTZ DEFAULT NOW(),
                                updated_at TIMESTAMPTZ DEFAULT NOW()
                            )
                            """
                        )
                        cur.execute("SELECT id FROM channels WHERE slug = %s LIMIT 1", (channel_slug,))
                        channel_row = cur.fetchone()
                        cur.execute(
                            "SELECT id FROM topics WHERE slug = %s AND channel_id = %s LIMIT 1",
                            (topic_slug, channel_row[0] if channel_row else None),
                        )
                        topic_row = cur.fetchone()
                        if not channel_row or not topic_row:
                            raise HTTPException(status_code=404, detail="Channel or topic was not found in the database.")

                        cur.execute(
                            """
                            INSERT INTO audio_generation_jobs (
                                generation_id, channel_id, topic_id, total_scenes, status
                            ) VALUES (%s, %s, %s, %s, 'queued')
                            """,
                            (generation_id, channel_row[0], topic_row[0], len(scenes)),
                        )
                job = await process_qwen_bulk_job.spawn.aio(worker_data)
            except HTTPException:
                raise
            except Exception as exc:
                try:
                    with psycopg.connect(database_url, connect_timeout=20) as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE audio_generation_jobs SET status = 'failed', error = %s, updated_at = NOW() WHERE generation_id = %s",
                                (str(exc)[:4000], generation_id),
                            )
                except Exception:
                    pass
                raise HTTPException(status_code=500, detail=f"Could not queue the Qwen bulk job: {exc}") from exc

            return JSONResponse(
                status_code=202,
                content={
                    "accepted": True,
                    "status": "queued",
                    "job_id": generation_id,
                    "modal_call_id": job.object_id,
                    "count": len(scenes),
                    "engine": "qwen3-tts",
                },
            )

        # Fallback synchronous execution if no database_url is provided
        return _process_qwen_bulk_job_impl(data)

    return api
