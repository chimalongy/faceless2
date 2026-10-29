"""Fish Audio S2 Pro Text-to-Speech & Voice Cloning on Modal.

Repurposed for Faceless 2.0. Supports zero-shot voice cloning from reference

audio clips and speech generation from created voice profiles or ad-hoc prompts.

Features:

- Dual-mode voice registration: accepts JSON (Base64 audio) or multipart/form-data.

- Dual-mode speech generation: accepts JSON ({voice_name, text, language}) or multipart.

- High-speed GPU synthesis via persistent s2.cpp backend with CLI fallback.

- Reusable .s2voice profiles stored on persistent Modal Volume.

- Reference audio streaming for dashboard playback (/voices/{name}/reference-audio).

- Compatible with Faceless 2.0 voice-cloner client and trigger pipeline.

Deployment:

    modal setup

    modal run modal/fish_s2_modal.py::download_model

    modal deploy modal/fish_s2_modal.py

Testing (dev ephemeral):

    modal serve modal/fish_s2_modal.py

"""

from pathlib import Path

import asyncio

import base64

import hashlib

import io

import json

import os

import re

import shutil

import socket

import subprocess

import tempfile

import threading

import time

from datetime import datetime, timezone

import modal

APP_NAME = "faceless-fish-s2-tts"

MODEL_REPO = "rodrigomt/s2-pro-gguf"

MODEL_NAME = "s2-pro-q8_0.gguf"

MODEL_DIR = Path("/models")

MODEL_PATH = MODEL_DIR / MODEL_NAME

TOKENIZER_PATH = MODEL_DIR / "tokenizer.json"

VOICE_DIR = Path("/voices")

BACKEND_PORT = 3031

MAX_REFERENCE_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB max

app = modal.App(APP_NAME)

model_volume = modal.Volume.from_name(

    "fish-s2-pro-model",

    create_if_missing=True,

)

voice_volume = modal.Volume.from_name(

    "fish-s2-pro-voices",

    create_if_missing=True,

)

image = (

    modal.Image.from_registry(

        "nvidia/cuda:12.4.1-devel-ubuntu22.04",

        add_python="3.11",

    )

    .apt_install(

        "build-essential",

        "ca-certificates",

        "cmake",

        "git",

        "ffmpeg",

    )

    .uv_pip_install(

        "huggingface_hub",

        "fastapi[standard]",

        "python-multipart",

        "requests",

        "soundfile",

        "numpy",

    )

    .run_commands(

        "git clone --recurse-submodules "

        "https://github.com/rodrigomatta/s2.cpp /opt/s2.cpp",

        # Satisfy linker libcuda lookup during build

        "ln -sf libcuda.so /usr/local/cuda/lib64/stubs/libcuda.so.1",

        "cmake -S /opt/s2.cpp -B /opt/s2.cpp/build "

        "-DCMAKE_BUILD_TYPE=Release "

        "-DS2_CUDA=ON "

        "-DCMAKE_CUDA_ARCHITECTURES=75 "

        "-DCMAKE_EXE_LINKER_FLAGS=-Wl,-rpath-link,/usr/local/cuda/lib64/stubs",

        "cmake --build /opt/s2.cpp/build --parallel 4",

    )

)

@app.function(

    image=image,

    volumes={"/models": model_volume},

    timeout=1800,

)

def download_model():

    """Helper to pre-download model weights and tokenizer into the Modal volume."""

    from huggingface_hub import hf_hub_download

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    if not MODEL_PATH.exists():

        print(f"Downloading {MODEL_NAME} from {MODEL_REPO}...")

        hf_hub_download(

            repo_id=MODEL_REPO,

            filename=MODEL_NAME,

            local_dir=str(MODEL_DIR),

        )

        print("Model weights downloaded successfully.")

    else:

        print("Model weights already exist in volume.")

    if not TOKENIZER_PATH.exists():

        print(f"Downloading tokenizer.json from {MODEL_REPO}...")

        hf_hub_download(

            repo_id=MODEL_REPO,

            filename="tokenizer.json",

            local_dir=str(MODEL_DIR),

        )

        print("Tokenizer downloaded successfully.")

    else:

        print("Tokenizer already exists in volume.")

    model_volume.commit()

    print("Model volume committed.")

