"""One-file Modal deployment for parallel Ken Burns scene rendering.

Local prerequisite: the Modal CLI only.
Deploy with:
    modal setup
    modal deploy scene_renderer.py

All application/runtime packages and FFmpeg are installed in Modal images.
"""

import math
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urlparse

import modal


APP_NAME = "faceless-video-renderer"
app = modal.App(APP_NAME)

# These packages are installed remotely on Modal, not on the local computer.
api_image = modal.Image.debian_slim(python_version="3.12").uv_pip_install(
    "fastapi[standard]>=0.115,<1",
    "pydantic>=2.9,<3",
)

renderer_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .uv_pip_install(
        "boto3>=1.35,<2",
        "httpx>=0.27,<1",
        "psycopg[binary]>=3.2,<4",
    )
)


class RenderInputError(ValueError):
    """Raised when a worker receives invalid input."""


def required_text(values: dict, key: str) -> str:
    value = values.get(key)
    if not isinstance(value, str) or not value.strip():
        raise RenderInputError(f"{key} is required")
    return value.strip()


def validate_worker_payload(payload: dict):
    credentials = payload.get("credentials")
    if not isinstance(credentials, dict):
        raise RenderInputError("credentials is required")

    credential_names = (
        "DATABASE_URL",
        "CLOUDFLARE_R2_ACCOUNT_ID",
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
        "CLOUDFLARE_R2_BUCKET_NAME",
        "CLOUDFLARE_R2_PUBLIC_URL",
        "CLOUDFLARE_TOKEN_",
    )
    credentials = {
        name: required_text(credentials, name) for name in credential_names
    }

    try:
        zoom_amount = float(payload["KEN_BURNS_ZOOM_AMOUNT"])
        pan_zoom = float(payload["KEN_BURNS_PAN_ZOOM"])
    except (KeyError, TypeError, ValueError) as exc:
        raise RenderInputError(
            "KEN_BURNS_ZOOM_AMOUNT and KEN_BURNS_PAN_ZOOM are required"
        ) from exc

    if not 0.02 <= zoom_amount <= 0.30:
        raise RenderInputError("KEN_BURNS_ZOOM_AMOUNT must be 0.02 to 0.30")
    if not 1.0 < pan_zoom <= 1.30:
        raise RenderInputError(
            "KEN_BURNS_PAN_ZOOM must be greater than 1.0 and at most 1.30"
        )

    scenes = payload.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise RenderInputError("scenes must contain at least one scene")

    channel_slug = required_text(payload, "channelSlug")
    topic_slug = required_text(payload, "topicSlug")
    return credentials, zoom_amount, pan_zoom, scenes, channel_slug, topic_slug


def normalize_direction(value) -> str:
    aliases = {
        "in": "zoom-in",
        "out": "zoom-out",
        "zoom in": "zoom-in",
        "zoom out": "zoom-out",
        "left": "pan-left",
        "right": "pan-right",
        "up": "pan-up",
        "down": "pan-down",
        "zoom-in": "zoom-in",
        "zoom-out": "zoom-out",
        "pan-left": "pan-left",
        "pan-right": "pan-right",
        "pan-up": "pan-up",
        "pan-down": "pan-down",
    }
    normalized = str(value or "zoom-in").strip().lower()
    if normalized not in aliases:
        raise RenderInputError(f"Unsupported Ken Burns direction: {value}")
    return aliases[normalized]


def normalize_transition(value) -> str:
    aliases = {
        "fade": "fade",
        "fade-to-black": "fade",
        "fade-to-white": "fade-to-white",
        "crossfade": "crossfade",
        "fade-in": "fade-in",
        "fade-out": "fade-out",
        "cut": "cut",
        "none": "cut",
    }
    normalized = str(value or "fade").strip().lower()
    if normalized not in aliases:
        raise RenderInputError(f"Unsupported transition: {value}")
    return aliases[normalized]


