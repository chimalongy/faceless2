/* Faceless Studio — Background Service Worker
 * Queue orchestrator with CDP trusted input for Flow automation.
 */
"use strict";

const DEFAULT_BASE_URL = "http://localhost:3000";

const DEFAULTS = {
  pollTimeoutSec: 240,
  gapSec: 2,
  autoDownload: true,
};

let RUN = null;
let PENDING_NAMES = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitize(s) {
  return String(s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

// ---- Settings helpers -------------------------------------------------------
async function getBaseUrl() {
  const { baseUrl } = await chrome.storage.local.get("baseUrl");
  return baseUrl || DEFAULT_BASE_URL;
}

async function getAuthToken() {
  const { authToken } = await chrome.storage.local.get("authToken");
  return authToken || null;
}

// ---- API helpers (proxy for sidepanel) --------------------------------------
async function apiCall(path, options = {}) {
  const baseUrl = await getBaseUrl();
  const url = baseUrl.replace(/\/+$/, "") + path;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res.json();
}

// ---- Download one media URL -------------------------------------------------
async function downloadOne(tabId, url, filename) {
  PENDING_NAMES = [filename];
  return await new Promise((res) => {
    try {
      chrome.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false }, (id) => {
        res(!chrome.runtime.lastError && id != null);
      });
    } catch (e) { PENDING_NAMES = []; res(false); }
  });
}

// Rename downloads to our chosen filenames
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (!PENDING_NAMES.length) return false;
  const filename = PENDING_NAMES.shift();
  suggest({ filename, conflictAction: "uniquify" });
  return true;
});

// ---- Trusted typing via Chrome Debugger (CDP) -------------------------------
let ATTACHED = null;

function dbgCmd(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(res);
    });
  });
}

function dbgAttach(tabId) {
  return new Promise((resolve, reject) => {
    if (ATTACHED === tabId) return resolve();
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      ATTACHED = tabId;
      resolve();
    });
  });
}

function dbgDetach() {
  return new Promise((resolve) => {
    if (ATTACHED == null) return resolve();
    const id = ATTACHED; ATTACHED = null;
    chrome.debugger.detach({ tabId: id }, () => resolve());
  });
}

chrome.debugger.onDetach.addListener((src) => { if (src.tabId === ATTACHED) ATTACHED = null; });

async function cdpClick(tabId, x, y) {
  await dbgCmd(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await dbgCmd(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

async function cdpHover(tabId, x, y) {
  await dbgCmd(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
}

async function cdpType(tabId, x, y, text) {
  await dbgAttach(tabId);
  if (typeof x === "number") await cdpClick(tabId, x, y);
  await dbgCmd(tabId, "Input.insertText", { text });
}

async function cdpEnter(tabId) {
  await dbgAttach(tabId);
  const k = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  await dbgCmd(tabId, "Input.dispatchKeyEvent", { type: "keyDown", ...k });
  await dbgCmd(tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...k });
}

// CDP-based tile download (trusted hover → ⋮ → Download)
async function cdpDownloadTile(tabId, index, filename) {
  try {
    const tr = await send(tabId, { cmd: "tileRect", index });
    if (!tr.ok) return false;
    await cdpHover(tabId, tr.x, tr.y); await sleep(350);
    const mr = await send(tabId, { cmd: "moreRect", index });
    if (!mr.ok) return false;
    await cdpClick(tabId, mr.x, mr.y); await sleep(450);
    const dr = await send(tabId, { cmd: "downloadItemRect" });
    if (!dr.ok) { await send(tabId, { cmd: "dismiss" }); return false; }
    PENDING_NAMES = [filename];
    await cdpClick(tabId, dr.x, dr.y); await sleep(1200);
    return true;
  } catch (e) {
    try { await send(tabId, { cmd: "dismiss" }); } catch (_) { }
    return false;
  }
}

// ---- Messaging helpers ------------------------------------------------------
function send(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
      resolve(resp || { ok: false, error: "no response" });
    });
  });
}

function emit(evt) {
  chrome.runtime.sendMessage({ type: "progress", ...evt }).catch(() => { });
}

async function findFlowTab() {
  const tabs = await chrome.tabs.query({ url: "https://labs.google/fx/tools/flow*" });
  return tabs[0] || null;
}

// ---- Wait for generation to complete ----------------------------------------
async function waitForCompletion(tabId, mediaBefore) {
  const deadline = Date.now() + DEFAULTS.pollTimeoutSec * 1000;
  let grew = false;
  await sleep(2500);
  while (Date.now() < deadline) {
    if (RUN.stopped) return;
    const st = await send(tabId, { cmd: "status" });
    if (st.ok) {
      if ((st.media || 0) + (st.videos || 0) > mediaBefore) grew = true;
      if (grew && !st.generating) { await sleep(1500); return; }
    }
    await sleep(2500);
  }
  emit({ kind: "warn", message: "poll timeout — moving on" });
}

