# Overlay settings handoff fix

The channel database `video_settings` object is now the baseline for final Modal merges. Request-level `videoSettings` is merged on top rather than replacing the database object merely because an empty `{}` is truthy in JavaScript.

The Trigger task logs the resolved overlay state before calling Modal. Modal logs the complete received `video_settings` object before resolving Long/Short overlay URL and opacity.

## Deploy

1. Deploy Trigger.dev so `src/trigger/MergeSceneFramesModal.js` is live.
2. Deploy Modal: `modal deploy modal/scene_merger.py`.
3. Redeploy the Next.js application to keep the production repository synchronized.
4. Generate a new master. Existing masters are unchanged.

For the supplied Long configuration, logs should report `useOverlay: true`, `overlayUrlPresent: true`, opacity `0.5`, followed by Modal `overlay_applied=True`.