@app.function(

    image=image,

    gpu="T4",

    volumes={"/models": model_volume, "/voices": voice_volume},

    timeout=3600,

    startup_timeout=1800,

    max_containers=1,

)

@modal.asgi_app(requires_proxy_auth=False)

def serve():

    import soundfile as sf

    from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile

    from fastapi.middleware.cors import CORSMiddleware

    from fastapi.responses import JSONResponse

    from huggingface_hub import hf_hub_download

    import requests

    web_app = FastAPI(

        title="Faceless 2.0 - Fish Audio S2 Pro Voice Cloner & TTS",

        version="2.0.0",

        docs_url="/docs",

        redoc_url=None,

    )

    # Enable CORS for Next.js browser & API clients

    web_app.add_middleware(

        CORSMiddleware,

        allow_origins=["*"],

        allow_credentials=True,

        allow_methods=["*"],

        allow_headers=["*"],

    )

    state = {"backend": None}

    request_lock = threading.Lock()

    binary = "/opt/s2.cpp/build/s2"

    def is_backend_listening() -> bool:

        try:

            with socket.create_connection(("127.0.0.1", BACKEND_PORT), timeout=0.5):

                return True

        except OSError:

            return False

    def start_backend():

        process = state["backend"]

        if process is not None and process.poll() is None and is_backend_listening():

            return

        print(f"[Fish-S2] Starting s2 backend server on 127.0.0.1:{BACKEND_PORT}...")

        state["backend"] = subprocess.Popen(

            [

                binary,

                "--model",

                str(MODEL_PATH),

                "--tokenizer",

                str(TOKENIZER_PATH),

                "--cuda",

                "0",

                "--voice-dir",

                str(VOICE_DIR),

                "--server",

                "--host",

                "127.0.0.1",

                "--port",

                str(BACKEND_PORT),

            ]

        )

        deadline = time.monotonic() + 1800

        while time.monotonic() < deadline:

            process = state["backend"]

            if process.poll() is not None:

                raise RuntimeError("The s2 inference server exited prematurely during startup.")

            if is_backend_listening():

                print(f"[Fish-S2] s2 backend server is listening on port {BACKEND_PORT}.")

                return

            time.sleep(1)

        raise TimeoutError("The s2 inference server did not become ready within 30 minutes.")

    def stop_backend():

        process = state["backend"]

        if process is None or process.poll() is not None:

            state["backend"] = None

            return

        print("[Fish-S2] Stopping s2 backend server...")

        process.terminate()

        try:

            process.wait(timeout=30)

        except subprocess.TimeoutExpired:

            process.kill()

            process.wait(timeout=15)

        state["backend"] = None

        print("[Fish-S2] s2 backend server stopped.")

    @web_app.on_event("startup")

    def initialize():

        MODEL_DIR.mkdir(parents=True, exist_ok=True)

        VOICE_DIR.mkdir(parents=True, exist_ok=True)

        if not MODEL_PATH.exists():

            print(f"[Fish-S2] Downloading model {MODEL_NAME}...")

            hf_hub_download(

                repo_id=MODEL_REPO,

                filename=MODEL_NAME,

                local_dir=str(MODEL_DIR),

            )

        if not TOKENIZER_PATH.exists():

            print("[Fish-S2] Downloading tokenizer.json...")

            hf_hub_download(

                repo_id=MODEL_REPO,

                filename="tokenizer.json",

                local_dir=str(MODEL_DIR),

            )

        model_volume.commit()

        voice_volume.commit()

        start_backend()

    @web_app.on_event("shutdown")

    def shutdown():

        stop_backend()

    def sanitize_voice_name(name: str) -> str:

        clean = re.sub(r"[^A-Za-z0-9_-]", "_", name.strip())

        return clean[:64] if clean else "voice"

    def normalize_audio_to_wav(audio_bytes: bytes, max_duration_sec: float = 20.0) -> bytes:

        """Decode reference audio, convert to mono 44.1kHz, clamp to max_duration, and re-encode to 16-bit PCM WAV.

        Clamping to <=20s prevents GGML CUDA grid_y < USHRT_MAX assertion failures in s2.cpp.

        """

        with tempfile.NamedTemporaryFile(suffix=".tmp", delete=False) as src:

            src.write(audio_bytes)

            src_path = src.name

        dst_path = src_path + ".wav"

        try:

            cmd = [

                "ffmpeg",

                "-y",

                "-v",

                "error",

                "-i",

                src_path,

                "-t",

                str(max_duration_sec),

                "-ac",

                "1",

                "-ar",

                "44100",

                "-af",

                f"afade=t=out:st={max(0.0, max_duration_sec - 0.5)}:d=0.5",

                dst_path,

            ]

            subprocess.run(cmd, check=True, timeout=30)

            return Path(dst_path).read_bytes()

        except Exception:

            try:

                waveform, sample_rate = sf.read(

                    io.BytesIO(audio_bytes), dtype="float32", always_2d=False

                )

                if waveform.ndim > 1:

                    waveform = waveform.mean(axis=1)

                max_samples = int(max_duration_sec * sample_rate)

                if len(waveform) > max_samples:

                    waveform = waveform[:max_samples]

                out = io.BytesIO()

                sf.write(out, waveform, sample_rate, format="WAV", subtype="PCM_16")

                return out.getvalue()

            except Exception as exc:

                raise RuntimeError(f"Failed to decode and normalize audio: {exc}") from exc

        finally:

            Path(src_path).unlink(missing_ok=True)

            Path(dst_path).unlink(missing_ok=True)

    def _prepare_reference_clip(

        ref_wav_path: Path, ref_text: str, max_duration_sec: float = 20.0

    ):

        """Ensure reference audio is mono, 44.1kHz, and <= max_duration_sec to prevent GGML CUDA grid overflow."""

        try:

            info = sf.info(str(ref_wav_path))

            needs_trim = (

                info.duration > (max_duration_sec + 0.5)

                or info.channels > 1

                or info.samplerate != 44100

            )

        except Exception:

            needs_trim = True

        if not needs_trim:

            return ref_wav_path, ref_text, None

        fd, temp_name = tempfile.mkstemp(suffix=".wav")

        os.close(fd)

        temp_wav = Path(temp_name)

        try:

            cmd = [

                "ffmpeg",

                "-y",

                "-v",

                "error",

                "-i",

                str(ref_wav_path),

                "-t",

                str(max_duration_sec),

                "-ac",

                "1",

                "-ar",

                "44100",

                "-af",

                f"afade=t=out:st={max(0.0, max_duration_sec - 0.5)}:d=0.5",

                str(temp_wav),

            ]

            subprocess.run(cmd, check=True, timeout=30)

            words = ref_text.strip().split()

            max_words = int(max_duration_sec * 3.0)

            if len(words) > max_words:

                trimmed_text = " ".join(words[:max_words])

                for end_char in [".", "!", "?", ","]:

                    last_idx = trimmed_text.rfind(end_char)

                    if last_idx > len(trimmed_text) * 0.7:

                        trimmed_text = trimmed_text[: last_idx + 1]

                        break

            else:

                trimmed_text = ref_text.strip()

            return temp_wav, trimmed_text, temp_wav

        except Exception as e:

            print(f"[Fish-S2] Warning: failed to trim reference audio via ffmpeg: {e}")

            temp_wav.unlink(missing_ok=True)

            return ref_wav_path, ref_text, None

    def locate_voice(target_name: str, reload_volume: bool = True):

        """Find voice directory and files by case-insensitive name matching."""

        if reload_volume:

            try:

                voice_volume.reload()

            except Exception:

                pass

        clean_name = sanitize_voice_name(target_name)

        # 1. Direct folder match

        direct_dir = VOICE_DIR / clean_name

        if direct_dir.is_dir():

            return clean_name, direct_dir

        # 2. Search all folders by metadata

        if VOICE_DIR.exists():

            for folder in VOICE_DIR.iterdir():

                if folder.is_dir():

                    meta_file = folder / "metadata.json"

                    if meta_file.is_file():

                        try:

                            meta = json.loads(meta_file.read_text(encoding="utf-8"))

                            if meta.get("voice_name", "").casefold() == target_name.casefold():

                                return meta.get("voice_name", folder.name), folder

                        except Exception:

                            pass

                    if folder.name.casefold() == target_name.casefold():

                        return folder.name, folder

        # 3. Check legacy flat .s2voice file

        legacy_s2voice = VOICE_DIR / f"{clean_name}.s2voice"

        if legacy_s2voice.is_file():

            return clean_name, VOICE_DIR

        return None, None

    # =========================================================================

    # ENDPOINTS: Health & Info

    # =========================================================================

    @web_app.get("/")

    @web_app.get("/health")

    def health():

        voice_count = 0

        try:

            voice_volume.reload()

            if VOICE_DIR.exists():

                voice_count = sum(

                    1

                    for e in VOICE_DIR.iterdir()

                    if (e.is_dir() and (e / "metadata.json").is_file())

                    or e.name.endswith(".s2voice")

                )

        except Exception:

            pass

        return JSONResponse(

            {

                "status": "ok",

                "service": "Fish Audio S2 Pro Voice Cloner & TTS",

                "model": f"{MODEL_REPO} ({MODEL_NAME})",

                "voices_registered": voice_count,

                "backend_online": is_backend_listening(),

            }

        )

    # =========================================================================

    # ENDPOINTS: List & Retrieve Voices

    # =========================================================================

    @web_app.get("/voices")

    @web_app.get("/list-clones")

    def list_voices():

        voice_volume.reload()

        if not VOICE_DIR.exists():

            return {"voices": [], "count": 0}

        seen_names = set()

        voices = []

        for entry in VOICE_DIR.iterdir():

            if entry.is_dir():

                meta_file = entry / "metadata.json"

                ref_wav = entry / "reference.wav"

                profile_file = entry / "profile.s2voice"

                fallback_profile = VOICE_DIR / f"{entry.name}.s2voice"

                voice_name = entry.name

                ref_text = ""

                created_at = ""

                if meta_file.is_file():

                    try:

                        meta = json.loads(meta_file.read_text(encoding="utf-8"))

                        voice_name = meta.get("voice_name", entry.name)

                        ref_text = meta.get("ref_text", "")

                        created_at = meta.get("created_at", "")

                    except Exception:

                        pass

                has_audio = ref_wav.is_file()

                audio_bytes = ref_wav.stat().st_size if has_audio else 0

                has_profile = profile_file.is_file() or fallback_profile.is_file()

                seen_names.add(voice_name.casefold())

                voices.append(

                    {

                        "voice_name": voice_name,

                        "ref_text": ref_text,

                        "created_at": created_at,

                        "has_reference_audio": has_audio,

                        "reference_audio_bytes": audio_bytes,

                        "has_profile": has_profile,

                        "engine": "fish-s2-pro",

                    }

                )

            elif entry.name.endswith(".s2voice"):

                stem = entry.stem

                if stem.casefold() not in seen_names:

                    seen_names.add(stem.casefold())

                    voices.append(

                        {

                            "voice_name": stem,

                            "ref_text": "",

                            "created_at": "",

                            "has_reference_audio": False,

                            "reference_audio_bytes": 0,

                            "has_profile": True,

                            "engine": "fish-s2-pro",

                        }

                    )

        voices.sort(key=lambda v: (v.get("created_at") or ""), reverse=True)

        return {"voices": voices, "count": len(voices)}

    @web_app.get("/voices/{voice_name}/reference-audio")

    def get_reference_audio(voice_name: str):

        canonical_name, voice_folder = locate_voice(voice_name)

        if not voice_folder:

            raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found.")

        ref_file = voice_folder / "reference.wav"

        if not ref_file.is_file():

            # Check if reference is in VOICE_DIR directly

            flat_ref = VOICE_DIR / f"{canonical_name}.wav"

            if flat_ref.is_file():

                ref_file = flat_ref

            else:

                raise HTTPException(

                    status_code=404,

                    detail=f"No reference audio found for voice '{voice_name}'.",

                )

        return Response(

            content=ref_file.read_bytes(),

            media_type="audio/wav",

            headers={

                "Content-Disposition": f'inline; filename="{canonical_name}-reference.wav"',

                "Cache-Control": "public, max-age=3600",

            },

        )

    # =========================================================================

    # ENDPOINTS: Register / Clone Voice

    # =========================================================================

    def _process_voice_registration(

        voice_name: str, ref_text: str, audio_bytes: bytes

    ) -> dict:

        clean_name = sanitize_voice_name(voice_name)

        if not clean_name:

            raise HTTPException(status_code=400, detail="A valid voice_name is required.")

        if not ref_text.strip():

            raise HTTPException(status_code=400, detail="ref_text (transcript) is required.")

        if not audio_bytes:

            raise HTTPException(status_code=400, detail="Reference audio data is required.")

        if len(audio_bytes) > MAX_REFERENCE_AUDIO_BYTES:

            raise HTTPException(

                status_code=413, detail="Reference audio must be 25 MB or smaller."

            )

        normalized_wav = normalize_audio_to_wav(audio_bytes)

        voice_dir = VOICE_DIR / clean_name

        voice_dir.mkdir(parents=True, exist_ok=True)

        ref_path = voice_dir / "reference.wav"

        ref_path.write_bytes(normalized_wav)

        created_at = datetime.now(timezone.utc).isoformat()

        metadata = {

            "voice_name": voice_name.strip(),

            "clean_name": clean_name,

            "ref_text": ref_text.strip(),

            "created_at": created_at,

            "engine": "fish-s2-pro",

        }

        (voice_dir / "metadata.json").write_text(

            json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"

        )

        # Build reusable .s2voice profile using CLI

        with request_lock:

            stop_backend()

            output_fd, output_name = tempfile.mkstemp(suffix=".wav")

            os.close(output_fd)

            dummy_out = Path(output_name)

            try:

                command = [

                    binary,

                    "--model",

                    str(MODEL_PATH),

                    "--tokenizer",

                    str(TOKENIZER_PATH),

                    "--cuda",

                    "0",

                    "--prompt-audio",

                    str(ref_path),

                    "--prompt-text",

                    ref_text.strip(),

                    "--voice",

                    clean_name,

                    "--voice-dir",

                    str(VOICE_DIR),

                    "--save-voice",

                    "--text",

                    "Voice calibrated.",

                    "--output",

                    str(dummy_out),

                ]

                print(f"[Fish-S2] Generating .s2voice profile for '{clean_name}'...")

                res = subprocess.run(

                    command,

                    capture_output=True,

                    text=True,

                    timeout=600,

                )

                root_profile = VOICE_DIR / f"{clean_name}.s2voice"

                if res.returncode != 0 or not root_profile.exists():

                    err_msg = (res.stderr or res.stdout or "s2 CLI failed to build profile")[-3000:]

                    print(f"[Fish-S2] Profile error: {err_msg}")

                    # Even if binary .s2voice creation fails, we have reference.wav + ref_text

                    # which allows zero-shot synthesis via the backend server

                if root_profile.exists():

                    shutil.copyfile(root_profile, voice_dir / "profile.s2voice")

                voice_volume.commit()

                print(f"[Fish-S2] Voice '{clean_name}' registered successfully.")

                return {

                    "success": True,

                    "message": f"Voice profile '{voice_name}' is registered and ready to use.",

                    "voice_name": voice_name.strip(),

                    "clean_name": clean_name,

                    "ref_text": ref_text.strip(),

                    "created_at": created_at,

                }

            finally:

                dummy_out.unlink(missing_ok=True)

                start_backend()

    @web_app.post("/new-clone")

    @web_app.post("/create-clone")

    async def new_clone_json(request: Request):

        """JSON payload handler matching Faceless 2.0 voice-cloner client."""

        try:

            await voice_volume.reload.aio()

        except Exception:

            pass

        content_type = request.headers.get("content-type", "")

        if "multipart/form-data" in content_type:

            form = await request.form()

            name = str(form.get("voice_name") or form.get("voiceName") or form.get("name") or "").strip()

            text = str(form.get("ref_text") or form.get("refText") or form.get("reference_text") or "").strip()

            file_item = form.get("reference") or form.get("audioFile") or form.get("file")

            if not file_item:

                raise HTTPException(status_code=400, detail="Reference audio file is required.")

            audio_bytes = await file_item.read()

            return _process_voice_registration(name, text, audio_bytes)

        # Handle JSON

        try:

            data = await request.json()

        except Exception:

            raise HTTPException(status_code=400, detail="Invalid JSON body.")

        name = str(data.get("voice_name") or data.get("voiceName") or "").strip()

        text = str(data.get("ref_text") or data.get("refText") or "").strip()

        encoded = data.get("ref_audio_base64") or data.get("refAudioBase64") or ""

        if not name:

            raise HTTPException(status_code=400, detail="voice_name is required.")

        if not text:

            raise HTTPException(status_code=400, detail="ref_text is required.")

        if not encoded:

            raise HTTPException(status_code=400, detail="ref_audio_base64 is required.")

        try:

            audio_bytes = base64.b64decode(encoded, validate=True)

        except Exception as exc:

            raise HTTPException(

                status_code=400, detail="ref_audio_base64 must be valid Base64 data."

            ) from exc

        return _process_voice_registration(name, text, audio_bytes)

    @web_app.post("/register-voice")

    def register_voice_form(

        name: str = Form(...),

        reference_text: str = Form(...),

        reference: UploadFile = File(...),

    ):

        """Multipart form endpoint compatible with legacy callers."""

        audio_bytes = reference.file.read()

        return _process_voice_registration(name, reference_text, audio_bytes)

    # =========================================================================

    # ENDPOINTS: Generate Audio from Cloned Voices

    # =========================================================================

    def _synthesize_via_backend(text: str, ref_wav_path: Path, ref_text: str) -> bytes:

        """Call s2 HTTP server with multipart form data."""

        active_wav, active_ref_text, temp_cleanup = _prepare_reference_clip(

            ref_wav_path, ref_text, max_duration_sec=20.0

        )

        try:

            with request_lock:

                with open(active_wav, "rb") as audio_fh:

                    files = {

                        "reference": ("reference.wav", audio_fh, "audio/wav"),

                    }

                    data = {

                        "text": text,

                        "reference_text": active_ref_text,

                    }

                    res = requests.post(

                        f"http://127.0.0.1:{BACKEND_PORT}/generate",

                        files=files,

                        data=data,

                        timeout=600,

                    )

                    if res.status_code == 200 and len(res.content) > 1000:

                        return res.content

                    raise RuntimeError(

                        f"s2 backend error HTTP {res.status_code}: {res.text[:500]}"

                    )

        finally:

            if temp_cleanup:

                temp_cleanup.unlink(missing_ok=True)

    def _synthesize_via_saved_profile_backend(text: str, voice_arg: str) -> bytes:

        """Synthesize with an existing .s2voice profile, without resending reference audio."""

        with request_lock:

            form_fields = {

                "text": (None, text),

                "voice": (None, voice_arg),

                "voice_dir": (None, str(VOICE_DIR)),

            }

            res = requests.post(

                f"http://127.0.0.1:{BACKEND_PORT}/generate",

                files=form_fields,

                timeout=600,

            )

            if res.status_code == 200 and len(res.content) > 1000:

                return res.content

            raise RuntimeError(

                f"s2 saved-profile backend error HTTP {res.status_code}: {res.text[:500]}"

            )


    def _synthesize_via_cli(

        text: str, voice_name: str, ref_wav_path: Path, ref_text: str

    ) -> bytes:

        """CLI fallback for speech generation."""

        active_wav, active_ref_text, temp_cleanup = _prepare_reference_clip(

            ref_wav_path, ref_text, max_duration_sec=20.0

        )

        output_fd, output_name = tempfile.mkstemp(suffix=".wav")

        os.close(output_fd)

        out_wav = Path(output_name)

        try:

            with request_lock:

                stop_backend()

                try:

                    cmd = [

                        binary,

                        "--model",

                        str(MODEL_PATH),

                        "--tokenizer",

                        str(TOKENIZER_PATH),

                        "--cuda",

                        "0",

                        "--prompt-audio",

                        str(active_wav),

                        "--prompt-text",

                        active_ref_text,

                        "--text",

                        text,

                        "--output",

                        str(out_wav),

                    ]

                    res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

                    if res.returncode != 0 or not out_wav.exists() or out_wav.stat().st_size < 1000:

                        err_msg = (res.stderr or res.stdout or "s2 CLI generation failed")[-2000:]

                        raise RuntimeError(f"CLI generation failed: {err_msg}")

                    return out_wav.read_bytes()

                finally:

                    out_wav.unlink(missing_ok=True)

                    start_backend()

        finally:

            if temp_cleanup:

                temp_cleanup.unlink(missing_ok=True)

    def _synthesize_via_saved_profile_cli(text: str, voice_arg: str) -> bytes:

        """CLI fallback using an existing .s2voice profile."""

        output_fd, output_name = tempfile.mkstemp(suffix=".wav")

        os.close(output_fd)

        out_wav = Path(output_name)

        try:

            with request_lock:

                stop_backend()

                try:

                    cmd = [

                        binary,

                        "--model",

                        str(MODEL_PATH),

                        "--tokenizer",

                        str(TOKENIZER_PATH),

                        "--cuda",

                        "0",

                        "--voice",

                        voice_arg,

                        "--voice-dir",

                        str(VOICE_DIR),

                        "--text",

                        text,

                        "--output",

                        str(out_wav),

                    ]

                    res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

                    if res.returncode != 0 or not out_wav.exists() or out_wav.stat().st_size < 1000:

                        err_msg = (res.stderr or res.stdout or "s2 saved-profile CLI failed")[-2000:]

                        raise RuntimeError(f"Saved-profile CLI generation failed: {err_msg}")

                    return out_wav.read_bytes()

                finally:

                    out_wav.unlink(missing_ok=True)

                    start_backend()

        finally:

            out_wav.unlink(missing_ok=True)


    @web_app.post("/generate")

    async def generate_speech(request: Request):

        """Synthesizes speech using registered voice clones or ad-hoc reference audio.

        Accepts:

            JSON: { "voice_name": "...", "text": "...", "language": "English" }

            OR Multipart form: text, voice_name / voice, optional reference audio

        """

        try:

            await voice_volume.reload.aio()

        except Exception:

            pass

        content_type = request.headers.get("content-type", "")

        target_voice = ""

        target_text = ""

        adhoc_ref_bytes = None

        adhoc_ref_text = ""

        if "multipart/form-data" in content_type:

            form = await request.form()

            target_voice = str(form.get("voice_name") or form.get("voice") or "").strip()

            target_text = str(form.get("text") or "").strip()

            adhoc_ref_text = str(form.get("reference_text") or form.get("ref_text") or "").strip()

            file_item = form.get("reference") or form.get("reference_audio") or form.get("file")

            if file_item:

                adhoc_ref_bytes = await file_item.read()

        else:

            try:

                data = await request.json()

            except Exception:

                raise HTTPException(status_code=400, detail="Invalid JSON or form body.")

            target_voice = str(data.get("voice_name") or data.get("voice") or "").strip()

            target_text = str(data.get("text") or "").strip()

        if not target_text:

            raise HTTPException(status_code=400, detail="text is required for speech synthesis.")

        # Scenario 1: Ad-hoc voice cloning from uploaded file in request

        if adhoc_ref_bytes:

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_audio:

                tmp_audio.write(normalize_audio_to_wav(adhoc_ref_bytes))

                tmp_audio_path = Path(tmp_audio.name)

            try:

                wav_bytes = await asyncio.to_thread(

                    _synthesize_via_backend, target_text, tmp_audio_path, adhoc_ref_text

                )

                return Response(

                    content=wav_bytes,

                    media_type="audio/wav",

                    headers={"Content-Disposition": 'attachment; filename="speech.wav"'},

                )

            finally:

                tmp_audio_path.unlink(missing_ok=True)

        # Scenario 2: Synthesis from registered voice clone

        if not target_voice:

            raise HTTPException(

                status_code=400,

                detail="voice_name is required when no reference audio file is supplied.",

            )

        canonical_name, voice_folder = locate_voice(target_voice, reload_volume=False)

        if not voice_folder:

            raise HTTPException(

                status_code=404, detail=f"Registered voice '{target_voice}' not found."

            )

        root_profile = VOICE_DIR / f"{canonical_name}.s2voice"

        nested_profile = voice_folder / "profile.s2voice"

        profile_path = root_profile if root_profile.is_file() else nested_profile

        voice_arg = canonical_name if profile_path == root_profile else str(profile_path)

        ref_wav = voice_folder / "reference.wav"

        ref_text = ""

        meta_file = voice_folder / "metadata.json"

        if meta_file.is_file():

            try:

                meta = json.loads(meta_file.read_text(encoding="utf-8"))

                ref_text = meta.get("ref_text", "")

            except Exception:

                pass

        if not ref_wav.is_file():

            # The saved profile is enough for generation; reference audio is only

            # needed for legacy voices without a .s2voice file.

            flat_ref = VOICE_DIR / f"{canonical_name}.wav"

            if flat_ref.is_file():

                ref_wav = flat_ref

            elif not profile_path.is_file():

                raise HTTPException(

                    status_code=404,

                    detail=f"Voice '{target_voice}' has neither a saved profile nor reference audio. Re-register the voice.",

                )

        wav_bytes = None

        profile_failure = None

        if profile_path.is_file():

            # Prefer the reusable profile, without resending reference audio.

            try:

                wav_bytes = await asyncio.to_thread(

                    _synthesize_via_saved_profile_backend, target_text, voice_arg

                )

            except Exception as profile_server_err:

                print(

                    f"[Fish-S2] Saved-profile server synthesis failed ({profile_server_err}), "

                    "trying the saved-profile CLI..."

                )

                try:

                    wav_bytes = await asyncio.to_thread(

                        _synthesize_via_saved_profile_cli, target_text, voice_arg

                    )

                except Exception as profile_cli_err:

                    profile_failure = profile_cli_err

                    print(

                        f"[Fish-S2] Saved-profile CLI failed ({profile_cli_err}); "

                        "falling back to the clipped reference audio when available..."

                    )

        # Older voices without a saved profile, or a profile that could not be

        # loaded, continue through the existing clipped-reference path.

        if wav_bytes is None and ref_wav.is_file():

            try:

                wav_bytes = await asyncio.to_thread(

                    _synthesize_via_backend, target_text, ref_wav, ref_text

                )

            except Exception as server_err:

                print(f"[Fish-S2] Reference-based server synthesis failed ({server_err}), attempting CLI fallback...")

                try:

                    wav_bytes = await asyncio.to_thread(

                        _synthesize_via_cli, target_text, canonical_name, ref_wav, ref_text

                    )

                except Exception as cli_err:

                    raise HTTPException(

                        status_code=500,

                        detail=f"Speech synthesis failed: {cli_err}",

                    ) from cli_err

        elif wav_bytes is None:

            raise HTTPException(

                status_code=500,

                detail=f"Saved voice profile synthesis failed: {profile_failure}",

            ) from profile_failure

        return Response(

            content=wav_bytes,

            media_type="audio/wav",

            headers={

                "Content-Disposition": f'attachment; filename="{canonical_name}-speech.wav"',

                "X-Audio-Sample-Rate": "24000",

                "X-Audio-Channels": "1",

            },

        )

    # =========================================================================

    # ENDPOINTS: Delete Voice Clone

    # =========================================================================

    def _delete_voice_internal(voice_name: str) -> dict:

        target_name = (voice_name or "").strip()

        if not target_name:

            raise HTTPException(status_code=400, detail="voice_name is required.")

        canonical_name, voice_folder = locate_voice(target_name)

        if not voice_folder:

            raise HTTPException(

                status_code=404, detail=f"Voice clone '{target_name}' not found."

            )

        # Delete directory if folder-based

        if voice_folder != VOICE_DIR and voice_folder.is_dir():

            shutil.rmtree(voice_folder, ignore_errors=True)

        # Delete flat .s2voice or .wav files

        (VOICE_DIR / f"{canonical_name}.s2voice").unlink(missing_ok=True)

        (VOICE_DIR / f"{canonical_name}.wav").unlink(missing_ok=True)

        voice_volume.commit()

        return {

            "success": True,

            "message": f"Voice clone '{target_name}' deleted successfully.",

            "voice_name": target_name,

        }

    @web_app.delete("/voices/{voice_name}")

    def delete_voice_rest(voice_name: str):

        return _delete_voice_internal(voice_name)

    @web_app.post("/delete-clone")

    def delete_clone_post(data: dict):

        return _delete_voice_internal(data.get("voice_name", ""))

    return web_app