def build_ken_burns_filter(
    direction: str,
    zoom_amount: float,
    pan_zoom: float,
    fps: int,
    total_frames: int,
    width: int,
    height: int,
) -> str:
    direction = normalize_direction(direction)
    total = max(2, int(total_frames))
    progress = f"(on/{total - 1})"
    smooth = f"({progress}*{progress}*(3-2*{progress}))"
    internal_width = width * 4
    internal_height = height * 4

    if direction == "zoom-in":
        z = f"(1+({zoom_amount}*{smooth}))"
        x, y = "(iw-iw/zoom)/2", "(ih-ih/zoom)/2"
    elif direction == "zoom-out":
        z = f"(1+({zoom_amount}*(1-{smooth})))"
        x, y = "(iw-iw/zoom)/2", "(ih-ih/zoom)/2"
    elif direction == "pan-left":
        z = str(pan_zoom)
        x, y = f"(iw-iw/zoom)*(1-{smooth})", "(ih-ih/zoom)/2"
    elif direction == "pan-right":
        z = str(pan_zoom)
        x, y = f"(iw-iw/zoom)*{smooth}", "(ih-ih/zoom)/2"
    elif direction == "pan-up":
        z = str(pan_zoom)
        x, y = "(iw-iw/zoom)/2", f"(ih-ih/zoom)*(1-{smooth})"
    else:
        z = str(pan_zoom)
        x, y = "(iw-iw/zoom)/2", f"(ih-ih/zoom)*{smooth}"

    return ",".join(
        [
            f"scale={internal_width}:{internal_height}:"
            "force_original_aspect_ratio=increase:flags=lanczos",
            f"crop={internal_width}:{internal_height}:"
            f"(iw-{internal_width})/2:(ih-{internal_height})/2",
            f"zoompan=z='{z}':x='{x}':y='{y}':d={total}:"
            f"s={internal_width}x{internal_height}:fps={fps}",
            f"scale={width}:{height}:flags=lanczos",
            f"fps={fps}",
            "format=yuv420p",
        ]
    )


def build_transition_filter(transition: str, duration: float) -> str:
    transition = normalize_transition(transition)
    if transition == "cut":
        return ""

    duration = max(0.1, float(duration or 5))
    fade_duration = min(0.40, duration / 4)
    fade_out_start = max(0, duration - fade_duration)

    if transition == "fade":
        return (
            f"fade=t=in:st=0:d={fade_duration}:color=black,"
            f"fade=t=out:st={fade_out_start}:d={fade_duration}:color=black"
        )
    if transition == "fade-to-white":
        return (
            f"fade=t=in:st=0:d={fade_duration}:color=white,"
            f"fade=t=out:st={fade_out_start}:d={fade_duration}:color=white"
        )
    if transition in {"crossfade", "fade-in"}:
        return f"fade=t=in:st=0:d={fade_duration}:color=black"
    return f"fade=t=out:st={fade_out_start}:d={fade_duration}:color=black"


def create_r2_client(credentials: dict):
    import boto3
    from botocore.config import Config

    endpoint = (
        f"https://{credentials['CLOUDFLARE_R2_ACCOUNT_ID']}"
        ".r2.cloudflarestorage.com"
    )
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=credentials["CLOUDFLARE_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=credentials["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 4}),
    )


def download_http(url: str, destination: Path):
    import httpx

    if urlparse(url).scheme not in {"http", "https"}:
        raise RenderInputError("Asset URLs must use HTTP or HTTPS")
    with httpx.stream("GET", url, follow_redirects=True, timeout=120) as response:
        response.raise_for_status()
        with destination.open("wb") as output:
            for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                output.write(chunk)


def download_asset(url, key, destination: Path, r2_client, bucket: str):
    if key:
        r2_client.download_file(bucket, key, str(destination))
    elif url:
        download_http(url, destination)
    else:
        raise RenderInputError("Asset URL or R2 key is required")


def get_audio_duration(audio_path: Path) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        duration = float(result.stdout.strip())
        if math.isfinite(duration) and duration > 0:
            return duration
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
    return max(1.0, round(audio_path.stat().st_size / 48000, 3))


def resolve_scene_index(scene: dict, fallback: int) -> int:
    value = (
        scene.get("scene_number")
        or scene.get("scene_index")
        or scene.get("index")
        or fallback
    )
    try:
        value = int(value)
    except (TypeError, ValueError) as exc:
        raise RenderInputError("Scene index must be an integer") from exc
    if value < 1:
        raise RenderInputError("Scene index must be at least 1")
    return value


def prepare_scene(scene, fallback, job_dir, r2_client, bucket):
    scene_index = resolve_scene_index(scene, fallback)
    scene_dir = job_dir / f"scene-{scene_index}"
    scene_dir.mkdir(parents=True, exist_ok=True)
    image_path = scene_dir / "image.png"
    audio_path = scene_dir / "audio.wav"

    download_asset(
        scene.get("imageUrl") or scene.get("visual_url"),
        scene.get("imageKey"),
        image_path,
        r2_client,
        bucket,
    )
    download_asset(
        scene.get("audioUrl"),
        scene.get("audioKey"),
        audio_path,
        r2_client,
        bucket,
    )

    return {
        "sceneIndex": scene_index,
        "direction": normalize_direction(
            (scene.get("ken_burns") or {}).get("direction", "zoom-in")
        ),
        "transition": normalize_transition(scene.get("transition", "fade")),
        "imagePath": image_path,
        "audioPath": audio_path,
        "outputPath": scene_dir / "final.mp4",
        "duration": get_audio_duration(audio_path),
    }


