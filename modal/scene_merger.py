"""Standalone Modal service for merging rendered scene videos.

Local prerequisite: the Modal CLI only.

Deploy with:
    modal setup
    modal deploy scene_merger.py

FFmpeg and all Python dependencies are installed in Modal's remote images.
No database or Cloudflare credentials are stored as Modal secrets; they must be
sent in the HTTPS POST body for every merge request.
"""

import math
import shutil
import subprocess
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urlparse

import modal


APP_NAME = "faceless-scene-merger"
app = modal.App(APP_NAME)

# Installed remotely by Modal during deployment.
api_image = modal.Image.debian_slim(
    python_version="3.12"
).uv_pip_install(
    "fastapi[standard]>=0.115,<1",
    "pydantic>=2.9,<3",
)

merger_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .uv_pip_install(
        "boto3>=1.35,<2",
        "httpx>=0.27,<1",
        "psycopg[binary]>=3.2,<4",
    )
)


class MergeInputError(ValueError):
    """Raised when a merge request contains invalid input."""


def required_text(values: dict, key: str) -> str:
    value = values.get(key)

    if not isinstance(value, str) or not value.strip():
        raise MergeInputError(f"{key} is required")

    return value.strip()


def validate_credentials(payload: dict) -> dict:
    credentials = payload.get("credentials")

    if not isinstance(credentials, dict):
        raise MergeInputError("credentials is required")

    required_names = (
        "DATABASE_URL",
        "CLOUDFLARE_R2_ACCOUNT_ID",
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
        "CLOUDFLARE_R2_BUCKET_NAME",
        "CLOUDFLARE_R2_PUBLIC_URL",
        "CLOUDFLARE_TOKEN_",
    )

    return {
        name: required_text(credentials, name)
        for name in required_names
    }


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
        aws_access_key_id=credentials[
            "CLOUDFLARE_R2_ACCESS_KEY_ID"
        ],
        aws_secret_access_key=credentials[
            "CLOUDFLARE_R2_SECRET_ACCESS_KEY"
        ],
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            retries={
                "max_attempts": 4,
                "mode": "standard",
            },
        ),
    )


def resolve_database_ids(
    database_url: str,
    channel_slug: str,
    topic_slug: str,
):
    import psycopg

    with psycopg.connect(
        database_url,
        connect_timeout=20,
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id
                FROM channels
                WHERE slug = %s
                LIMIT 1
                """,
                (channel_slug,),
            )
            channel = cursor.fetchone()

            cursor.execute(
                """
                SELECT id
                FROM topics
                WHERE slug = %s
                LIMIT 1
                """,
                (topic_slug,),
            )
            topic = cursor.fetchone()

    if not channel:
        raise MergeInputError(
            f"Channel not found: {channel_slug}"
        )

    if not topic:
        raise MergeInputError(
            f"Topic not found: {topic_slug}"
        )

    return channel[0], topic[0]


def resolve_scene_number(
    scene: dict,
    fallback: int,
) -> int:
    value = (
        scene.get("scene_number")
        or scene.get("sceneIndex")
        or scene.get("scene_index")
        or scene.get("index")
        or fallback
    )

    try:
        value = int(value)
    except (TypeError, ValueError) as exc:
        raise MergeInputError(
            "Every scene number must be an integer"
        ) from exc

    if value < 1:
        raise MergeInputError(
            "Every scene number must be at least 1"
        )

    return value


def normalize_scene_videos(
    scene_videos: list,
) -> list:
    normalized = []
    used_scene_numbers = set()

    for fallback, scene in enumerate(
        scene_videos,
        start=1,
    ):
        if not isinstance(scene, dict):
            raise MergeInputError(
                "Every sceneVideos item must be an object"
            )

        scene_number = resolve_scene_number(
            scene,
            fallback,
        )

        if scene_number in used_scene_numbers:
            raise MergeInputError(
                f"Duplicate scene number: {scene_number}"
            )

        used_scene_numbers.add(scene_number)

        video_url = (
            scene.get("video_url")
            or scene.get("videoUrl")
            or scene.get("url")
            or ""
        )

        video_key = (
            scene.get("video_key")
            or scene.get("videoKey")
            or scene.get("key")
            or ""
        )

        if isinstance(video_url, str):
            video_url = video_url.strip()

        if isinstance(video_key, str):
            video_key = video_key.strip()

        if not video_url and not video_key:
            raise MergeInputError(
                f"Scene {scene_number} requires "
                "video_url, videoUrl, url, or key"
            )

        normalized.append(
            {
                "scene_number": scene_number,
                "video_url": video_url,
                "video_key": video_key,
            }
        )

    return sorted(
        normalized,
        key=lambda item: item["scene_number"],
    )


def fetch_scene_videos_from_database(
    database_url: str,
    topic_id,
    channel_id,
) -> list:
    import psycopg

    with psycopg.connect(
        database_url,
        connect_timeout=20,
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    scene_index,
                    file_url,
                    file_key
                FROM topic_assets
                WHERE topic_id = %s
                  AND channel_id = %s
                  AND asset_type = 'video'
                ORDER BY scene_index ASC
                """,
                (topic_id, channel_id),
            )

            rows = cursor.fetchall()

    scenes = [
        {
            "scene_number": row[0],
            "video_url": row[1] or "",
            "video_key": row[2] or "",
        }
        for row in rows
    ]

    if not scenes:
        return []

    return normalize_scene_videos(scenes)


