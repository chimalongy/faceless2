"""Send reference audio and text to the deployed Qwen3-TTS Modal endpoint."""

import json
import urllib.error
import urllib.request
from pathlib import Path


ENDPOINT = "https://geniusdomainnames--qwen3-tts-clone.us-east.modal.run"
REFERENCE_AUDIO = "reference.mp3"
REFERENCE_TEXT = """You are not behind; you are hiding. And somewhere, quietly, you already know it. Not from the world, not from bad luck, not from the people who let you down. From you. There's a specific moment today, small, forgettable, easy to miss, that decides who you become in five years. Most people will walk right past it. They'll scroll past it, they'll snooze past it, they'll excuse their way past it. I'm gonna show you exactly when it happens. I'm gonna show you what it looks like, what it feels like, and why you keep missing it. Stay until the end. I'll hand you the exact system I use to stop missing it. This isn't a pep talk. This is a mirror. I'm not here to motivate you. Motivation is a mood. Moods don't build men. Moods don't build women who run their own lives. Moods don't build anything that lasts past Tuesday. I used to wake up late, snooze twice, tell myself tomorrow. Tomorrow became a personality trait. It became my whole identity, quietly, without me signing up for it. I looked disciplined from the outside. I had a job. I had a gym membership I barely used. I had opinions about hustle culture, about grind, about all the things I wasn't actually doing. I was fluent in the language of ambition and illiterate in the practice of it. Here's the truth. Nobody wants to hand it to you straight, because it doesn't trend well, because it doesn't make you feel good for four seconds before you scroll to the next thing. Comfort isn't peace. Comfort is a tax. It's quiet, it's polite, it doesn't announce itself, and it compounds. Every day you choose the soft option, you sign a contract with a smaller future. Nobody makes you sign it. There's no pen, no paper, no ceremony. Just a decision, made in silence, repeated until it becomes who you are. You don't feel it happen. That's the trick of it. That's the whole design. No dramatic collapse. No single moment where your life visibly falls apart. Just a thousand tiny surrenders disguised as self-care, disguised as balance, disguised as “I deserve a break.” Some of those surrenders you deserved. Most of them you didn't. You just told yourself you did, because the alternative, admitting you chose comfort over your own future, was too heavy to carry before breakfast. I know this because I lived it for years before I understood it. I'm going to give you the exact system I used to break that contract, the one I built out of failure, out of frustration, out of watching myself lose to my own excuses over and over until I got sick of losing to a version of me that didn't even exist yet. Not yet. First, you need to see the damage clearly. No filter, no soft lighting, no comfortable framing, because you can't fix what you refuse to look at directly. Let's strip the excuses, one at a time. No mercy, because mercy right now is just another form of comfort, and comfort is exactly what got you here. “I don't have time.” You have time. You have hours you don't remember losing. Three hours a day, sometimes more, spent on a screen engineered by people smarter than both of us to keep you exactly where you are, scrolling, soothed, stagnant. That platform profits from your"""

TEXT_TO_GENERATE = "This is a test of the Qwen voice cloning endpoint."
LANGUAGE = "English"


def main() -> None:
    audio_path = Path(__file__).resolve().parent / REFERENCE_AUDIO
    if not audio_path.is_file():
        raise FileNotFoundError(
            f"Reference audio not found: {audio_path}\n"
            "Put reference.mp3 in the same folder as this script, "
            "or change REFERENCE_AUDIO at the top of the script."
        )

    import base64

    payload = {
        "text": TEXT_TO_GENERATE,
        "language": LANGUAGE,
        "ref_text": REFERENCE_TEXT,
        "ref_audio_base64": base64.b64encode(audio_path.read_bytes()).decode("ascii"),
    }
    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    output_path = Path(__file__).resolve().parent / "generated.wav"
    try:
        with urllib.request.urlopen(request, timeout=900) as response:
            output_path.write_bytes(response.read())
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Endpoint returned HTTP {error.code}: {details}") from error

    print(f"Audio saved to: {output_path}")


if __name__ == "__main__":
    main()
