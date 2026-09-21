# Custom overlay text on Shorts

In Completed Video, click **Overlay Text on Short** to open the text dialog.
Enter up to 120 characters and click Save text. Use Edit text to change it, or uncheck the option to disable it. Cancel or Escape leaves the saved choice unchanged.
Merge again to apply the text. The existing preview does not change until the merge completes. Text stays in the open topic session; re-enter it after refreshing the page.

Both merge methods use the supplied text, never the topic title. Enabled overlays require nonblank text. Generation failures stop the merge rather than silently omitting the overlay. The legacy internal setting name is retained, so no database migration is needed.

## Deployment

From the project root:
1. Redeploy the web app through your existing deployment process.
2. Run `npx trigger.dev@4.6.3 deploy`.
3. Run `modal deploy modal/scene_merger.py`.

Keep your existing environment variables and Modal endpoint. No scene_renderer.py deployment or individual scene re-rendering is needed. Enable the overlay, save your text, and merge again.

## Validation

Local checks passed for Modal schema field preservation; JavaScript enabled, disabled, missing-text and generation-failure paths; a real Pillow/FFmpeg overlay at the start and end of a test clip; and a real JavaScript PNG render with punctuation. Full browser interaction, production build and live deployments were not tested here.