def download_http(
    url: str,
    destination: Path,
):
    import httpx

    parsed = urlparse(url)

    if parsed.scheme not in {"http", "https"}:
        raise MergeInputError(
            "Scene video URLs must use HTTP or HTTPS"
        )

    timeout = httpx.Timeout(
        300.0,
        connect=30.0,
    )

    with httpx.stream(
        "GET",
        url,
        follow_redirects=True,
        timeout=timeout,
    ) as response:
        response.raise_for_status()

        with destination.open("wb") as output:
            for chunk in response.iter_bytes(
                chunk_size=1024 * 1024
            ):
                output.write(chunk)


def download_scene_video(
    scene: dict,
    destination: Path,
    r2_client,
    bucket: str,
):
    if scene.get("video_key"):
        r2_client.download_file(
            bucket,
            scene["video_key"],
            str(destination),
        )
    else:
        download_http(
            scene["video_url"],
            destination,
        )

    if (
        not destination.exists()
        or destination.stat().st_size == 0
    ):
        raise RuntimeError(
            f"Downloaded scene "
            f"{scene['scene_number']} is empty or missing"
        )

    return {
        "scene_number": scene["scene_number"],
        "local_path": destination,
        "size_bytes": destination.stat().st_size,
    }


def create_concat_file(
    downloaded_scenes: list,
    concat_path: Path,
):
    sorted_scenes = sorted(
        downloaded_scenes,
        key=lambda item: item["scene_number"],
    )

    lines = [
        f"file '{item['local_path'].as_posix()}'"
        for item in sorted_scenes
    ]

    concat_path.write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8",
    )


def output_dimensions(
    resolution: str,
):
    if resolution == "720p":
        return 1280, 720

    if resolution == "1080p":
        return 1920, 1080

    raise MergeInputError(
        "resolution must be 720p or 1080p"
    )


