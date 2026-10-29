# Modal bulk audio effects deployment

Bulk scene narration now applies the channel's saved audio effects inside the
Modal worker. The worker synthesizes a scene, runs the supplied FFmpeg filter,
and uploads the processed WAV to Cloudflare R2. Trigger.dev passes the filter
and records the returned R2 asset in `topic_assets`.

For Fish S2, `POST /bulk-generate` now only enqueues a detached Modal function
and returns a job ID. That worker generates scenes sequentially, applies the
filter, and uploads each result. Trigger.dev polls the job status; cancelling
or timing out the HTTP request does not cancel the detached worker.

Kokoro, standard Qwen, and Qwen voice-clone bulk handlers also process scenes
sequentially, apply the filter, and upload to R2 without calling their public
`/generate` routes. Those three handlers still return results synchronously;
only Fish uses the detached job/status flow in this revision.

## What changed

- The Trigger.dev bulk task no longer bypasses bulk generation when channel
  audio effects are enabled.
- The task compiles the saved channel effect preset into an FFmpeg filter and
  passes it to the selected Modal bulk endpoint as `audio_effects`.
- Kokoro, Qwen CustomVoice, Fish S2 clone, and Qwen clone bulk endpoints apply
  the filter before uploading each WAV.
- Each Modal image installs FFmpeg. If the image's FFmpeg build lacks the
  `rubberband` filter, pitch filters use the same duration-preserving fallback
  approach as the Trigger.dev audio-effects helper.
- Fish bulk requests are queued as detached Modal jobs. The worker processes
  scenes sequentially with the s2.cpp CLI, applies effects, and uploads to R2;
  it does not call either public or local `/generate` routes.
- Trigger.dev polls the Fish job and records the completed R2 results in the
  database. Batch failures are reported as failures; they are never rerouted
  into individual `/generate` calls.
- Bulk voice-clone routing resolves a generic `clone` selection against the
  registered voice model so Qwen clones use the Qwen service.

## Deploy

Deploy the Modal app or apps for the models used by your channels. If you use
all four model paths, run:

```bash
modal deploy modal/kokorotts.py
modal deploy modal/qwen3_tts.py
modal deploy modal/fish_s2_modal.py
modal deploy modal/qwentts_voice_clone.py
```

Then deploy the Trigger.dev project using your existing workflow. This change
does not require a Next.js/Vercel deployment. Keep the existing database, Modal
endpoint URL, Trigger.dev, and Cloudflare R2 environment settings configured.
The updated audio task allows up to two hours, while the detached Modal Fish
worker has a one-hour job limit.

Only Fish has the detached job/status flow in this revision. Kokoro and both
Qwen bulk endpoints already synthesize each scene and upload it without calling
their public `/generate` routes, but those handlers remain synchronous.

In the channel audio settings, enable and save the desired audio-effects
preset. “Generate All Audios” will then apply that filter to each generated
scene in Modal before upload. When effects are disabled, bulk synthesis still
runs in Modal without filtering.

## Check a run

For a Fish batch run, Trigger.dev should log `Attempting single-request bulk
generation`, followed by a Modal job acceptance and polling message. Modal
returns an `audio_filter` value for each scene (`none` when disabled). Trigger.dev
then stores the returned WAV URLs and keys in `topic_assets`.

Single-scene tasks continue to use the public `/generate` route and apply
effects in Trigger.dev. Bulk tasks use `/bulk-generate` and never fall back to
the single-scene route.
