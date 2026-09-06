/* Faceless Studio — Flow Adapter (content script)
 * DOM automation layer for the Google Flow UI.
 * Adapted from ZIPCushions Flow Automation (open-source, working).
 * Runs in ISOLATED world on Flow project pages.
 */
(() => {
  "use strict";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

  // ---- generic finders -----------------------------------------------------
  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  }

  const CLICKABLE_SEL =
    'button, [role="tab"], [role="radio"], [role="button"], [role="menuitemradio"], [role="option"], a, label, div, span';

  function findByExactText(text, { root = document } = {}) {
    const want = norm(text);
    const scope = root === document ? document.body : root;
    if (!scope) return null;
    const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode;
      if (norm(n.nodeValue) === want) {
        const p = n.parentElement;
        if (p && visible(p)) return p.closest(CLICKABLE_SEL) || p;
      }
    }
    return null;
  }

  // Robust click: dispatch the FULL pointer+mouse sequence (React binds to pointerdown/mousedown)
  function robustClick(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    try { el.scrollIntoView({ block: "nearest" }); } catch (e) {}
    if (window.PointerEvent) el.dispatchEvent(new PointerEvent("pointerover", o));
    el.dispatchEvent(new MouseEvent("mouseover", o));
    if (window.PointerEvent) el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    if (window.PointerEvent) el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
    if (typeof el.click === "function") { try { el.click(); } catch (e) {} }
    return true;
  }

  function clickEl(el) {
    if (!el) return false;
    const target =
      el.closest('button, [role="tab"], [role="radio"], [role="button"], [role="menuitemradio"], [role="option"], a') || el;
    return robustClick(target);
  }

  function singleClick(el) {
    if (!el) return false;
    const target = el.closest('button, [role="button"]') || el;
    try { target.click(); } catch (e) { return false; }
    return true;
  }

  // ---- prompt box ----------------------------------------------------------
  function findPromptBox() {
    const ph = "what do you want to create";
    const editors = [...document.querySelectorAll('[contenteditable="true"], [role="textbox"]')].filter(visible);
    let el = editors.find((e) =>
      norm(e.getAttribute("aria-label") || e.dataset.placeholder || "").includes(ph) ||
      norm(e.textContent).includes(ph)
    );
    if (el) return el;
    el = [...document.querySelectorAll("textarea, input[type=text]")].find((e) => norm(e.placeholder).includes(ph));
    if (el) return el;
    const candidates = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')]
      .filter(visible)
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    return candidates[0] || null;
  }

  async function waitForPromptBox(timeoutMs = 120000) {
    const deadline = Date.now() + timeoutMs;
    let box = findPromptBox();
    while (!box && Date.now() < deadline) { await sleep(500); box = findPromptBox(); }
    return box;
  }

  // ---- submit --------------------------------------------------------------
  function findSubmitButton() {
    const btns = [...document.querySelectorAll("button")].filter(
      (b) => visible(b) && norm(b.textContent).includes("arrow_forward")
    );
    if (btns.length) return btns.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
    return null;
  }

  async function submit() {
    const btn = findSubmitButton();
    if (btn) { robustClick(btn); return true; }
    const box = findPromptBox();
    if (box) {
      box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      box.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
      return true;
    }
    throw new Error("submit control not found");
  }

  // ---- generation state ----------------------------------------------------
  function isGenImg(i) {
    if (!visible(i)) return false;
    // Exclude header / navbar / user profile avatar / sidebar nav
    if (i.closest("header, nav, [role='banner'], [role='navigation'], button[aria-label*='Account'], [aria-label*='Profile']")) {
      return false;
    }

    const r = i.getBoundingClientRect();
    // Tiny images are icons or avatars
    if ((r.width > 0 && r.width < 90) || (r.height > 0 && r.height < 90)) return false;
    if (i.naturalWidth > 0 && i.naturalWidth < 100 && i.naturalHeight > 0 && i.naturalHeight < 100) return false;

    const s = i.currentSrc || i.src || i.getAttribute("src") || "";
    if (!s) return false;

    // Reject known non-content svgs / tracking pixels / logos
    if (s.includes("googlelogo") || s.includes("favicon") || s.endsWith(".svg") || s.includes("avatar")) return false;

    // Match known Flow / Google media patterns
    if (
      s.startsWith("blob:") ||
      s.startsWith("data:image/") ||
      /getMediaUrlRedirect/i.test(s) ||
      /labs\.google/i.test(s) ||
      /flow\.google/i.test(s) ||
      /googleusercontent\.com/i.test(s) ||
      /googleapis\.com/i.test(s) ||
      /\/fx\//i.test(s) ||
      /media/i.test(s) ||
      /image/i.test(s) ||
      /generated/i.test(s) ||
      /output/i.test(s)
    ) {
      return true;
    }

    // Fallback: any reasonably sized image in the main content area
    if (r.width >= 120 && r.height >= 120) {
      return true;
    }

    return false;
  }

  function genImgs() {
    return [...document.querySelectorAll("img")].filter(isGenImg);
  }

  function mediaCaption(img) {
    let el = img;
    for (let i = 0; i < 8 && el.parentElement; i++) {
      el = el.parentElement;
      const leaf = [...el.querySelectorAll("*")].find((e) => {
        if (e.childElementCount !== 0 || !visible(e)) return false;
        const t = (e.textContent || "").trim();
        return t.length > 3 && !/^[a-z_0-9%]+$/.test(t) && !/generated image/i.test(t);
      });
      if (leaf) return (leaf.textContent || "").trim();
    }
    return "";
  }

  function genImgItems() {
    return genImgs().map((img) => ({ src: img.currentSrc || img.src || "", name: mediaCaption(img) }));
  }

  function genVideos() {
    return [...document.querySelectorAll("video")].map((v) => v.currentSrc || v.src).filter(Boolean);
  }

  function countMedia() {
    return genImgs().length;
  }

  function genCount() {
    return [...document.querySelectorAll("div, span")].filter(
      (e) => visible(e) && /^\d{1,3}%$/.test((e.textContent || "").trim())
    ).length;
  }

  function isGenerating() {
    if (genCount() > 0) return true;
    if (document.querySelector('[role="progressbar"], [aria-busy="true"]')) return true;
    const stop = [...document.querySelectorAll("button")].some((b) => {
      if (!visible(b) || b.getBoundingClientRect().top < 300) return false;
      const t = norm(b.textContent), a = norm(b.getAttribute("aria-label") || "");
      return /(^|[^a-z])stop([^a-z]|$)/.test(t) || a.includes("stop");
    });
    if (stop) return true;
    return !!(findPromptBox() && !findSubmitButton());
  }

  // ---- settings: ensure auto-generate --------------------------------------
  function findTuneButton() {
    return [...document.querySelectorAll("button")].find((b) => visible(b) && norm(b.textContent).includes("tune")) || null;
  }
  function settingsPanel() {
    const h = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && norm(e.textContent) === "agent settings");
    if (!h) return null;
    let p = h;
    for (let i = 0; i < 12 && p.parentElement; i++) { p = p.parentElement; if (p.querySelectorAll("button").length > 8) return p; }
    return p;
  }
  function settingsOpen() { return !!settingsPanel(); }

  async function openSettings() {
    if (settingsOpen()) return true;
    const t = findTuneButton();
    if (!t) throw new Error("settings (tune) button not found");
    for (let attempt = 0; attempt < 3; attempt++) {
      if (settingsOpen()) return true;
      singleClick(t);
      for (let i = 0; i < 12; i++) { await sleep(150); if (settingsOpen()) return true; }
    }
    throw new Error("Agent settings panel did not open");
  }

  function setConfirm(mode) {
    const panel = settingsPanel();
    if (!panel) return false;
    const want = mode === "always" ? "always" : "never";
    const radio = [...panel.querySelectorAll('[role="radio"], button')].find((b) => visible(b) && norm(b.textContent).includes(want));
    if (radio && radio.getAttribute("aria-checked") !== "true") { clickEl(radio); }
    return !!radio;
  }

  async function saveSettings() {
    const panel = settingsPanel();
    const save = panel && [...panel.querySelectorAll("button")].find((b) => visible(b) && norm(b.textContent) === "save");
    if (save) { clickEl(save); await sleep(300); return true; }
    return false;
  }

  async function closeSettings() {
    for (let i = 0; i < 3 && settingsOpen(); i++) {
      const panel = settingsPanel();
      const x = panel && [...panel.querySelectorAll("button")].find(
        (b) => visible(b) && /(^|[^a-z])(close|arrow_back)([^a-z]|$)/.test(norm(b.textContent))
      );
      if (x) singleClick(x);
      else document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(150);
    }
    return true;
  }

  async function ensureAutoGenerate() {
    await openSettings();
    const found = setConfirm("never");
    await sleep(120);
    if (found) { await saveSettings(); }
    await closeSettings();
    return { ok: true, found };
  }

  // ---- download helpers ----------------------------------------------------
  async function getImageDataUrl(img) {
    if (!img) return null;
    // 1. Try canvas drawImage (fastest & decodes whatever is visible in the DOM)
    try {
      const canvas = document.createElement("canvas");
      const w = img.naturalWidth || img.clientWidth || 1024;
      const h = img.naturalHeight || img.clientHeight || 1024;
      if (w > 0 && h > 0) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/png");
        if (dataUrl && dataUrl.length > 300) {
          return dataUrl;
        }
      }
    } catch (e) {
      console.debug("[Faceless] Canvas export tainted/failed:", e && e.message);
    }

    // 2. Fetch in tab context with credentials (handles blob: and auth Google URLs)
    const src = img.currentSrc || img.src || img.getAttribute("src");
    if (src) {
      try {
        const resp = await fetch(src, { credentials: "include" });
        if (resp.ok) {
          const blob = await resp.blob();
          return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.debug("[Faceless] Tab fetch failed:", e && e.message);
      }
    }

    return null;
  }

  function findTileForImg(img) {
    if (!img) return null;
    let el = img;
    for (let i = 0; i < 8 && el.parentElement; i++) {
      el = el.parentElement;
      if (el.querySelector("button, [role='button']")) return el;
    }
    return img.parentElement || img;
  }

  function mediaTiles() {
    const imgs = genImgs();
    const tiles = [];
    const seen = new Set();
    for (const img of imgs) {
      const el = findTileForImg(img);
      if (el && !seen.has(el)) { seen.add(el); tiles.push(el); }
    }
    return tiles;
  }

  function findDownloadButton(tile) {
    if (!tile) return null;
    const directBtn = [...tile.querySelectorAll("button, [role='button']")].find((b) => {
      const label = norm(b.getAttribute("aria-label") || "");
      const txt = norm(b.textContent || "");
      const title = norm(b.getAttribute("title") || "");
      return label.includes("download") || txt.includes("download") || title.includes("download");
    });
    if (directBtn && visible(directBtn)) return directBtn;
    return null;
  }

  function findMoreButton(tile) {
    if (!tile) return null;
    return [...tile.querySelectorAll("button, [role='button']")].find((b) => {
      const label = norm(b.getAttribute("aria-label") || "");
      const txt = norm(b.textContent || "");
      const title = norm(b.getAttribute("title") || "");
      return (
        txt.includes("more_vert") ||
        txt.includes("more_horiz") ||
        label.includes("more") ||
        title.includes("more")
      );
    }) || [...tile.querySelectorAll("button")].pop();
  }

  function findDownloadMenuItem() {
    const items = [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"], button, a, div, span')].filter(visible);
    return items.find((el) => {
      const t = norm(el.textContent);
      const a = norm(el.getAttribute("aria-label") || "");
      return t === "download" || t.startsWith("download") || a === "download" || a.startsWith("download");
    });
  }

  async function triggerNativeTileDownload(tile) {
    try {
      tile.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      tile.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      tile.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      await sleep(200);

      const direct = findDownloadButton(tile);
      if (direct) {
        robustClick(direct);
        return true;
      }

      const more = findMoreButton(tile);
      if (more) {
        robustClick(more);
        await sleep(350);
        const dlItem = findDownloadMenuItem();
        if (dlItem) {
          robustClick(dlItem);
          await sleep(300);
          return true;
        }
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
    } catch (e) {
      console.warn("[Faceless] triggerNativeTileDownload error:", e);
    }
    return false;
  }

  async function getDownloadableMedia(beforeSrcs = [], count = 1) {
    const imgs = genImgs();
    const beforeSet = new Set((beforeSrcs || []).filter(Boolean));

    // Prefer images that were NOT in beforeSrcs
    let candidates = imgs.filter((img) => {
      const s = img.currentSrc || img.src || img.getAttribute("src") || "";
      return s && !beforeSet.has(s);
    });

    // Fallback if no URL difference detected: pick newest by layout position or DOM order
    if (candidates.length === 0 && imgs.length > 0) {
      // In chat feeds, newest is at bottom; in galleries, newest is at top.
      // Sort by vertical position (bottom-most first)
      const sortedByBottom = [...imgs].sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.bottom - ra.bottom;
      });
      candidates = sortedByBottom.slice(0, Math.max(1, count));
    }

    const items = [];
    for (let i = 0; i < candidates.length; i++) {
      const img = candidates[i];
      const src = img.currentSrc || img.src || img.getAttribute("src") || "";
      const name = mediaCaption(img);
      const dataUrl = await getImageDataUrl(img);
      const tile = findTileForImg(img);
      const tileIndex = imgs.indexOf(img);
      items.push({
        index: tileIndex >= 0 ? tileIndex : i,
        src,
        name,
        dataUrl,
        hasTile: !!tile,
      });
    }

    return items;
  }

  async function triggerDownload(index, filename) {
    const imgs = genImgs();
    const img = imgs[index] || imgs[imgs.length - 1];
    if (!img) return { ok: false, error: "no image found" };

    const tile = findTileForImg(img);
    if (tile) {
      const clicked = await triggerNativeTileDownload(tile);
      if (clicked) return { ok: true, method: "native" };
    }

    const dataUrl = await getImageDataUrl(img);
    if (dataUrl) {
      try {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = (filename || "image.png").split("/").pop();
        document.body.appendChild(a);
        a.click();
        a.remove();
        return { ok: true, method: "anchor" };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    return { ok: false, error: "could not trigger download" };
  }

  // ---- message router ------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        switch (msg.cmd) {
          case "ping": {
            const isProj =
              /\/project\//.test(location.href) ||
              location.href.includes("project") ||
              Boolean(findPromptBox());
            return sendResponse({ ok: true, url: location.href, project: isProj });
          }
          case "autogen": {
            const r = await ensureAutoGenerate();
            return sendResponse(r);
          }
          case "focusPrompt": {
            const box = await waitForPromptBox();
            if (!box) return sendResponse({ ok: false, error: "prompt box not found (agent still busy?)" });
            box.focus();
            try {
              if (box.value !== undefined) {
                box.value = "";
                box.dispatchEvent(new Event("input", { bubbles: true }));
                box.dispatchEvent(new Event("change", { bubbles: true }));
              }
              const sel = getSelection(), r = document.createRange();
              r.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(r);
              document.execCommand("delete");
              const r2 = document.createRange(); r2.selectNodeContents(box); r2.collapse(false);
              sel.removeAllRanges(); sel.addRange(r2);
            } catch (e) {}
            const rect = box.getBoundingClientRect();
            const currentImgs = genImgs();
            const beforeSrcs = currentImgs.map((img) => img.currentSrc || img.src || img.getAttribute("src") || "").filter(Boolean);
            return sendResponse({
              ok: true,
              before: currentImgs.length,
              beforeVid: genVideos().length,
              beforeSrcs,
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            });
          }
          case "insertText": {
            const box = await waitForPromptBox();
            if (!box) return sendResponse({ ok: false, error: "prompt box not found" });
            box.focus();
            try {
              if (box.value !== undefined && (box.tagName === "TEXTAREA" || box.tagName === "INPUT")) {
                box.value = msg.text || "";
                box.dispatchEvent(new Event("input", { bubbles: true }));
                box.dispatchEvent(new Event("change", { bubbles: true }));
              } else {
                const sel = getSelection(), r = document.createRange();
                r.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(r);
                document.execCommand("delete");
                const inserted = document.execCommand("insertText", false, msg.text || "");
                if (!inserted || !box.textContent.trim()) {
                  box.innerText = msg.text || "";
                  box.dispatchEvent(new InputEvent("input", { bubbles: true, data: msg.text }));
                }
              }
              const rect = box.getBoundingClientRect();
              return sendResponse({ ok: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            } catch (e) {
              return sendResponse({ ok: false, error: e.message });
            }
          }
          case "clickSubmit": {
            await submit();
            return sendResponse({ ok: true });
          }
          case "promptRect": {
            const box = findPromptBox();
            if (!box) return sendResponse({ ok: false, error: "prompt box not found" });
            const r = box.getBoundingClientRect();
            return sendResponse({ ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }
          case "submitEnabled": {
            const b = findSubmitButton();
            const dis = !!b && (b.disabled || b.getAttribute("aria-disabled") === "true");
            return sendResponse({ ok: true, present: !!b, enabled: !!b && !dis });
          }
          case "readPrompt": {
            const box = findPromptBox();
            if (!box) return sendResponse({ ok: false, error: "prompt box not found" });
            const raw = box.value !== undefined ? box.value : (box.innerText || box.textContent || "");
            return sendResponse({ ok: true, text: norm(raw), raw });
          }
          case "dismiss": {
            for (let i = 0; i < 2; i++) {
              document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
              await sleep(90);
            }
            return sendResponse({ ok: true });
          }
          case "submitRect": {
            const btn = findSubmitButton();
            if (!btn) return sendResponse({ ok: false, error: "submit button not found" });
            btn.scrollIntoView({ block: "nearest" });
            const r = btn.getBoundingClientRect();
            return sendResponse({ ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }
          case "status":
            return sendResponse({ ok: true, generating: isGenerating(), genCount: genCount(), media: countMedia(), videos: genVideos().length });
          case "mediaItems":
            return sendResponse({ ok: true, images: genImgItems(), videos: genVideos() });
          case "getDownloadableMedia": {
            const items = await getDownloadableMedia(msg.beforeSrcs || [], msg.count || 1);
            return sendResponse({ ok: true, items });
          }
          case "triggerDownload": {
            const r = await triggerDownload(msg.index, msg.filename);
            return sendResponse(r);
          }
          case "tileRect": {
            const t = mediaTiles()[msg.index];
            if (!t) return sendResponse({ ok: false, error: "no tile " + msg.index });
            t.scrollIntoView({ block: "center" });
            await sleep(120);
            const r = t.getBoundingClientRect();
            return sendResponse({ ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }
          case "moreRect": {
            const t = mediaTiles()[msg.index];
            if (!t) return sendResponse({ ok: false, error: "no tile " + msg.index });
            t.scrollIntoView({ block: "center" });
            await sleep(80);
            let m = findMoreButton(t);
            if (!m) return sendResponse({ ok: false, error: "no more button" });
            const r = m.getBoundingClientRect();
            return sendResponse({ ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }
          case "downloadItemRect": {
            const el = findDownloadMenuItem() || findByExactText("Download");
            if (!el) return sendResponse({ ok: false, error: "no Download item" });
            const r = el.getBoundingClientRect();
            return sendResponse({ ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }
          default:
            return sendResponse({ ok: false, error: "unknown cmd " + msg.cmd });
        }
      } catch (e) {
        return sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  });

  console.log("[Faceless Studio] Flow adapter loaded on", location.href);
})();