def render_scene(scene, zoom_amount, pan_zoom, fps, width, height, threads):
    duration = max(1.0, float(scene["duration"]))
    total_frames = max(2, round(duration * fps))
    exact_duration = total_frames / fps
    video_path = scene["outputPath"].with_name("video-only.mp4")

    filters = [
        build_ken_burns_filter(
            scene["direction"],
            zoom_amount,
            pan_zoom,
            fps,
            total_frames,
            width,
            height,
        ),
        build_transition_filter(scene["transition"], exact_duration),
    ]

    subprocess.run(
        [
            "ffmpeg", "-y", "-loop", "1", "-i", str(scene["imagePath"]),
            "-filter_threads", str(threads),
            "-vf", ",".join(filter(None, filters)),
            "-frames:v", str(total_frames),
            "-fps_mode", "cfr",
            "-c:v", "libx264",
            "-threads:v", str(threads),
            "-preset", "medium",
            "-crf", "17",
            "-pix_fmt", "yuv420p",
            "-r", str(fps),
            "-an", str(video_path),
        ],
        check=True,
        capture_output=True,
    )

    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-i", str(scene["audioPath"]),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-movflags", "+faststart",
            str(scene["outputPath"]),
        ],
        check=True,
        capture_output=True,
    )

    return {
        "success": True,
        "sceneIndex": scene["sceneIndex"],
        "duration": round(exact_duration, 3),
        "fps": fps,
        "totalFrames": total_frames,
        "fileSize": scene["outputPath"].stat().st_size,
    }


def resolve_database_ids(database_url, channel_slug, topic_slug):
    import psycopg

    with psycopg.connect(database_url, connect_timeout=20) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM channels WHERE slug = %s LIMIT 1",
                (channel_slug,),
            )
            channel = cursor.fetchone()
            cursor.execute(
                "SELECT id FROM topics WHERE slug = %s LIMIT 1",
                (topic_slug,),
            )
            topic = cursor.fetchone()
    if not channel:
        raise RenderInputError(f"Channel not found: {channel_slug}")
    if not topic:
        raise RenderInputError(f"Topic not found: {topic_slug}")
    return channel[0], topic[0]