def run_ffmpeg_merge(
    concat_path: Path,
    output_path: Path,
    log_path: Path,
    resolution: str,
    fps: int,
    preset: str,
    crf: int,
    audio_bitrate: str,
    ffmpeg_threads: int,
):
    width, height = output_dimensions(resolution)

    scale_filter = (
        f"scale={width}:{height}:"
        "force_original_aspect_ratio=decrease:"
        "flags=lanczos,"
        f"pad={width}:{height}:"
        "(ow-iw)/2:(oh-ih)/2:"
        "color=black,"
        f"fps={fps},"
        "setsar=1,"
        "format=yuv420p"
    )

    command = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_path),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-vf",
        scale_filter,
        "-c:v",
        "libx264",
        "-threads:v",
        str(ffmpeg_threads),
        "-preset",
        preset,
        "-crf",
        str(crf),
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "high",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        audio_bitrate,
        "-ar",
        "44100",
        "-max_muxing_queue_size",
        "4096",
        str(output_path),
    ]

    with log_path.open("wb") as log_file:
        completed = subprocess.run(
            command,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            check=False,
        )

    if completed.returncode != 0:
        log_tail = log_path.read_text(
            encoding="utf-8",
            errors="replace",
        )[-6000:]

        raise RuntimeError(
            f"FFmpeg merge failed with exit code "
            f"{completed.returncode}. "
            f"Log tail:\n{log_tail}"
        )

    if (
        not output_path.exists()
        or output_path.stat().st_size == 0
    ):
        raise RuntimeError(
            "FFmpeg did not produce the merged output video"
        )


def get_video_duration(
    video_path: Path,
) -> float:
    completed = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    duration = float(completed.stdout.strip())

    if (
        not math.isfinite(duration)
        or duration <= 0
    ):
        raise RuntimeError(
            "Could not determine merged video duration"
        )

    return round(duration, 3)


def upload_master_video(
    output_path: Path,
    credentials: dict,
    r2_client,
    channel_slug: str,
    topic_slug: str,
    scene_count: int,
    duration: float,
    resolution: str,
):
    bucket = credentials[
        "CLOUDFLARE_R2_BUCKET_NAME"
    ]

    timestamp = int(time.time() * 1000)
    suffix = uuid.uuid4().hex[:8]

    file_name = (
        f"{topic_slug}-master-"
        f"{resolution}-{timestamp}-{suffix}.mp4"
    )

    key = (
        f"channels/{channel_slug}/"
        f"topics/{topic_slug}/"
        f"master/{file_name}"
    )

    public_url = (
        f"{credentials['CLOUDFLARE_R2_PUBLIC_URL'].rstrip('/')}/"
        f"{quote(key, safe='/')}"
    )

    r2_client.upload_file(
        str(output_path),
        bucket,
        key,
        ExtraArgs={
            "ContentType": "video/mp4",
            "Metadata": {
                "channelSlug": channel_slug,
                "topicSlug": topic_slug,
                "type": "master_video",
                "sceneCount": str(scene_count),
                "duration": str(duration),
                "resolution": resolution,
            },
        },
    )

    return {
        "key": key,
        "public_url": public_url,
        "file_name": file_name,
        "size_bytes": output_path.stat().st_size,
    }


def replace_master_database_record(
    credentials: dict,
    r2_client,
    channel_id,
    topic_id,
    upload: dict,
):
    import psycopg

    database_url = credentials["DATABASE_URL"]

    bucket = credentials[
        "CLOUDFLARE_R2_BUCKET_NAME"
    ]

    old_keys = []

    try:
        with psycopg.connect(
            database_url,
            connect_timeout=20,
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT file_key
                    FROM topic_assets
                    WHERE topic_id = %s
                      AND channel_id = %s
                      AND asset_type = 'completedvideo'
                    """,
                    (topic_id, channel_id),
                )

                old_keys = [
                    row[0]
                    for row in cursor.fetchall()
                    if row[0]
                ]

                cursor.execute(
                    """
                    DELETE FROM topic_assets
                    WHERE topic_id = %s
                      AND channel_id = %s
                      AND asset_type = 'completedvideo'
                    """,
                    (topic_id, channel_id),
                )

                cursor.execute(
                    """
                    INSERT INTO topic_assets (
                        topic_id,
                        channel_id,
                        asset_type,
                        file_url,
                        file_key,
                        file_name,
                        mime_type,
                        size_bytes
                    )
                    VALUES (
                        %s,
                        %s,
                        'completedvideo',
                        %s,
                        %s,
                        %s,
                        'video/mp4',
                        %s
                    )
                    """,
                    (
                        topic_id,
                        channel_id,
                        upload["public_url"],
                        upload["key"],
                        upload["file_name"],
                        upload["size_bytes"],
                    ),
                )

                cursor.execute(
                    """
                    UPDATE topics
                    SET master_video_url = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (
                        upload["public_url"],
                        topic_id,
                    ),
                )

    except Exception:
        # Database did not adopt the new upload.
        # Remove the new orphaned R2 object.
        try:
            r2_client.delete_object(
                Bucket=bucket,
                Key=upload["key"],
            )
        except Exception:
            pass

        raise

    # Delete old masters only after the new
    # database transaction has committed.
    for old_key in old_keys:
        if old_key == upload["key"]:
            continue

        try:
            r2_client.delete_object(
                Bucket=bucket,
                Key=old_key,
            )
        except Exception:
            # The database already references the new master.
            # An old orphan is safer than deleting the new result.
            pass