// ---- Main run loop ----------------------------------------------------------
async function runLoop() {
  const tabId = RUN.tabId;
  const queue = RUN.queue;

  // Ensure auto-generate is on
  let ag = { ok: false };
  for (let a = 0; a < 3 && !ag.ok; a++) { ag = await send(tabId, { cmd: "autogen" }); if (!ag.ok) await sleep(700); }
  if (!ag.ok) emit({ kind: "warn", message: "couldn't set auto-generate — set 'Confirm: Never' in Flow settings" });
  else emit({ kind: "info", message: "✓ auto-generate enabled" });

  // Connect CDP
  try {
    await dbgAttach(tabId);
    emit({ kind: "info", message: "✓ trusted typing connected" });
  } catch (e) {
    emit({ kind: "error", message: "Can't connect debugger: " + e.message + " — CLOSE DevTools on the Flow tab, then retry" });
    await dbgDetach();
    RUN.running = false;
    emit({ kind: "stopped", index: RUN.i, total: queue.length });
    return;
  }

  for (; RUN.i < queue.length; RUN.i++) {
    if (RUN.stopped) break;
    while (RUN.paused && !RUN.stopped) await sleep(400);
    if (RUN.stopped) break;

    const job = queue[RUN.i];
    emit({ kind: "start", index: RUN.i, total: queue.length, job });

    // Dismiss stray menus
    await send(tabId, { cmd: "dismiss" });

    // Ensure Flow tab is active in browser so CDP input is delivered
    try { await chrome.tabs.update(tabId, { active: true }); } catch (_) { }

    // Focus + clear the prompt box
    const f = await send(tabId, { cmd: "focusPrompt" });
    if (!f.ok) {
      emit({ kind: "error", index: RUN.i, job, message: "focus: " + f.error });
      await sleep(DEFAULTS.gapSec * 1000); continue;
    }

    // Type with trusted keystrokes
    const normText = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const promptKey = normText(job.prompt).slice(0, 24);
    const didType = async () => {
      const r = await send(tabId, { cmd: "readPrompt" });
      if (!r.ok) return false;
      const t = normText(r.text || r.raw || "");
      return t.length > 0 && (t.includes(promptKey) || t.includes(promptKey.slice(0, 10)) || promptKey.includes(t.slice(0, 10)));
    };

    let typed = false;
    for (let a = 0; a < 3 && !typed && !RUN.stopped; a++) {
      if (a > 0) {
        await send(tabId, { cmd: "dismiss" });
        const rf = await send(tabId, { cmd: "focusPrompt" });
        if (rf.ok) { f.x = rf.x; f.y = rf.y; }
        await sleep(250);
      }
      try { await cdpType(tabId, f.x, f.y, job.prompt); }
      catch (e) { emit({ kind: "warn", message: "type error: " + e.message }); }
      await sleep(400);
      typed = await didType();

      if (!typed) {
        // Fallback: direct DOM text insertion via content script
        const ins = await send(tabId, { cmd: "insertText", text: job.prompt });
        if (ins.ok) {
          await sleep(350);
          typed = await didType();
        }
      }
    }

    if (!typed) {
      emit({ kind: "error", index: RUN.i, job, message: "prompt didn't type — skipping (make sure Flow tab is focused)" });
      await send(tabId, { cmd: "dismiss" });
      await sleep(DEFAULTS.gapSec * 1000);
      continue;
    }

    // Submit with trusted click + verify
    const boxCleared = async () => {
      const r = await send(tabId, { cmd: "readPrompt" });
      if (!r.ok) return true;
      const t = normText(r.text || r.raw || "");
      return t.length === 0 || !t.includes(promptKey.slice(0, 10));
    };

    let submitted = false;
    for (let attempt = 0; attempt < 6 && !submitted && !RUN.stopped; attempt++) {
      for (let w = 0; w < 12; w++) { const se = await send(tabId, { cmd: "submitEnabled" }); if (se.ok && se.enabled) break; await sleep(250); }
      const sr = await send(tabId, { cmd: "submitRect" });
      if (sr.ok) { try { await cdpClick(tabId, sr.x, sr.y); } catch (e) { } }
      for (let t = 0; t < 8 && !submitted; t++) { await sleep(350); if (await boxCleared()) submitted = true; }
      if (submitted) break;
      const pr = await send(tabId, { cmd: "promptRect" });
      if (pr.ok) { try { await cdpClick(tabId, pr.x, pr.y); await sleep(120); await cdpEnter(tabId); } catch (e) { } }
      for (let t = 0; t < 6 && !submitted; t++) { await sleep(350); if (await boxCleared()) submitted = true; }
    }

    if (!submitted) {
      emit({ kind: "error", index: RUN.i, job, message: "couldn't submit — skipping" });
      await send(tabId, { cmd: "dismiss" });
      await sleep(DEFAULTS.gapSec * 1000);
      continue;
    }

    // Wait for generation to complete (skip for instruction — just wait for agent to respond)
    const beforeImg = f.before || 0, beforeVid = f.beforeVid || 0;
    if (job.isInstruction) {
      // For instruction: just wait for the agent to process it, no image expected
      await waitForCompletion(tabId, beforeImg + beforeVid);
      emit({ kind: "info", message: "✓ Instruction sent — agent is ready" });
    } else {
      await waitForCompletion(tabId, beforeImg + beforeVid);

      // Download the result (only for actual scene prompts)
      if (!RUN.stopped && DEFAULTS.autoDownload) {
        await downloadJob(tabId, job, beforeImg);
      }
      RUN.completedScenes = (RUN.completedScenes || 0) + (job.sceneNumbers?.length || 1);
    }

    emit({
      kind: "done",
      index: RUN.i,
      job,
      completedScenes: RUN.completedScenes,
      totalScenes: RUN.totalScenes,
      total: queue.length,
    });
    await sleep(DEFAULTS.gapSec * 1000);
  }

  await dbgDetach();
  const finished = RUN.i >= queue.length;
  emit({
    kind: finished ? "finished" : "stopped",
    index: RUN.i,
    total: RUN.totalScenes || queue.length,
    completedScenes: RUN.completedScenes,
    totalBatches: queue.length,
  });
  RUN.running = false;
}

