# Overlay colour-cast fix

The final compositor no longer uses FFmpeg `screen` blending for opaque film/scratch overlays. Screen blending mixed the overlay RGB values into the master and could create a purple/magenta cast.

The overlay is now converted to RGBA and `lumakey` derives transparency from luminance. Dark background pixels become transparent; bright scratches/sparks remain visible. `colorchannelmixer` applies the frontend opacity to the resulting alpha channel, then normal `overlay` compositing preserves the underlying video's colour.

## Deploy

1. Modal (required for the normal production master path):
   `modal deploy modal/scene_merger.py`
2. Trigger.dev (recommended/required if the non-Modal merger can be used): deploy the Trigger project containing `src/trigger/MergeSceneFrames.js` and `src/trigger/MergeSceneFramesModal.js`.
3. Redeploy the Next.js app only if your deployment process ships the repository as one release; no frontend opacity contract changed.

Generate a new master after deployment. Existing masters are unchanged.