@app.function(
    image=merger_image,
    cpu=16.0,
    memory=65536,
    timeout=7200,
    retries=1,

    # Only one large merge-worker container can run.
    # Additional jobs wait for this container.
    max_containers=1,
)
def merge_all_job(
    payload: dict,
) -> dict:
    """Merge one complete topic in one Modal container."""

    credentials = validate_credentials(payload)

    channel_slug = required_text(
        payload,
        "channelSlug",
    )

    topic_slug = required_text(
        payload,
        "topicSlug",
    )

    resolution = str(
        payload.get("resolution", "1080p")
    ).strip().lower()

    output_dimensions(resolution)

    fps = max(
        1,
        min(
            120,
            int(payload.get("fps", 60)),
        ),
    )

    download_concurrency = max(
        1,
        min(
            32,
            int(
                payload.get(
                    "downloadConcurrency",
                    8,
                )
            ),
        ),
    )

    ffmpeg_threads = max(
        1,
        min(
            32,
            int(
                payload.get(
                    "ffmpegThreads",
                    16,
                )
            ),
        ),
    )

    preset = str(
        payload.get("preset", "veryfast")
    ).strip().lower()

    allowed_presets = {
        "ultrafast",
        "superfast",
        "veryfast",
        "faster",
        "fast",
        "medium",
        "slow",
    }

    if preset not in allowed_presets:
        raise MergeInputError(
            f"Unsupported FFmpeg preset: {preset}"
        )

    crf = int(payload.get("crf", 19))

    if not 0 <= crf <= 51:
        raise MergeInputError(
            "crf must be between 0 and 51"
        )

    audio_bitrate = str(
        payload.get("audioBitrate", "192k")
    ).strip().lower()

    allowed_audio_bitrates = {
        "96k",
        "128k",
        "160k",
        "192k",
        "256k",
        "320k",
    }

    if audio_bitrate not in allowed_audio_bitrates:
        raise MergeInputError(
            "Unsupported audioBitrate"
        )

    channel_id, topic_id = resolve_database_ids(
        credentials["DATABASE_URL"],
        channel_slug,
        topic_slug,
    )

    supplied_scenes = (
        payload.get("sceneVideos") or []
    )

    if supplied_scenes:
        scenes = normalize_scene_videos(
            supplied_scenes
        )
    else:
        scenes = fetch_scene_videos_from_database(
            credentials["DATABASE_URL"],
            topic_id,
            channel_id,
        )

    if not scenes:
        raise MergeInputError(
            f"No rendered scene videos were found "
            f"for topic: {topic_slug}"
        )

    r2_client = create_r2_client(credentials)

    bucket = credentials[
        "CLOUDFLARE_R2_BUCKET_NAME"
    ]

    job_dir = Path(
        tempfile.mkdtemp(
            prefix="modal-scene-merge-"
        )
    )

    try:
        downloads_dir = job_dir / "scenes"

        downloads_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        downloaded = []

        # Every download runs concurrently inside
        # this same Modal worker container.
        with ThreadPoolExecutor(
            max_workers=min(
                download_concurrency,
                len(scenes),
            )
        ) as pool:
            futures = {}

            for scene in scenes:
                local_path = downloads_dir / (
                    f"scene-"
                    f"{scene['scene_number']:06d}.mp4"
                )

                future = pool.submit(
                    download_scene_video,
                    scene,
                    local_path,
                    r2_client,
                    bucket,
                )

                futures[future] = scene[
                    "scene_number"
                ]

            for future in as_completed(futures):
                scene_number = futures[future]

                try:
                    downloaded.append(
                        future.result()
                    )
                except Exception as exc:
                    raise RuntimeError(
                        f"Failed to download scene "
                        f"{scene_number}: "
                        f"{type(exc).__name__}: {exc}"
                    ) from exc

        downloaded.sort(
            key=lambda item: item["scene_number"]
        )

        concat_path = (
            job_dir / "concat-list.txt"
        )

        output_path = (
            job_dir / "merged-master.mp4"
        )

        ffmpeg_log_path = (
            job_dir / "ffmpeg.log"
        )

        create_concat_file(
            downloaded,
            concat_path,
        )

        run_ffmpeg_merge(
            concat_path=concat_path,
            output_path=output_path,
            log_path=ffmpeg_log_path,
            resolution=resolution,
            fps=fps,
            preset=preset,
            crf=crf,
            audio_bitrate=audio_bitrate,
            ffmpeg_threads=ffmpeg_threads,
        )

        duration = get_video_duration(
            output_path
        )

        upload = upload_master_video(
            output_path=output_path,
            credentials=credentials,
            r2_client=r2_client,
            channel_slug=channel_slug,
            topic_slug=topic_slug,
            scene_count=len(scenes),
            duration=duration,
            resolution=resolution,
        )

        replace_master_database_record(
            credentials=credentials,
            r2_client=r2_client,
            channel_id=channel_id,
            topic_id=topic_id,
            upload=upload,
        )

        return {
            "success": True,
            "channelSlug": channel_slug,
            "topicSlug": topic_slug,
            "videoUrl": upload["public_url"],
            "publicUrl": upload["public_url"],
            "key": upload["key"],
            "fileName": upload["file_name"],
            "duration": duration,
            "sceneCount": len(scenes),
            "sceneOrder": [
                scene["scene_number"]
                for scene in scenes
            ],
            "sizeBytes": upload["size_bytes"],
            "resolution": resolution,
            "fps": fps,
        }

    finally:
        shutil.rmtree(
            job_dir,
            ignore_errors=True,
        )


