# Scene-local subtitles

Deploy all three Modal services from the modal directory:

```bash
modal deploy whisper_modal.py
modal deploy scene_renderer.py
modal deploy scene_merger.py
```

Deploy the updated Next.js app and Trigger.dev tasks with your existing deployment workflow. If Modal returns a changed Whisper URL, update the audio transcription URL in General Settings (or MODAL_TRANSCRIPTION_URL). Keep the renderer/merger URLs configured as before.

In Scene Frames, choose captions and the highlight style, then use the Modal render buttons. Shorts default to captions on; long-form defaults to off. These controls apply to Modal rendering, not the legacy local scene renderer. Re-render existing scene clips to add, remove, or change captions. The batch button renders only missing clips, so delete existing scene videos first if re-rendering the entire topic. Then merge the new clips. Old clips cannot gain captions just by merging.

Whisper now returns word timestamps, segments, text, measured audio duration, and its legacy ASS response. Trigger creates a separate ASS file per scene, using timestamps relative to that scene's audio. Missing word timestamps or failed transcription abort captioned rendering with an error rather than estimating word timing. Whisper remains a speech recognition model; timestamps and recognized text can still need correction.

The renderer burns captions after assembling all images in a scene and before uploading that scene video. Captions do not restart at each image change. Font size and position scale with the render dimensions. DejaVu Sans is installed explicitly in Modal for predictable rendering. Both master merge paths preserve captions already in the frames and do not transcribe or burn subtitles.

Direct renderer API clients may send `subtitles_ass` (or `subtitlesAss`) on each scene. It must be scene-local ASS, starting from zero, with PlayResX/PlayResY matching the render dimensions. The app generates this automatically. No request credentials or required Ken Burns parameters have changed.

Validation:

```bash
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test*.py'
```

The FFmpeg integration test renders single-image and multi-image scenes, checks caption appearance before/after an image boundary, merges two scenes, and verifies scene-local caption timing survives the merge. Tests require Node, Python, FFmpeg, and FFprobe; production dependencies remain installed remotely by Modal.

Live Modal, Trigger.dev, database and R2 operations require your deployment and credentials and were not exercised in this workspace.
