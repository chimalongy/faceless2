/* Faceless Studio — Vibes.ai Content Automation Adapter
 * Injected into vibes.ai pages to automate prompt injection, mode switching,
 * start-frame attachment, and media extraction.
 */
(() => {
  "use strict";

  if (window.__vibesAdapterLoaded) return;
  window.__vibesAdapterLoaded = true;

  console.log("[Vibes-Adapter] Content script initialized on vibes.ai");

  // ── Selectors & Constants ──
  const Selectors = {
    ComposerInput: '[data-lexical-editor="true"][contenteditable="true"]',
    GalleryThumbnail: '[data-analytics-id="creation_gallery.thumbnail_click"]',
    GenerateButtonImage: 'button[data-analytics-id="send_message"][data-analytics-prompt-type="images"]',
    GenerateButtonVideo: 'button[data-analytics-id="send_message"][data-analytics-prompt-type="videos"]',
    StartFrameToggle: 'button[data-analytics-id="creation_gallery.start_end_frame_selection_click"]',
  };

  const ModeIcons = {
    Image: "M9.75 10.375a1.375 1.375 0 1 1 0 2.75 1.375 1.375 0 0 1 0-2.75z",
    Video: "M8.42163",
  };

  const Icons = {
    AddFrame: "M12 4.75a.75.75",
    Upload: "M12 2.75a.75.75",
    Close: "M18.3 5.71a.996.996",
  };

  const READY_VIDEO_PATTERN = /^https:\/\/[^/]+\.fbcdn\.net\//;
  let isAborted = false;

  // ── Utility Helpers ──
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  async function waitFor(predicate, timeoutMs = 25000, intervalMs = 250) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (isAborted) return null;
      try {
        const result = predicate();
        if (result) return result;
      } catch {}
      await sleep(intervalMs);
    }
    return null;
  }

  function simulateClick(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: "instant", block: "nearest" });
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const common = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

    element.dispatchEvent(new PointerEvent("pointerdown", common));
    element.dispatchEvent(new MouseEvent("mousedown", common));
    element.dispatchEvent(new PointerEvent("pointerup", common));
    element.dispatchEvent(new MouseEvent("mouseup", common));
    element.dispatchEvent(new MouseEvent("click", common));
  }

  function dataURLtoFile(dataUrl, filename) {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  // ── Mode Switching (Image vs Video) ──
  function hasModeIcon(el, targetMode) {
    const prefix = targetMode === "image" ? ModeIcons.Image : ModeIcons.Video;
    return Array.from(el.querySelectorAll("svg path")).some((p) =>
      (p.getAttribute("d") || "").startsWith(prefix)
    );
  }

  function findModeTriggerButton() {
    return (
      Array.from(document.querySelectorAll("button")).find(
        (btn) =>
          (hasModeIcon(btn, "image") || hasModeIcon(btn, "video")) &&
          Boolean(btn.closest('[aria-haspopup="menu"]'))
      ) || null
    );
  }

  function getCurrentMode() {
    const trigger = findModeTriggerButton();
    if (!trigger) return null;
    if (hasModeIcon(trigger, "image")) return "image";
    if (hasModeIcon(trigger, "video")) return "video";
    return null;
  }

  async function ensureMode(targetMode) {
    if (getCurrentMode() === targetMode) return true;

    const trigger = findModeTriggerButton();
    if (!trigger) {
      console.warn("[Vibes-Adapter] Could not locate mode dropdown trigger button");
      return false;
    }

    simulateClick(trigger);
    const menu = await waitFor(() =>
      document.querySelector('[role="menu"][data-state="open"]')
    );
    if (!menu) return false;

    const items = Array.from(menu.querySelectorAll('button[role="menuitem"]'));
    const targetItem = items.find((btn) => hasModeIcon(btn, targetMode));
    if (!targetItem) return false;

    simulateClick(targetItem);
    const switched = await waitFor(() => getCurrentMode() === targetMode ? true : null, 4000);
    return Boolean(switched);
  }

  // ── Lexical Composer Text Injection ──
  async function fillComposer(prompt) {
    const composer = await waitFor(() =>
      document.querySelector(Selectors.ComposerInput)
    );
    if (!composer) return false;

    const expected = prompt.trim();
    for (let attempt = 0; attempt < 4; attempt++) {
      composer.focus();
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, prompt);
      await sleep(200);
      if (composer.textContent.trim() === expected) {
        return true;
      }
    }
    return false;
  }

  // ── Start Frame Attachment (for Video Mode) ──
  async function attachStartFrame(imageBase64, imageName) {
    // 1. Ensure Start/End frame toggle panel is open
    let addStartBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) =>
        !btn.disabled &&
        Array.from(btn.querySelectorAll("svg path")).some((p) =>
          (p.getAttribute("d") || "").startsWith(Icons.AddFrame)
        )
    );

    if (!addStartBtn) {
      const toggle = document.querySelector(Selectors.StartFrameToggle);
      if (toggle) {
        simulateClick(toggle);
        addStartBtn = await waitFor(() =>
          Array.from(document.querySelectorAll("button")).find(
            (btn) =>
              !btn.disabled &&
              Array.from(btn.querySelectorAll("svg path")).some((p) =>
                (p.getAttribute("d") || "").startsWith(Icons.AddFrame)
              )
          )
        );
      }
    }

    if (!addStartBtn) {
      console.warn("[Vibes-Adapter] Could not find 'Add start frame' button");
      return false;
    }

    simulateClick(addStartBtn);

    // 2. Wait for picker dialog
    const pickerDialog = await waitFor(() =>
      document.querySelector('[role="dialog"][data-state="open"]')
    );
    if (!pickerDialog) return false;

    // 3. Find and click Upload button
    const uploadBtn = Array.from(pickerDialog.querySelectorAll("button")).find((btn) =>
      Array.from(btn.querySelectorAll("svg path")).some((p) =>
        (p.getAttribute("d") || "").startsWith(Icons.Upload)
      )
    );
    if (!uploadBtn) return false;

    simulateClick(uploadBtn);

    // 4. Wait for upload subdialog containing file input
    const uploadDialog = await waitFor(() =>
      Array.from(document.querySelectorAll('[role="dialog"][data-state="open"]')).find(
        (d) => d !== pickerDialog
      )
    );
    if (!uploadDialog) return false;

    const fileInput = uploadDialog.querySelector('input[type="file"]');
    if (!fileInput) return false;

    // Convert base64 data to File and assign via DataTransfer
    const file = dataURLtoFile(imageBase64, imageName || "reference.jpg");
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    // 5. Click confirmation button in upload dialog
    await sleep(800);
    const confirmBtn = Array.from(uploadDialog.querySelectorAll("button")).find(
      (btn) => !btn.hasAttribute("aria-label") && !btn.disabled
    );
    if (confirmBtn) simulateClick(confirmBtn);

    // 6. Click 'Add to video' in picker dialog once uploaded image appears
    await sleep(1000);
    const addToVideoBtn = Array.from(pickerDialog.querySelectorAll("button")).find(
      (btn) =>
        btn.textContent?.includes("Add to video") ||
        btn.className.includes("bg_button.primary") ||
        (!btn.hasAttribute("aria-label") && !btn.disabled)
    );

    if (addToVideoBtn) {
      simulateClick(addToVideoBtn);
      await sleep(600);
      return true;
    }

    return false;
  }

  // ── Gallery Thumbnail Polling ──
  function getKnownMediaIds() {
    const ids = new Set();
    document.querySelectorAll(Selectors.GalleryThumbnail).forEach((card) => {
      const id = card.getAttribute("data-analytics-media-id");
      if (id) ids.add(id);
    });
    return ids;
  }

  async function pollGenerationResult(knownMediaIds, mode, timeoutMs = 180000) {
    const start = Date.now();
    let targetCard = null;
    let targetMediaId = null;

    // Phase 1: Wait for a new media card to appear in the gallery
    while (Date.now() - start < 30000) {
      if (isAborted) return { success: false, error: "Aborted by user" };

      const cards = document.querySelectorAll(Selectors.GalleryThumbnail);
      for (const card of Array.from(cards)) {
        const id = card.getAttribute("data-analytics-media-id");
        if (id && !knownMediaIds.has(id)) {
          targetMediaId = id;
          targetCard = card;
          break;
        }
      }
      if (targetCard) break;
      await sleep(500);
    }

    if (!targetCard || !targetMediaId) {
      return { success: false, error: "Timed out waiting for new generation slot" };
    }

    // Phase 2: Poll the card until media rendering is complete
    const escapedId = CSS.escape(targetMediaId);
    while (Date.now() - start < timeoutMs) {
      if (isAborted) return { success: false, error: "Aborted by user" };

      const currentCard = document.querySelector(
        `${Selectors.GalleryThumbnail}[data-analytics-media-id="${escapedId}"]`
      );

      if (currentCard) {
        // Check for error toast or failure marker
        const hasFailed = Array.from(currentCard.querySelectorAll("span")).some(
          (s) => s.textContent?.includes("Couldn't generate") || s.textContent?.includes("Failed")
        );
        if (hasFailed) {
          return { success: false, error: "Vibes reported 'Couldn't generate'" };
        }

        // Image check: real img rendered with dimensions
        if (mode === "image") {
          const img = currentCard.querySelector('img[data-nimg="fill"]') || currentCard.querySelector("img");
          if (img && img.complete && img.naturalWidth > 0 && img.src) {
            return { success: true, url: img.src, mediaId: targetMediaId };
          }
        }

        // Video check: video element mounted with valid metadata and readyState
        if (mode === "video") {
          const video = currentCard.querySelector("video[src]");
          if (
            video &&
            video.readyState >= HTMLMediaElement.HAVE_METADATA &&
            READY_VIDEO_PATTERN.test(video.src)
          ) {
            return { success: true, url: video.src, mediaId: targetMediaId };
          }
        }
      }

      await sleep(1000);
    }

    return { success: false, error: "Generation timed out after 3 minutes" };
  }

  // ── Core Scene Runner ──
  async function handleGenerateScene(params) {
    const { prompt, mode = "image", imageBase64, imageName, sceneNumber } = params;
    isAborted = false;

    console.log(`[Vibes-Adapter] Starting Scene ${sceneNumber} in ${mode.toUpperCase()} mode`);

    // 1. Ensure correct mode
    const modeReady = await ensureMode(mode);
    if (!modeReady) {
      return { success: false, error: `Failed to activate ${mode} mode on vibes.ai` };
    }
    await sleep(600);

    // 2. Attach start frame if video mode
    if (mode === "video") {
      if (!imageBase64) {
        return { success: false, error: "Missing reference start frame image for video generation" };
      }
      const attached = await attachStartFrame(imageBase64, imageName);
      if (!attached) {
        return { success: false, error: "Failed to upload and attach start frame" };
      }
      await sleep(600);
    }

    // 3. Inject prompt
    const filled = await fillComposer(prompt);
    if (!filled) {
      return { success: false, error: "Failed to inject prompt text into composer" };
    }
    await sleep(800);

    // 4. Capture current media IDs baseline before clicking generate
    const knownIds = getKnownMediaIds();

    // 5. Click Generate button
    const btnSelector = mode === "image" ? Selectors.GenerateButtonImage : Selectors.GenerateButtonVideo;
    const generateBtn = await waitFor(() => {
      const btn = document.querySelector(btnSelector);
      return btn && !btn.disabled ? btn : null;
    }, 8000);

    if (!generateBtn) {
      return { success: false, error: "Generate button remained disabled or was not found" };
    }

    simulateClick(generateBtn);
    await sleep(1200);

    // 6. Poll for ready media
    return await pollGenerationResult(knownIds, mode);
  }

  // ── Message Listener ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "vibes_ping") {
      sendResponse({ status: "ready", mode: getCurrentMode() });
      return true;
    }

    if (message.action === "vibes_stop") {
      isAborted = true;
      sendResponse({ status: "aborted" });
      return true;
    }

    if (message.action === "vibes_generate_scene") {
      handleGenerateScene(message)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
      return true; // Keep message channel open for async response
    }
  });
})();
