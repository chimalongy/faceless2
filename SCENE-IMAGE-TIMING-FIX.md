# Multi-image scene rendering correction

The update fixes timing plans that let one image consume the narration and removes the hardcoded five-second Modal planning duration.

## Changed application files

- src/lib/scene-timing.js (new): validates full timing plans and allocates an exact frame budget. Invalid, stale, missing, or collapsed plans use equal image durations. Valid unequal timings and explicit image order are retained. Every image receives at least two frames; impossible image/frame counts fail explicitly.
- src/lib/scene-planner.js: uses shared validation, produces consistent start/end/duration values, and requires a measured narration duration.
- src/lib/ffmpeg-helper.js: adds strict audio probing for scene rendering, with argument-safe ffprobe execution. Existing non-strict consumers retain their fallback behavior.
- src/trigger/RenderFrameVideo.js: requires successfully downloaded/probed narration and validates the frame allocation before rendering.
- src/trigger/RenderFrameVideoModal.js: downloads narration to a temporary directory, probes its real duration, and removes temporary files afterward. If probing/planning fails, Modal uses equal allocation based on its own audio measurement.
- modal/scene_renderer.py: independently validates timings against actual audio, allocates an exact budget, logs image/frame counts, rejects failed audio probing, and accepts imageUrls-only requests.

No new npm dependencies are required. The existing Trigger FFmpeg build extension remains in place.

## Apply and deploy

1. Copy the six application files above into your project, preserving paths. The ZIP also includes the rest of the supplied project.
2. Redeploy the Trigger.dev tasks using your existing deployment workflow. Deploy both renderer tasks and their updated shared libraries.
3. Redeploy the Modal renderer from the project root:

   modal deploy modal/scene_renderer.py

4. Re-render the affected scenes. Already-created videos do not change automatically.
5. If a completed video uses those scenes, merge the newly rendered scenes again.

The existing required KEN_BURNS_ZOOM_AMOUNT and KEN_BURNS_PAN_ZOOM inputs and single-container rendering architecture are preserved.

## Verification

Run from the project root:

   node --test tests/scene-timing.test.mjs
   python3 tests/test_scene_renderer.py

The Python tests require ffmpeg and ffprobe on PATH. They load the renderer's pure functions without starting Modal or accessing credentials. The tests include an actual three-image render with audio, verify the visible color of each segment, and check the final duration.

Validated locally: five JavaScript regression tests, four Python tests (including FFmpeg integration), and syntax checks of the changed JavaScript/Python sources. No production deployment or live Trigger/Modal/LLM/database calls were performed.
