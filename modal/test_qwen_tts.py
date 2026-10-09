import requests

url = "https://geniusdomainnames--qwen3-tts-custom-web.modal.run/synthesize"

payload = {
    "text": "Plenty of people assume that saving for retirement is only possible through an employer, but in the United States there is an account that anyone with earned income can open on their own, and it's called an IRA, which is worth understanding because its tax treatment can make a real difference over several decades.",
    "language": "English",
    "speaker": "Ryan",
    "instruct": "Speak in an intimate, perceptive, and calm investigative documentary style with deliberate pacing and restrained, confident delivery."
}

response = requests.post(url, json=payload)

if response.status_code == 200:
    with open("cloud_output.wav", "wb") as f:
        f.write(response.content)
    print("Success! Audio saved to cloud_output.wav")
else:
    print(f"Error {response.status_code}: {response.text}")