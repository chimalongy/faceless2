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
    const s = i.src || "";
    if (i.naturalWidth && i.naturalWidth < 220) return false;
    return /getMediaUrlRedirect/.test(s) ||
      /labs\.google\/fx\/api\/.*media/i.test(s) ||
      /\/fx\/.*\/(media|image|result)/i.test(s) ||
      (/(lh3|lh4|lh5|lh6)\.googleusercontent/.test(s) && !/\/a[/-]/.test(s)) ||
      (/googleusercontent/.test(s) && !/\/a\//.test(s));
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
        return t.length > 4 && !/^[a-z_0-9%]+$/.test(t) && !/generated image/i.test(t);
      });
      if (leaf) return (leaf.textContent || "").trim();
    }
    return "";
  }

  function genImgItems() {
    return genImgs().map((img) => ({ src: img.src, name: mediaCaption(img) }));
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
  function mediaTiles() {
    const imgs = genImgs();
    const tiles = [];
    const seen = new Set();
    for (const img of imgs) {
      let el = img;
      for (let i = 0; i < 8 && el.parentElement; i++) {
        el = el.parentElement;
        if (el.querySelector("button")) break;
      }
      if (el && !seen.has(el)) { seen.add(el); tiles.push(el); }
    }
    return tiles;
  }

  // ---- message router ------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        switch (msg.cmd) {
          case "ping":
            return sendResponse({ ok: true, url: location.href, project: /\/project\//.test(location.href) });
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
            return sendResponse({ ok: true, before: countMedia(), beforeVid: genVideos().length, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
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
            let m = [...t.querySelectorAll("button")].find((b) => norm(b.textContent).includes("more_vert"));
            if (!m) m = [...t.querySelectorAll("button")].pop();
            if (!m) return sendResponse({ ok: false, error: "no more button" });
            const r = m.getBoundingClientRect();
            return sendResponse({ ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }
          case "downloadItemRect": {
            const el = findByExactText("Download");
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