def upload_and_update_database(
    rendered,
    scene,
    credentials,
    r2_client,
    channel_id,
    topic_id,
    channel_slug,
    topic_slug,
):
    import psycopg

    bucket = credentials["CLOUDFLARE_R2_BUCKET_NAME"]
    key = (
        f"channels/{channel_slug}/topics/{topic_slug}/videos/"
        f"scene-{scene['sceneIndex']}-{int(time.time() * 1000)}-"
        f"{uuid.uuid4().hex[:6]}.mp4"
    )
    public_url = (
        f"{credentials['CLOUDFLARE_R2_PUBLIC_URL'].rstrip('/')}/"
        f"{quote(key, safe='/')}"
    )

    r2_client.upload_file(
        str(scene["outputPath"]),
        bucket,
        key,
        ExtraArgs={
            "ContentType": "video/mp4",
            "Metadata": {
                "channelSlug": channel_slug,
                "topicSlug": topic_slug,
                "sceneIndex": str(scene["sceneIndex"]),
                "duration": str(rendered["duration"]),
                "fps": str(rendered["fps"]),
            },
        },
    )

    old_keys = []
    try:
        with psycopg.connect(credentials["DATABASE_URL"], connect_timeout=20) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT file_key FROM topic_assets
                    WHERE topic_id = %s AND channel_id = %s
                      AND asset_type = 'video' AND scene_index = %s
                    """,
                    (topic_id, channel_id, scene["sceneIndex"]),
                )
                old_keys = [row[0] for row in cursor.fetchall() if row[0]]
                cursor.execute(
                    """
                    DELETE FROM topic_assets
                    WHERE topic_id = %s AND channel_id = %s
                      AND asset_type = 'video' AND scene_index = %s
                    """,
                    (topic_id, channel_id, scene["sceneIndex"]),
                )
                cursor.execute(
                    """
                    INSERT INTO topic_assets (
                      topic_id, channel_id, asset_type, scene_index,
                      file_url, file_key, file_name, mime_type, size_bytes
                    ) VALUES (%s, %s, 'video', %s, %s, %s, %s, 'video/mp4', %s)
                    """,
                    (
                        topic_id,
                        channel_id,
                        scene["sceneIndex"],
                        public_url,
                        key,
                        f"{topic_slug}-scene-{scene['sceneIndex']}.mp4",
                        rendered["fileSize"],
                    ),
                )
    except Exception:
        try:
            r2_client.delete_object(Bucket=bucket, Key=key)
        except Exception:
            pass
        raise

    for old_key in old_keys:
        if old_key != key:
            try:
                r2_client.delete_object(Bucket=bucket, Key=old_key)
            except Exception:
                pass

    return {
        **rendered,
        "videoUrl": public_url,
        "publicUrl": public_url,
        "key": key,
    }


@app.function(
    image=renderer_image,
    cpu=16.0,
    memory=32768,
    timeout=7200,
    retries=1,
    max_containers=1,
)
def render_all_job(payload: dict) -> dict:
    """One full video job runs in one large container."""
    (
        credentials,
        zoom_amount,
        pan_zoom,
        scenes,
        channel_slug,
        topic_slug,
    ) = validate_worker_payload(payload)

    fps = max(1, min(120, int(payload.get("fps", 60))))
    width = max(320, min(3840, int(payload.get("width", 1376))))
    height = max(240, min(2160, int(payload.get("height", 768))))
    render_concurrency = max(1, min(16, int(payload.get("renderConcurrency", 4))))
    download_concurrency = max(1, min(32, int(payload.get("downloadConcurrency", 12))))

    channel_id, topic_id = resolve_database_ids(
        credentials["DATABASE_URL"], channel_slug, topic_slug
    )
    r2_client = create_r2_client(credentials)
    bucket = credentials["CLOUDFLARE_R2_BUCKET_NAME"]
    job_dir = Path(tempfile.mkdtemp(prefix="modal-render-"))

    try:
        prepared = []
        results = []

        # Download all images/audio concurrently in this same container.
        with ThreadPoolExecutor(
            max_workers=min(download_concurrency, len(scenes))
        ) as pool:
            futures = {
                pool.submit(
                    prepare_scene,
                    scene,
                    index,
                    job_dir,
                    r2_client,
                    bucket,
                ): index
                for index, scene in enumerate(scenes, start=1)
            }
            for future in as_completed(futures):
                index = futures[future]
                try:
                    prepared.append(future.result())
                except Exception as exc:
                    results.append(
                        {
                            "success": False,
                            "sceneIndex": index,
                            "error": f"Asset preparation failed: {type(exc).__name__}",
                        }
                    )

        prepared.sort(key=lambda scene: scene["sceneIndex"])
        available_cpus = os.cpu_count() or 1
        threads_per_render = max(1, available_cpus // render_concurrency)

        def process_scene(scene):
            rendered = render_scene(
                scene,
                zoom_amount,
                pan_zoom,
                fps,
                width,
                height,
                threads_per_render,
            )
            return upload_and_update_database(
                rendered,
                scene,
                credentials,
                r2_client,
                channel_id,
                topic_id,
                channel_slug,
                topic_slug,
            )

        # Render several scenes in parallel in the same Modal container.
        if prepared:
            with ThreadPoolExecutor(
                max_workers=min(render_concurrency, len(prepared))
            ) as pool:
                futures = {pool.submit(process_scene, scene): scene for scene in prepared}
                for future in as_completed(futures):
                    scene = futures[future]
                    try:
                        results.append(future.result())
                    except subprocess.CalledProcessError:
                        results.append(
                            {
                                "success": False,
                                "sceneIndex": scene["sceneIndex"],
                                "error": "FFmpeg rendering failed",
                            }
                        )
                    except Exception as exc:
                        results.append(
                            {
                                "success": False,
                                "sceneIndex": scene["sceneIndex"],
                                "error": f"Scene processing failed: {type(exc).__name__}",
                            }
                        )

        results.sort(key=lambda item: item.get("sceneIndex", 0))
        completed = sum(1 for item in results if item.get("success"))
        return {
            "success": completed == len(scenes),
            "channelSlug": channel_slug,
            "topicSlug": topic_slug,
            "totalScenes": len(scenes),
            "completedVideos": completed,
            "failedVideos": len(scenes) - completed,
            "videos": results,
        }
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


@app.function(image=api_image, cpu=0.25, memory=512, timeout=300)
@modal.asgi_app()
def api():
    """FastAPI submission and polling service."""
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import JSONResponse
    from pydantic import (
        BaseModel,
        ConfigDict,
        Field,
        HttpUrl,
        SecretStr,
        field_validator,
        model_validator,
    )

    web = FastAPI(title="Faceless Video Renderer", version="1.0.0")

    class Credentials(BaseModel):
        model_config = ConfigDict(extra="forbid")
        DATABASE_URL: SecretStr
        CLOUDFLARE_R2_ACCOUNT_ID: SecretStr
        CLOUDFLARE_R2_ACCESS_KEY_ID: SecretStr
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: SecretStr
        CLOUDFLARE_R2_BUCKET_NAME: SecretStr
        CLOUDFLARE_R2_PUBLIC_URL: HttpUrl
        CLOUDFLARE_TOKEN_: SecretStr

        def plain(self):
            return {
                "DATABASE_URL": self.DATABASE_URL.get_secret_value(),
                "CLOUDFLARE_R2_ACCOUNT_ID": self.CLOUDFLARE_R2_ACCOUNT_ID.get_secret_value(),
                "CLOUDFLARE_R2_ACCESS_KEY_ID": self.CLOUDFLARE_R2_ACCESS_KEY_ID.get_secret_value(),
                "CLOUDFLARE_R2_SECRET_ACCESS_KEY": self.CLOUDFLARE_R2_SECRET_ACCESS_KEY.get_secret_value(),
                "CLOUDFLARE_R2_BUCKET_NAME": self.CLOUDFLARE_R2_BUCKET_NAME.get_secret_value(),
                "CLOUDFLARE_R2_PUBLIC_URL": str(self.CLOUDFLARE_R2_PUBLIC_URL).rstrip("/"),
                "CLOUDFLARE_TOKEN_": self.CLOUDFLARE_TOKEN_.get_secret_value(),
            }

    class KenBurns(BaseModel):
        model_config = ConfigDict(extra="forbid")
        direction: str = "zoom-in"

        @field_validator("direction")
        @classmethod
        def direction_must_be_supported(cls, value):
            normalize_direction(value)
            return value

    class Scene(BaseModel):
        model_config = ConfigDict(extra="allow")
        scene_number: int | None = Field(default=None, ge=1)
        scene_index: int | None = Field(default=None, ge=1)
        index: int | None = Field(default=None, ge=1)
        imageUrl: str | None = None
        imageKey: str | None = None
        visual_url: str | None = None
        audioUrl: str | None = None
        audioKey: str | None = None
        ken_burns: KenBurns = Field(default_factory=KenBurns)
        transition: str = "fade"

        @model_validator(mode="after")
        def assets_are_required(self):
            if not (self.imageUrl or self.imageKey or self.visual_url):
                raise ValueError("imageUrl, visual_url, or imageKey is required")
            if not (self.audioUrl or self.audioKey):
                raise ValueError("audioUrl or audioKey is required")
            normalize_transition(self.transition)
            return self

    class RenderRequest(BaseModel):
        model_config = ConfigDict(extra="forbid")
        credentials: Credentials
        KEN_BURNS_ZOOM_AMOUNT: float = Field(..., ge=0.02, le=0.30)
        KEN_BURNS_PAN_ZOOM: float = Field(..., gt=1.0, le=1.30)
        channelSlug: str = Field(min_length=1)
        topicSlug: str = Field(min_length=1)
        scenes: list[Scene] = Field(min_length=1)
        fps: int = Field(default=60, ge=1, le=120)
        width: int = Field(default=1376, ge=320, le=3840)
        height: int = Field(default=768, ge=240, le=2160)
        renderConcurrency: int = Field(default=4, ge=1, le=16)
        downloadConcurrency: int = Field(default=12, ge=1, le=32)

    @web.get("/health")
    async def health():
        return {"ok": True, "service": APP_NAME}

    @web.post("/render")
    async def submit(body: RenderRequest):
        # Never log the body: it contains credentials.
        payload = body.model_dump(mode="json", exclude={"credentials"})
        payload["credentials"] = body.credentials.plain()
        call = await render_all_job.spawn.aio(payload)
        return JSONResponse(
            status_code=202,
            content={
                "status": "submitted",
                "jobId": call.object_id,
                "statusPath": f"/jobs/{call.object_id}",
            },
        )

    @web.get("/jobs/{job_id}")
    async def status(job_id: str):
        try:
            call = modal.functions.FunctionCall.from_id(job_id)
            result = await call.get.aio(timeout=0)
        except TimeoutError:
            return JSONResponse(
                status_code=202,
                content={"status": "processing", "jobId": job_id},
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail="Render job failed. Inspect the Modal logs.",
            ) from exc
        return {"status": "completed", "jobId": job_id, "result": result}

    return web
