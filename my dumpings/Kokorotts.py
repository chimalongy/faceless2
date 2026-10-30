# deploy.py — Kokoro-82M on Modal
# Deploy:  modal deploy kokorotts.py
# Serve:   modal serve kokorotts.py   (ephemeral, dev)
# Test:    modal run   kokorotts.py   (single synthesis, exits)

import io
import modal

# ---------------------------------------------------------------------------
# 1. Container image
#    All misaki language extras installed for full voice support.
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("espeak-ng")
    .pip_install(
        "kokoro>=0.9.4",
        "misaki[en]",   # American + British English, Spanish, French, Hindi, Italian, Portuguese
        "misaki[ja]",   # Japanese
        "misaki[zh]",   # Mandarin Chinese
        "soundfile",
        "numpy",
        "fastapi[standard]",
    )
)

app = modal.App("kokoro-tts", image=image)

# ---------------------------------------------------------------------------
# 2. Voice registry — all 54 voices from Kokoro v1.0
#    Grouped by language with their lang_code for pipeline routing.
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

# Flat lookup: voice name → lang_code  (used for auto-routing)
VOICE_TO_LANG: dict[str, str] = {
    voice: meta["lang_code"]
    for meta in VOICES.values()
    for voice in meta["female"] + meta["male"]
}

# ---------------------------------------------------------------------------
# 3. GPU class — one pipeline per language, all loaded at container start.
#    This avoids the slow per-call re-init for non-English voices.
# ---------------------------------------------------------------------------
@app.cls(
    gpu="T4",
    scaledown_window=300,
    timeout=120,
    # min_containers=1,  # uncomment to eliminate cold starts (~$14/day)
)
class KokoroTTS:

    @modal.enter()
    def load(self):
        """
        Pre-load one KPipeline per language code so every voice is ready
        without any per-request re-initialisation overhead.
        """
        from kokoro import KPipeline

        lang_codes = {meta["lang_code"] for meta in VOICES.values()}
        self.pipelines: dict[str, KPipeline] = {}
        for code in lang_codes:
            try:
                self.pipelines[code] = KPipeline(lang_code=code)
                print(f"[kokoro] pipeline ready: lang_code='{code}'")
            except Exception as exc:
                # Don't crash the whole container if one language fails to load
                print(f"[kokoro] WARNING: failed to load lang_code='{code}': {exc}")

    @modal.method()
    def synthesize(
        self,
        text: str,
        voice: str = "af_heart",
        speed: float = 1.0,
        fmt: str = "wav",        # "wav" | "pcm"
        lang_code: str | None = None,
    ) -> bytes:
        """
        Convert text → audio bytes (WAV or raw float32 PCM at 24 kHz).

        lang_code is auto-detected from the voice name if not supplied.
        Pronunciation override syntax: [word](/IPA/)
        Example: "Visit [Nike](/nˈaɪki/) today."
        """
        import numpy as np
        import soundfile as sf

        # Auto-detect lang_code from voice name when not explicitly provided
        resolved_lang = lang_code or VOICE_TO_LANG.get(voice, "a")

        pipeline = self.pipelines.get(resolved_lang)
        if pipeline is None:
            raise ValueError(
                f"No pipeline loaded for lang_code='{resolved_lang}'. "
                f"Available: {list(self.pipelines.keys())}"
            )

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

    # ── request schema ────────────────────────────────────────────────────
    class TTSRequest(BaseModel):
        text: str              = Field(..., max_length=10_000)
        voice: str             = Field("af_heart")
        speed: float           = Field(1.0, ge=0.5, le=2.0)
        format: str            = Field("wav", pattern="^(wav|pcm)$")
        lang_code: str | None  = Field(
            None,
            description=(
                "Optional. Lang code is auto-detected from the voice name. "
                "Override only if you need to force a specific G2P backend."
            ),
        )

    # ── routes ────────────────────────────────────────────────────────────
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
        """Return all available voices grouped by language."""
        return {"voices": VOICES}

    @api.get("/voices/flat")
    def voices_flat():
        """Return a flat list of all voice names with their lang_code."""
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

        # Validate voice exists
        if req.voice not in VOICE_TO_LANG:
            raise HTTPException(
                400,
                f"Unknown voice '{req.voice}'. "
                f"Call GET /voices or GET /voices/flat for the full list.",
            )

        tts = KokoroTTS()
        audio = tts.synthesize.remote(
            text=req.text,
            voice=req.voice,
            speed=req.speed,
            fmt=req.format,
            lang_code=req.lang_code,  # None = auto-detect
        )

        media = "audio/wav" if req.format == "wav" else "audio/pcm"
        return Response(content=audio, media_type=media)

    return api


# ---------------------------------------------------------------------------
# 5. CLI test — modal run kokorotts.py [--text "..."] [--voice af_heart]
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def main(
    text:   str = "Kokoro is an open-weight TTS model with 82 million parameters.",
    voice:  str = "af_heart",
    output: str = "/tmp/kokoro.wav",
):
    tts = KokoroTTS()
    data = tts.synthesize.remote(text=text, voice=voice)
    with open(output, "wb") as f:
        f.write(data)
    print(f"✓ saved → {output}  ({len(data):,} bytes)")
    print(f"  voice={voice}  lang_code={VOICE_TO_LANG.get(voice, 'unknown')}")