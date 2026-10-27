# Final-master overlay fix

## Root cause addressed
The production Long merge uses `merge-scene-frames-modal` -> `modal/scene_merger.py` and renders at 60 FPS. Film/scratch overlays such as `223849.mp4` are opaque H.264 videos with black backgrounds, so they should be composited with a blend mode rather than treated as alpha-video overlays.

## Changes
- Modal final-master compositor now uses FFmpeg `blend=all_mode=screen`.
- Long/Short URL and opacity selection is explicit (no nested conditional-expression ambiguity).
- If overlay is enabled but URL is missing, opacity is zero/invalid, or download fails, the merge FAILS instead of silently publishing a master without the overlay.
- Modal returns `overlayApplied` and `overlayOpacity` diagnostics.
- Trigger.dev Modal wrapper and API return those diagnostics.
- Non-Modal Trigger merger uses the same screen-blend behavior and no longer silently ignores overlay download failures.

## Deploy
1. Deploy Modal from repository root:
   `modal deploy modal/scene_merger.py`
2. Deploy Trigger.dev production tasks using your normal Trigger.dev deployment command/workflow.
3. Deploy the Next.js application so the API response includes the new diagnostics (recommended; required only for surfacing diagnostics, not for the Modal visual fix).

## Verify
Create a new Long master with Video Overlay enabled. Modal logs must contain:
- `Overlay requested: type=Longs, url_present=True`
- `Overlay downloaded: ... bytes; screen blend opacity=...`
- `FFmpeg completed; overlay_applied=True`

If any overlay input is missing/broken, the job now fails rather than producing a false-success master.
