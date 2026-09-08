import modal
import uuid
import requests
import os

# ---------------------------
# Modal App + Image Setup
# ---------------------------

app = modal.App("whisper-api-optimized")

image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg", "fonts-dejavu", "fonts-freefont-ttf")
    .pip_install(
        "openai-whisper",
        "torch",
        "requests",
        "fastapi",
        "asgiref",
        "uvicorn"
    )
)

# ---------------------------
# Helper Functions
# ---------------------------

def seconds_to_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02}:{s:05.2f}"


def wrap_text_by_words(text: str, max_words: int = 5) -> str:
    """
    Split text into lines with max_words per line.
    Uses double-escaped \\N to avoid unicode issues.
    """
    words = text.split()
    lines = []

    for i in range(0, len(words), max_words):
        lines.append(" ".join(words[i:i + max_words]))

    return "\\\\N".join(lines)  # THIS prevents unicodeescape errors


# ---------------------------
# Whisper Service
# ---------------------------

@app.cls(gpu="T4", image=image, timeout=900)
class WhisperService:

    @modal.enter()
    def load_model(self):
        import whisper
        print("Loading Whisper model into GPU...")
        self.model = whisper.load_model("medium")

    @modal.fastapi_endpoint(method="POST")
    async def transcribe(self, data: dict):

        url = data.get("url")
        if not url:
            return {"error": "No URL provided"}

        temp_file = f"/tmp/{uuid.uuid4()}.mp4"

        print("Downloading media...")

        r = requests.get(url, stream=True, timeout=60)
        r.raise_for_status()

        with open(temp_file, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)

        print("Transcribing...")
        result = self.model.transcribe(temp_file)

        os.remove(temp_file)

        print("Transcription complete")

        # ---------------------------
        # ASS HEADER (NO \N ANYWHERE)
        # ---------------------------

        ass_header = (
            "[Script Info]\n"
            "Title: Whisper Auto Subtitles\n"
            "ScriptType: v4.00+\n"
            "WrapStyle: 2\n"
            "ScaledBorderAndShadow: yes\n"
            "YCbCr Matrix: TV.601\n"
            "PlayResX: 1920\n"
            "PlayResY: 1080\n\n"
            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
            "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
            "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: Default,Tahoma,64,&H00FFFFFF,&H000000FF,&H00000080,&H64000000,"
            "0,0,0,0,100,100,0,0,1,3,0,2,60,60,40,1\n\n"
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        )

        dialogue_lines = []

        for seg in result["segments"]:
            start = seconds_to_ass_time(float(seg["start"]))
            end = seconds_to_ass_time(float(seg["end"]))

            clean_text = seg["text"].strip().replace("\n", " ")
            wrapped_text = wrap_text_by_words(clean_text, max_words=7)

            line = f"Dialogue: 0,{start},{end},Default,,0,0,0,,{wrapped_text}"
            dialogue_lines.append(line)

        ass_content = ass_header + "\n".join(dialogue_lines)

        return {"ass": ass_content}
