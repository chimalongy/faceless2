# Bulk audio effects and Modal database writes

Fish S2 bulk generation is now detached from the HTTP request. Modal receives
the batch once, generates scenes sequentially, applies the channel's FFmpeg
effect when enabled, uploads each WAV to Cloudflare R2, and writes its
`topic_assets` row directly to the database. It also records per-scene results
and job progress in `audio_generation_jobs`.

Trigger.dev submits the batch to Modal and returns the accepted job ID. The
request includes `channel_slug`, `topic_slug`, the scene text, voice, audio
effects, Cloudflare R2 credentials, and the existing `DATABASE_URL` from the
Trigger.dev environment. Modal uses those values to save the audio and register
each scene in `topic_assets`. No Modal secret needs to be created. Trigger.dev
does not call `/generate` and does not poll Modal for completion. The topic page
reads job progress through the Next.js status API, which queries the database;
those status checks do not invoke Modal. Generated audio appears in the page as
Modal saves each scene.

## Deploy

Deploy the Fish Modal app; no Modal database secret setup is required:

```bash
modal deploy modal/fish_s2_modal.py
```

Deploy the Trigger.dev project and the Next.js app so they include the updated
bulk task, API response, database schema, status route, and topic page polling.
Trigger.dev must have the correct `DATABASE_URL` configured because it passes
that value to Modal with the bulk request.

The schema initialization creates `audio_generation_jobs` automatically. Its
status values are `queued`, `running`, `completed`, `completed_with_errors`,
and `failed`. Scene rows are written to `topic_assets` only after their WAV has
been uploaded to R2.

## Other TTS models

Kokoro, standard Qwen, and Qwen clone bulk handlers remain synchronous and
return their results inline. This change affects detached Fish S2 clone bulk
jobs. They already use their own `/bulk-generate` handlers and do not call
`/generate` for batch processing.

Single-scene generation continues to use `/generate` and Trigger.dev's existing
single-scene effects and database flow.