// Download the newest image(s) produced by the current job
async function downloadJob(tabId, job, beforeImg) {
  const mres = await send(tabId, { cmd: "mediaItems" });
  const images = (mres.ok && mres.images) || [];
  const newImg = Math.max(0, images.length - (beforeImg || 0));

  const sceneNumbers = job.sceneNumbers && job.sceneNumbers.length > 0
    ? job.sceneNumbers
    : (job.sceneNumber != null ? [job.sceneNumber] : []);

  if (sceneNumbers.length === 0) return;

  if (newImg === 0) {
    const label = sceneNumbers.length === 1 ? `scene ${sceneNumbers[0]}` : `scenes ${sceneNumbers.join(", ")}`;
    emit({ kind: "warn", message: `no new image for ${label} — skipping download` });
    return;
  }

  const folder = RUN.downloadFolder || "Faceless";
  const newImageItems = images.length > beforeImg ? images.slice(0, newImg) : images;

  for (let k = 0; k < sceneNumbers.length; k++) {
    const sceneNumber = sceneNumbers[k];
    const filename = `${folder}/${sceneNumber}.png`;
    const targetImg = newImageItems[k] || images[k];

    let ok = false;
    if (targetImg?.src) {
      try { ok = await downloadOne(tabId, targetImg.src, filename); } catch (e) { }
    }
    if (!ok) {
      try { ok = await cdpDownloadTile(tabId, k, filename); } catch (e) { }
    }

    const isThumb = sceneNumber === "thumbnail";
    if (ok) {
      emit({ kind: "info", message: `✓ saved ${isThumb ? "thumbnail" : `scene ${sceneNumber}`} → Downloads/${filename}` });
    } else {
      emit({ kind: "warn", message: `download failed for ${isThumb ? "thumbnail" : `scene ${sceneNumber}`}` });
    }
    await sleep(200);
  }
}

// ---- Extension setup --------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => { });
});