@app.function(
    image=api_image,
    cpu=0.25,
    memory=512,
    timeout=300,
    max_containers=1,
)
@modal.asgi_app()
def api():
    """FastAPI submission and polling service."""

    from typing import Literal

    from fastapi import FastAPI, HTTPException
    from fastapi.responses import JSONResponse
    from pydantic import (
        BaseModel,
        ConfigDict,
        Field,
        HttpUrl,
        SecretStr,
        model_validator,
    )

    web = FastAPI(
        title="Faceless Scene Merger",
        version="1.0.0",
    )

    class Credentials(BaseModel):
        model_config = ConfigDict(
            extra="forbid"
        )

        DATABASE_URL: SecretStr
        CLOUDFLARE_R2_ACCOUNT_ID: SecretStr
        CLOUDFLARE_R2_ACCESS_KEY_ID: SecretStr
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: SecretStr
        CLOUDFLARE_R2_BUCKET_NAME: SecretStr
        CLOUDFLARE_R2_PUBLIC_URL: HttpUrl
        CLOUDFLARE_TOKEN_: SecretStr

        def plain(self):
            return {
                "DATABASE_URL":
                    self.DATABASE_URL.get_secret_value(),

                "CLOUDFLARE_R2_ACCOUNT_ID":
                    self.CLOUDFLARE_R2_ACCOUNT_ID
                    .get_secret_value(),

                "CLOUDFLARE_R2_ACCESS_KEY_ID":
                    self.CLOUDFLARE_R2_ACCESS_KEY_ID
                    .get_secret_value(),

                "CLOUDFLARE_R2_SECRET_ACCESS_KEY":
                    self.CLOUDFLARE_R2_SECRET_ACCESS_KEY
                    .get_secret_value(),

                "CLOUDFLARE_R2_BUCKET_NAME":
                    self.CLOUDFLARE_R2_BUCKET_NAME
                    .get_secret_value(),

                "CLOUDFLARE_R2_PUBLIC_URL":
                    str(
                        self.CLOUDFLARE_R2_PUBLIC_URL
                    ).rstrip("/"),

                "CLOUDFLARE_TOKEN_":
                    self.CLOUDFLARE_TOKEN_
                    .get_secret_value(),
            }

    class SceneVideo(BaseModel):
        model_config = ConfigDict(
            extra="forbid"
        )

        scene_number: int | None = Field(
            default=None,
            ge=1,
        )

        sceneIndex: int | None = Field(
            default=None,
            ge=1,
        )

        scene_index: int | None = Field(
            default=None,
            ge=1,
        )

        index: int | None = Field(
            default=None,
            ge=1,
        )

        video_url: str | None = None
        videoUrl: str | None = None
        url: str | None = None

        video_key: str | None = None
        videoKey: str | None = None
        key: str | None = None

        @model_validator(mode="after")
        def source_is_required(self):
            if not (
                self.video_url
                or self.videoUrl
                or self.url
                or self.video_key
                or self.videoKey
                or self.key
            ):
                raise ValueError(
                    "A video URL or R2 key is required"
                )

            return self

    class MergeRequest(BaseModel):
        model_config = ConfigDict(
            extra="forbid"
        )

        credentials: Credentials

        channelSlug: str = Field(
            min_length=1
        )

        topicSlug: str = Field(
            min_length=1
        )

        # Empty means: load all scene videos
        # from topic_assets in Neon.
        sceneVideos: list[SceneVideo] = Field(
            default_factory=list
        )

        resolution: Literal[
            "720p",
            "1080p",
        ] = "1080p"

        fps: int = Field(
            default=60,
            ge=1,
            le=120,
        )

        downloadConcurrency: int = Field(
            default=8,
            ge=1,
            le=32,
        )

        ffmpegThreads: int = Field(
            default=16,
            ge=1,
            le=32,
        )

        preset: Literal[
            "ultrafast",
            "superfast",
            "veryfast",
            "faster",
            "fast",
            "medium",
            "slow",
        ] = "veryfast"

        crf: int = Field(
            default=19,
            ge=0,
            le=51,
        )

        audioBitrate: Literal[
            "96k",
            "128k",
            "160k",
            "192k",
            "256k",
            "320k",
        ] = "192k"

    @web.get("/health")
    async def health():
        return {
            "ok": True,
            "service": APP_NAME,
        }

    @web.post("/merge")
    async def submit(
        body: MergeRequest,
    ):
        # Never log the body because it
        # contains database/R2 credentials.
        payload = body.model_dump(
            mode="json",
            exclude={"credentials"},
        )

        payload["credentials"] = (
            body.credentials.plain()
        )

        call = await merge_all_job.spawn.aio(
            payload
        )

        return JSONResponse(
            status_code=202,
            content={
                "status": "submitted",
                "jobId": call.object_id,
                "statusPath":
                    f"/jobs/{call.object_id}",
            },
        )

    @web.get("/jobs/{job_id}")
    async def status(
        job_id: str,
    ):
        try:
            call = (
                modal.functions.FunctionCall
                .from_id(job_id)
            )

            result = await call.get.aio(
                timeout=0
            )

        except TimeoutError:
            return JSONResponse(
                status_code=202,
                content={
                    "status": "processing",
                    "jobId": job_id,
                },
            )

        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Merge job failed. "
                    "Inspect the Modal logs."
                ),
            ) from exc

        return {
            "status": "completed",
            "jobId": job_id,
            "result": result,
        }

    return web