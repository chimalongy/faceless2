/* Faceless Studio — Vibes AI Generator
 * Sidepanel Core Controller
 */
"use strict";

(() => {
  // ── DOM References ──
  const $ = (id) => document.getElementById(id);

  const connectionStatus = $("connectionStatus");
  const statusLabel = $("statusLabel");

  const modeImageBtn = $("modeImageBtn");
  const modeVideoBtn = $("modeVideoBtn");

  const tabLocalBtn = $("tabLocalBtn");
  const tabApiBtn = $("tabApiBtn");
  const localFolderSection = $("localFolderSection");
  const apiSection = $("apiSection");

  const selectFolderBtn = $("selectFolderBtn");
  const folderBadge = $("folderBadge");
  const projectInfo = $("projectInfo");
  const folderNameText = $("folderNameText");
  const scenesFoundCount = $("scenesFoundCount");

  const apiUrlInput = $("apiUrlInput");
  const apiEmailInput = $("apiEmailInput");
  const apiPasswordInput = $("apiPasswordInput");
  const apiConnectBtn = $("apiConnectBtn");
  const topicDropdowns = $("topicDropdowns");
  const channelSelect = $("channelSelect");
  const pillarSelect = $("pillarSelect");
  const topicSelect = $("topicSelect");

  const startSceneInput = $("startSceneInput");
  const delaySecondsInput = $("delaySecondsInput");
  const removeWatermarkCheckbox = $("removeWatermarkCheckbox");
  const autoDownloadCheckbox = $("autoDownloadCheckbox");

  const queueProgressBadge = $("queueProgressBadge");
  const queueProgressBar = $("queueProgressBar");
  const sceneList = $("sceneList");
  const startBatchBtn = $("startBatchBtn");
  const stopBatchBtn = $("stopBatchBtn");
  const clearLogsBtn = $("clearLogsBtn");
  const logConsole = $("logConsole");

  // ── State ──
  let currentMode = "image"; // "image" | "video"
  let scenes = [];
  let projectHandle = null;
  let isRunning = false;
  let activeVibesTabId = null;

  // ── Logging Helper ──
  function log(message, type = "info") {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${time}] ${message}`;
    logConsole.appendChild(entry);
    logConsole.scrollTop = logConsole.scrollHeight;
  }

  clearLogsBtn.addEventListener("click", () => {
    logConsole.innerHTML = "";
    log("Logs cleared.", "info");
  });

  // ── Ensure Content Script is Injected ──
  async function ensureAdapterInjected(tabId) {
    if (!tabId) return false;
    try {
      const ping = await chrome.tabs.sendMessage(tabId, { action: "vibes_ping" }).catch(() => null);
      if (ping && ping.status === "ready") {
        return true;
      }
      log("Injecting vibes-adapter script into vibes.ai tab...", "info");
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["vibes-adapter.js"],
      });
      await new Promise((r) => setTimeout(r, 500));
      const retryPing = await chrome.tabs.sendMessage(tabId, { action: "vibes_ping" }).catch(() => null);
      return Boolean(retryPing && retryPing.status === "ready");
    } catch (err) {
      console.warn("Adapter injection error:", err);
      return false;
    }
  }

  // ── Check Active Vibes.ai Tab ──
  async function checkVibesTab() {
    try {
      const tabs = await chrome.tabs.query({ url: ["*://*.vibes.ai/*", "*://vibes.ai/*"] });
      if (tabs && tabs.length > 0) {
        activeVibesTabId = tabs[0].id;
        const ping = await chrome.tabs.sendMessage(activeVibesTabId, { action: "vibes_ping" }).catch(() => null);
        if (ping && ping.status === "ready") {
          connectionStatus.className = "status-indicator connected";
          statusLabel.textContent = "Vibes.ai Connected";
        } else {
          // Attempt automatic injection
          const injected = await ensureAdapterInjected(activeVibesTabId);
          if (injected) {
            connectionStatus.className = "status-indicator connected";
            statusLabel.textContent = "Vibes.ai Connected";
          } else {
            connectionStatus.className = "status-indicator";
            statusLabel.textContent = "Refresh Vibes.ai Tab";
          }
        }
      } else {
        activeVibesTabId = null;
        connectionStatus.className = "status-indicator";
        statusLabel.textContent = "Vibes.ai Tab Not Found";
      }
    } catch {
      connectionStatus.className = "status-indicator";
      statusLabel.textContent = "Offline";
    }
  }

  setInterval(checkVibesTab, 3000);
  checkVibesTab();

  // ── Mode Toggle (Image vs Video) ──
  function setMode(mode) {
    currentMode = mode;
    if (mode === "image") {
      modeImageBtn.classList.add("active");
      modeVideoBtn.classList.remove("active");
      log("Switched to Image Batch Mode", "info");
    } else {
      modeVideoBtn.classList.add("active");
      modeImageBtn.classList.remove("active");
      log("Switched to Video Batch Mode (Image-to-Video)", "info");
    }
    renderSceneList();
  }

  modeImageBtn.addEventListener("click", () => setMode("image"));
  modeVideoBtn.addEventListener("click", () => setMode("video"));

  // ── Source Tabs (Local Folder vs Studio API) ──
  tabLocalBtn.addEventListener("click", () => {
    tabLocalBtn.classList.add("active");
    tabApiBtn.classList.remove("active");
    localFolderSection.classList.remove("hidden");
    apiSection.classList.add("hidden");
  });

  tabApiBtn.addEventListener("click", () => {
    tabApiBtn.classList.add("active");
    tabLocalBtn.classList.remove("active");
    apiSection.classList.remove("hidden");
    localFolderSection.classList.add("hidden");
  });

  // ── Local Project Folder & script.json Parsing ──
  selectFolderBtn.addEventListener("click", async () => {
    try {
      projectHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      folderBadge.textContent = projectHandle.name;
      folderNameText.textContent = projectHandle.name;

      // Read script.json
      let fileHandle;
      try {
        fileHandle = await projectHandle.getFileHandle("script.json");
      } catch {
        log("No 'script.json' found in selected folder.", "error");
        alert("Please ensure 'script.json' exists in this folder.");
        return;
      }

      const file = await fileHandle.getFile();
      const rawText = await file.text();
      const cleaned = rawText.trim().replace(/^```json\s*|^```\s*|```$/g, "");
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed.scenes)) {
        throw new Error("Missing 'scenes' array in script.json");
      }

      scenes = parsed.scenes.map((s) => ({
        scene_number: Number(s.scene_number),
        image_prompt: s.image_prompt || s.prompt || "",
        video_prompt: s.video_prompt || s.image_prompt || "",
        narration: s.narration || "",
        status: "pending",
      }));

      scenesFoundCount.textContent = scenes.length;
      projectInfo.classList.remove("hidden");
      startBatchBtn.disabled = scenes.length === 0;

      log(`Loaded ${scenes.length} scene(s) from ${projectHandle.name}/script.json`, "success");
      updateProgress();
      renderSceneList();
    } catch (err) {
      if (err.name !== "AbortError") {
        log(`Folder selection error: ${err.message}`, "error");
      }
    }
  });

  // ── Faceless Studio API Integration ──
  let apiChannels = [];

  apiConnectBtn.addEventListener("click", async () => {
    const baseUrl = apiUrlInput.value.trim().replace(/\/$/, "");
    const email = apiEmailInput.value.trim();
    const password = apiPasswordInput.value.trim();

    try {
      log(`Connecting to ${baseUrl}...`, "info");
      if (email && password) {
        await fetch(`${baseUrl}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      }

      const res = await fetch(`${baseUrl}/api/channels`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      apiChannels = data.channels || [];

      channelSelect.innerHTML = '<option value="">— Select Channel —</option>';
      apiChannels.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.slug || c.id;
        opt.textContent = c.title || c.name || c.slug;
        channelSelect.appendChild(opt);
      });

      topicDropdowns.classList.remove("hidden");
      log(`Loaded ${apiChannels.length} channel(s) from Studio.`, "success");
    } catch (err) {
      log(`Studio connection error: ${err.message}`, "error");
    }
  });

  channelSelect.addEventListener("change", async () => {
    const cSlug = channelSelect.value;
    pillarSelect.disabled = true;
    topicSelect.disabled = true;
    if (!cSlug) return;

    try {
      const baseUrl = apiUrlInput.value.trim().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/channels/${cSlug}/pillars`);
      const data = await res.json();
      const pillars = data.pillars || [];

      pillarSelect.innerHTML = '<option value="">— Select Pillar —</option>';
      pillars.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.slug || p.id;
        opt.textContent = p.name || p.title;
        pillarSelect.appendChild(opt);
      });
      pillarSelect.disabled = false;
    } catch (err) {
      log(`Failed to load content pillars: ${err.message}`, "error");
    }
  });

  pillarSelect.addEventListener("change", async () => {
    const cSlug = channelSelect.value;
    const pSlug = pillarSelect.value;
    topicSelect.disabled = true;
    if (!cSlug || !pSlug) return;

    try {
      const baseUrl = apiUrlInput.value.trim().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/channels/${cSlug}/topics?pillarSlug=${pSlug}`);
      const data = await res.json();
      const topics = data.topics || [];

      topicSelect.innerHTML = '<option value="">— Select Topic —</option>';
      topics.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.slug || t.id;
        opt.textContent = t.title || t.name;
        topicSelect.appendChild(opt);
      });
      topicSelect.disabled = false;
    } catch (err) {
      log(`Failed to load topics: ${err.message}`, "error");
    }
  });

  topicSelect.addEventListener("change", async () => {
    const cSlug = channelSelect.value;
    const tSlug = topicSelect.value;
    if (!cSlug || !tSlug) return;

    try {
      const baseUrl = apiUrlInput.value.trim().replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/channels/${cSlug}/topics/${tSlug}`);
      const data = await res.json();
      const topic = data.topic;

      if (!topic?.scenesJson) {
        log("Selected topic has no scenes generated yet.", "warn");
        return;
      }

      const parsedScenes = JSON.parse(topic.scenesJson);
      scenes = parsedScenes.map((s) => ({
        scene_number: Number(s.scene_number),
        image_prompt: s.image_prompt || s.prompt || "",
        video_prompt: s.video_prompt || s.image_prompt || "",
        narration: s.audio_text || s.narration || "",
        status: "pending",
      }));

      startBatchBtn.disabled = scenes.length === 0;
      log(`Loaded ${scenes.length} scenes from Topic "${topic.title}"`, "success");
      updateProgress();
      renderSceneList();
    } catch (err) {
      log(`Error loading topic scenes: ${err.message}`, "error");
    }
  });

  // ── Render Scene Queue List ──
  function renderSceneList() {
    if (scenes.length === 0) {
      sceneList.innerHTML = '<div class="empty-state">No scenes loaded yet. Select a project folder or topic above.</div>';
      return;
    }

    sceneList.innerHTML = "";
    scenes.forEach((s) => {
      const item = document.createElement("div");
      item.className = "scene-item";
      item.id = `scene-row-${s.scene_number}`;

      const promptText = currentMode === "video" ? s.video_prompt : s.image_prompt;

      item.innerHTML = `
        <div class="scene-item-left">
          <span class="scene-num-badge">#${s.scene_number}</span>
          <span class="scene-prompt-preview" title="${promptText}">${promptText || "No prompt"}</span>
        </div>
        <span class="scene-status-pill ${s.status}">${s.status.toUpperCase()}</span>
      `;
      sceneList.appendChild(item);
    });
  }

  function updateProgress() {
    const total = scenes.length;
    const done = scenes.filter((s) => s.status === "done").length;
    queueProgressBadge.textContent = `${done} / ${total} Done`;
    const percent = total > 0 ? (done / total) * 100 : 0;
    queueProgressBar.style.width = `${percent}%`;
  }

  function updateSceneStatus(sceneNum, status) {
    const scene = scenes.find((s) => s.scene_number === sceneNum);
    if (scene) scene.status = status;

    const row = $(`scene-row-${sceneNum}`);
    if (row) {
      const pill = row.querySelector(".scene-status-pill");
      if (pill) {
        pill.className = `scene-status-pill ${status}`;
        pill.textContent = status.toUpperCase();
      }
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    updateProgress();
  }

  // ── Watermark Removal (Bottom-Right Blur) ──
  async function blurWatermark(blob) {
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return blob;

      ctx.drawImage(bitmap, 0, 0);

      // Meta AI watermark sits in the bottom-right corner (~22% width, 7% height)
      const regionW = Math.round(bitmap.width * 0.22);
      const regionH = Math.round(bitmap.height * 0.07);
      const x = bitmap.width - regionW;
      const y = bitmap.height - regionH;

      ctx.filter = "blur(14px)";
      ctx.drawImage(canvas, x, y, regionW, regionH, x, y, regionW, regionH);
      ctx.filter = "none";

      return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    } catch {
      return blob;
    }
  }

  // ── File System Local Saving Helpers ──
  async function saveMediaToDisk(blob, filename, sceneNum, mode) {
    if (!projectHandle) {
      // Fallback to browser download if no local folder handle is attached
      const url = URL.createObjectURL(blob);
      chrome.runtime.sendMessage({ action: "downloadUrl", url, filename });
      return;
    }

    try {
      const rootDirName = mode === "image" ? "images" : "videos";
      const rootDir = await projectHandle.getDirectoryHandle(rootDirName, { create: true });
      const sceneDirName = `scene_${String(sceneNum).padStart(4, "0")}`;
      const sceneDir = await rootDir.getDirectoryHandle(sceneDirName, { create: true });

      const fileHandle = await sceneDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      // If in image mode, also save a copy as the root reference frame for video mode
      if (mode === "image") {
        const refName = `scene_${String(sceneNum).padStart(4, "0")}.jpg`;
        const refHandle = await rootDir.getFileHandle(refName, { create: true });
        const refWritable = await refHandle.createWritable();
        await refWritable.write(blob);
        await refWritable.close();
      }
    } catch (err) {
      log(`File write error: ${err.message}`, "error");
    }
  }

  // ── Load Reference Frame for Video Mode ──
  async function loadReferenceImageBase64(sceneNum) {
    if (!projectHandle) return null;

    try {
      const imagesDir = await projectHandle.getDirectoryHandle("images");
      const refName = `scene_${String(sceneNum).padStart(4, "0")}.jpg`;
      const fileHandle = await imagesDir.getFileHandle(refName);
      const file = await fileHandle.getFile();

      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    } catch {
      return null;
    }
  }

  // ── Batch Generation Engine ──
  startBatchBtn.addEventListener("click", async () => {
    await checkVibesTab();
    if (!activeVibesTabId) {
      alert("Please open https://vibes.ai in a browser tab first!");
      return;
    }

    const ready = await ensureAdapterInjected(activeVibesTabId);
    if (!ready) {
      log("Could not contact vibes-adapter. Please refresh (F5) the vibes.ai tab.", "error");
      alert("Could not connect to vibes.ai page. Please refresh (F5) your vibes.ai tab and try again.");
      return;
    }

    const startFrom = parseInt(startSceneInput.value, 10) || 1;
    const cooldownSec = parseInt(delaySecondsInput.value, 10) || 5;
    const removeWatermark = removeWatermarkCheckbox.checked;

    isRunning = true;
    startBatchBtn.classList.add("hidden");
    stopBatchBtn.classList.remove("hidden");

    log(`Starting batch generation from Scene ${startFrom}...`, "info");

    for (const scene of scenes) {
      if (!isRunning) break;
      if (scene.scene_number < startFrom) continue;
      if (scene.status === "done") continue;

      const sceneNum = scene.scene_number;
      const prompt = currentMode === "video" ? scene.video_prompt : scene.image_prompt;

      if (!prompt) {
        log(`Scene ${sceneNum} has empty prompt, skipping.`, "warn");
        continue;
      }

      updateSceneStatus(sceneNum, "processing");
      log(`[Scene ${sceneNum}] Sending ${currentMode} prompt to vibes.ai...`, "info");

      // Video mode: grab reference image
      let imageBase64 = null;
      let imageName = null;
      if (currentMode === "video") {
        log(`[Scene ${sceneNum}] Loading reference start frame...`, "info");
        imageBase64 = await loadReferenceImageBase64(sceneNum);
        if (!imageBase64) {
          log(`[Scene ${sceneNum}] Error: No reference image found in /images/. Generate images first!`, "error");
          updateSceneStatus(sceneNum, "error");
          continue;
        }
        imageName = `scene_${String(sceneNum).padStart(4, "0")}.jpg`;
      }

      try {
        let response = null;
        try {
          response = await chrome.tabs.sendMessage(activeVibesTabId, {
            action: "vibes_generate_scene",
            mode: currentMode,
            prompt,
            imageBase64,
            imageName,
            sceneNumber: sceneNum,
          });
        } catch (commErr) {
          // If receiving end does not exist, inject adapter and retry once
          log(`[Scene ${sceneNum}] Re-injecting adapter into vibes tab...`, "warn");
          const ok = await ensureAdapterInjected(activeVibesTabId);
          if (ok) {
            response = await chrome.tabs.sendMessage(activeVibesTabId, {
              action: "vibes_generate_scene",
              mode: currentMode,
              prompt,
              imageBase64,
              imageName,
              sceneNumber: sceneNum,
            });
          } else {
            throw commErr;
          }
        }

        if (response?.success && response.url) {
          log(`[Scene ${sceneNum}] Media ready! Downloading asset...`, "success");

          // Fetch media blob
          const res = await fetch(response.url);
          let blob = await res.blob();

          if (currentMode === "image" && removeWatermark) {
            log(`[Scene ${sceneNum}] Blurring Meta AI watermark...`, "info");
            blob = await blurWatermark(blob);
          }

          const filename =
            currentMode === "image"
              ? `scene_${String(sceneNum).padStart(4, "0")}_00.jpg`
              : `scene_${String(sceneNum).padStart(4, "0")}.mp4`;

          await saveMediaToDisk(blob, filename, sceneNum, currentMode);
          updateSceneStatus(sceneNum, "done");
          log(`[Scene ${sceneNum}] Successfully saved to disk.`, "success");
        } else {
          const errMsg = response?.error || "Unknown error";
          log(`[Scene ${sceneNum}] Failed: ${errMsg}`, "error");
          updateSceneStatus(sceneNum, "error");
        }
      } catch (err) {
        log(`[Scene ${sceneNum}] Content script communication error: ${err.message}`, "error");
        updateSceneStatus(sceneNum, "error");
      }

      // Cooldown delay
      if (isRunning) {
        log(`Waiting ${cooldownSec}s cooldown before next scene...`, "info");
        await new Promise((res) => setTimeout(res, cooldownSec * 1000));
      }
    }

    isRunning = false;
    startBatchBtn.classList.remove("hidden");
    stopBatchBtn.classList.add("hidden");
    log("Batch run ended.", "info");
  });

  stopBatchBtn.addEventListener("click", () => {
    isRunning = false;
    if (activeVibesTabId) {
      chrome.tabs.sendMessage(activeVibesTabId, { action: "vibes_stop" }).catch(() => {});
    }
    stopBatchBtn.classList.add("hidden");
    startBatchBtn.classList.remove("hidden");
    log("Batch generation stopped by user.", "warn");
  });
})();