// ---- Message handler --------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      // ── Auth ──
      case "login": {
        try {
          const baseUrl = (msg.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
          const res = await fetch(baseUrl + "/api/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(msg.remember ? { "x-remember": "true" } : {}),
            },
            body: JSON.stringify({ email: msg.email, password: msg.password }),
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            await chrome.storage.local.set({ authToken: "true", baseUrl });
            return sendResponse({ ok: true });
          }
          return sendResponse({ ok: false, error: data.error || "Login failed" });
        } catch (e) {
          return sendResponse({ ok: false, error: "Cannot reach server: " + e.message });
        }
      }

      case "logout": {
        await chrome.storage.local.remove(["authToken"]);
        return sendResponse({ ok: true });
      }

      case "checkAuth": {
        const token = await getAuthToken();
        return sendResponse({ ok: !!token });
      }

      // ── API proxy (for sidepanel to fetch data) ──
      case "apiGet": {
        try {
          const data = await apiCall(msg.path);
          return sendResponse({ ok: true, data });
        } catch (e) {
          return sendResponse({ ok: false, error: e.message });
        }
      }

      // ── Send context instruction to Flow agent (on topic select) ──
      case "sendInstruction": {
        try {
          const tab = await findFlowTab();
          if (!tab) return sendResponse({ ok: false, error: "No Flow tab found" });

          // Inject adapter if needed
          let ping = await send(tab.id, { cmd: "ping" });
          if (!ping.ok) {
            try {
              await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["flow-adapter.js"] });
              await sleep(300);
            } catch (e) {
              return sendResponse({ ok: false, error: "Couldn't inject adapter" });
            }
            ping = await send(tab.id, { cmd: "ping" });
            if (!ping.ok) return sendResponse({ ok: false, error: "Flow adapter not loaded" });
          }

          // Attach debugger, type instruction, submit
          await dbgAttach(tab.id);

          const f = await send(tab.id, { cmd: "focusPrompt" });
          if (!f.ok) {
            await dbgDetach();
            return sendResponse({ ok: false, error: "Prompt box not found — is the Flow tab on a project?" });
          }

          await cdpType(tab.id, f.x, f.y, msg.instruction);
          await sleep(400);

          // Submit
          const sr = await send(tab.id, { cmd: "submitRect" });
          if (sr.ok) {
            await cdpClick(tab.id, sr.x, sr.y);
          } else {
            await cdpEnter(tab.id);
          }

          // Wait briefly for the agent to process, then detach
          await sleep(3000);
          await dbgDetach();

          return sendResponse({ ok: true });
        } catch (e) {
          try { await dbgDetach(); } catch (_) { }
          return sendResponse({ ok: false, error: e.message });
        }
      }

      // ── Run control ──
      case "start": {
        const tab = await findFlowTab();
        if (!tab) return sendResponse({ ok: false, error: "Open a Google Flow project tab first." });
        let ping = await send(tab.id, { cmd: "ping" });
        if (!ping.ok) {
          try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["flow-adapter.js"] });
            await sleep(300);
          } catch (e) {
            return sendResponse({ ok: false, error: "Couldn't inject adapter: " + e.message + " — reload the Flow tab." });
          }
          ping = await send(tab.id, { cmd: "ping" });
          if (!ping.ok) return sendResponse({ ok: false, error: "Flow adapter not loaded — reload the Flow tab." });
        }
        if (!ping.project) return sendResponse({ ok: false, error: "Open a Flow PROJECT (click New project), then start." });

        // Build download folder path
        const channelSlug = sanitize(msg.channelSlug || "channel");
        const topicSlug = sanitize(msg.topicSlug || "topic");
        const downloadFolder = `Faceless/${channelSlug}/${topicSlug}`;

        RUN = {
          queue: msg.queue,
          i: 0,
          completedScenes: 0,
          totalScenes: msg.totalScenes || msg.queue.length,
          tabId: tab.id,
          paused: false,
          stopped: false,
          running: true,
          downloadFolder,
        };
        runLoop();
        return sendResponse({ ok: true, count: msg.queue.length, totalScenes: RUN.totalScenes });
      }

      case "pause":
        if (RUN) RUN.paused = true;
        return sendResponse({ ok: true });

      case "resume":
        if (RUN) RUN.paused = false;
        return sendResponse({ ok: true });

      case "stop":
        if (RUN) { RUN.stopped = true; }
        dbgDetach();
        return sendResponse({ ok: true });

      case "state":
        return sendResponse({
          ok: true,
          running: !!(RUN && RUN.running),
          i: RUN ? RUN.i : 0,
          total: RUN ? RUN.queue.length : 0,
          paused: RUN ? RUN.paused : false,
        });

      // ── Settings ──
      case "getSettings": {
        const { baseUrl } = await chrome.storage.local.get("baseUrl");
        return sendResponse({ ok: true, baseUrl: baseUrl || DEFAULT_BASE_URL });
      }

      case "saveSettings": {
        await chrome.storage.local.set({ baseUrl: msg.baseUrl || DEFAULT_BASE_URL });
        return sendResponse({ ok: true });
      }

      default:
        return sendResponse({ ok: false, error: "unknown type: " + msg.type });
    }
  })();
  return true;
});

console.log("[Faceless Studio] Background service worker initialized.");
