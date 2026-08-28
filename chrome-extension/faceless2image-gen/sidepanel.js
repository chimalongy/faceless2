/* Faceless Studio — Sidepanel UI Logic
 * Handles login, cascading dropdowns (channel → pillar → topic),
 * scene preview, thumbnail generation, and queue control.
 */
"use strict";

// ── DOM refs ──
const $ = (id) => document.getElementById(id);

const loginScreen = $("loginScreen");
const mainScreen = $("mainScreen");
const thumbnailScreen = $("thumbnailScreen");

const emailInput = $("email");
const passwordInput = $("password");
const rememberBox = $("remember");
const loginBtn = $("loginBtn");
const loginError = $("loginError");
const settingsToggle = $("settingsToggle");
const serverSettings = $("serverSettings");
const baseUrlInput = $("baseUrlInput");
const logoutBtn = $("logoutBtn");
const logoutBtnThumb = $("logoutBtnThumb");

const channelSelect = $("channelSelect");
const pillarSelect = $("pillarSelect");
const topicSelect = $("topicSelect");
const startSceneInput = $("startSceneInput");
const batchCountInput = $("batchCountInput");

const thumbnailNavWrapper = $("thumbnailNavWrapper");
const openThumbnailBtn = $("openThumbnailBtn");
const backToScenesBtn = $("backToScenesBtn");
const thumbTopicTitle = $("thumbTopicTitle");
const thumbnailPromptInput = $("thumbnailPromptInput");
const thumbnailThemeInput = $("thumbnailThemeInput");
const generateThumbnailBtn = $("generateThumbnailBtn");
const thumbProgressCard = $("thumbProgressCard");
const thumbStatusText = $("thumbStatusText");
const thumbLogArea = $("thumbLog");

const scenesCard = $("scenesCard");
const sceneCount = $("sceneCount");
const scenesList = $("scenesList");
const selectedCountBadge = $("selectedCountBadge");
const genSelectedBtn = $("genSelectedBtn");
const genSelectedCount = $("genSelectedCount");

const startBtn = $("startBtn");
const pauseBtn = $("pauseBtn");
const stopBtn = $("stopBtn");

const progressCard = $("progressCard");
const progressBar = $("progressBar");
const progressText = $("progressText");
const statusText = $("statusText");
const logArea = $("log");

// ── State ──
let currentChannels = [];
let currentPillars = [];
let currentTopics = [];
let currentScenes = [];
let selectedSceneNumbers = new Set();
let selectedChannelSlug = "";
let selectedChannelTheme = "";
let selectedChannelThumbnailTheme = "";
let selectedTopicSlug = "";
let selectedTopicTitle = "";
let selectedTopicThumbnailPrompt = "";

// ── Helpers ──
function bg(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      resolve(resp || { ok: false, error: "no response" });
    });
  });
}

function showError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}

function hideError() {
  loginError.classList.add("hidden");
}

function addLog(text, kind = "info") {
  const line = document.createElement("div");
  line.className = "log-" + kind;
  const time = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  line.textContent = `[${time}] ${text}`;
  
  if (logArea) {
    logArea.appendChild(line.cloneNode(true));
    logArea.scrollTop = logArea.scrollHeight;
  }
  if (thumbLogArea) {
    thumbLogArea.appendChild(line.cloneNode(true));
    thumbLogArea.scrollTop = thumbLogArea.scrollHeight;
  }
}

function setLoading(selectEl, loading) {
  if (loading) {
    selectEl.disabled = true;
    selectEl.innerHTML = '<option value="">Loading…</option>';
  }
}

// ── Screen transitions ──
function showLogin() {
  loginScreen.classList.remove("hidden");
  mainScreen.classList.add("hidden");
  thumbnailScreen?.classList.add("hidden");
}

function showMain() {
  loginScreen.classList.add("hidden");
  thumbnailScreen?.classList.add("hidden");
  mainScreen.classList.remove("hidden");
  loadChannels();
}

function showThumbnailScreen() {
  mainScreen.classList.add("hidden");
  thumbnailScreen.classList.remove("hidden");
  
  thumbTopicTitle.textContent = selectedTopicTitle || "Selected Topic";
  
  const promptVal = (selectedTopicThumbnailPrompt || "").trim();
  thumbnailPromptInput.value = promptVal || `High-converting YouTube thumbnail for "${selectedTopicTitle}". Intense focal point, dramatic lighting, high contrast, clean separation between foreground subject and background environment.`;

  const themeVal = (selectedChannelThumbnailTheme || selectedChannelTheme || "").trim();
  thumbnailThemeInput.value = themeVal || "cinematic, high quality, consistent style";
}

// ── Init ──
async function init() {
  // Load saved base URL
  const settings = await bg({ type: "getSettings" });
  if (settings.ok) {
    baseUrlInput.value = settings.baseUrl || "http://localhost:3000";
  }

  // Load saved start scene & batch count
  try {
    const { startScene, batchCount } = await chrome.storage.local.get([
      "startScene",
      "batchCount",
    ]);
    if (startScene && startSceneInput) {
      startSceneInput.value = startScene;
    }
    if (batchCount && batchCountInput) {
      batchCountInput.value = batchCount;
    }
  } catch (_) {}

  // Check if already logged in
  const auth = await bg({ type: "checkAuth" });
  if (auth.ok) {
    showMain();
  } else {
    showLogin();
  }

  // Check if a run is already active
  const state = await bg({ type: "state" });
  if (state.ok && state.running) {
    setRunningUI(true, state.paused);
    progressCard.classList.remove("hidden");
    updateProgress(state.i, state.total);
  }
}

startSceneInput?.addEventListener("change", () => {
  const val = Math.max(1, parseInt(startSceneInput.value) || 1);
  startSceneInput.value = val;
  chrome.storage.local.set({ startScene: val }).catch(() => {});
});

batchCountInput?.addEventListener("change", () => {
  const val = Math.max(1, parseInt(batchCountInput.value) || 3);
  batchCountInput.value = val;
  chrome.storage.local.set({ batchCount: val }).catch(() => {});
});

// ── LOGIN ──
settingsToggle.addEventListener("click", () => {
  serverSettings.classList.toggle("hidden");
});

loginBtn.addEventListener("click", async () => {
  hideError();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const baseUrl = baseUrlInput.value.trim() || "http://localhost:3000";

  if (!email || !password) {
    showError("Enter both email and password.");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";

  // Save base URL
  await bg({ type: "saveSettings", baseUrl });

  const res = await bg({
    type: "login",
    email,
    password,
    baseUrl,
    remember: rememberBox.checked,
  });

  loginBtn.disabled = false;
  loginBtn.textContent = "Sign In";

  if (res.ok) {
    showMain();
  } else {
    showError(res.error || "Login failed.");
  }
});

logoutBtn.addEventListener("click", async () => {
  await bg({ type: "logout" });
  channelSelect.innerHTML = '<option value="">— Select channel —</option>';
  channelSelect.disabled = true;
  pillarSelect.innerHTML = '<option value="">— Select pillar —</option>';
  pillarSelect.disabled = true;
  topicSelect.innerHTML = '<option value="">— Select topic —</option>';
  topicSelect.disabled = true;
  scenesCard.classList.add("hidden");
  thumbnailNavWrapper?.classList.add("hidden");
  progressCard.classList.add("hidden");
  currentScenes = [];
  selectedSceneNumbers.clear();
  updateSelectedScenesUI();
  showLogin();
});

logoutBtnThumb?.addEventListener("click", async () => {
  await bg({ type: "logout" });
  showLogin();
});

// ── CASCADING DROPDOWNS ──

async function loadChannels() {
  setLoading(channelSelect, true);
  const res = await bg({ type: "apiGet", path: "/api/channels" });
  if (res.ok && res.data?.channels) {
    currentChannels = res.data.channels;
    channelSelect.innerHTML = '<option value="">— Select channel —</option>';
    for (const ch of currentChannels) {
      const opt = document.createElement("option");
      opt.value = ch.slug;
      opt.textContent = ch.name;
      channelSelect.appendChild(opt);
    }
    channelSelect.disabled = false;
  } else {
    channelSelect.innerHTML = '<option value="">Failed to load</option>';
    addLog("Failed to load channels: " + (res.error || "unknown"), "error");
  }
}

channelSelect.addEventListener("change", async () => {
  const slug = channelSelect.value;
  selectedChannelSlug = slug;
  const selectedChannel = currentChannels.find((c) => c.slug === slug);
  selectedChannelTheme =
    selectedChannel?.imageTheme || selectedChannel?.image_theme || "";
  selectedChannelThumbnailTheme =
    selectedChannel?.thumbnailTheme || selectedChannel?.thumbnail_theme || "";

  // Reset downstream
  topicSelect.innerHTML = '<option value="">— Select topic —</option>';
  topicSelect.disabled = true;
  scenesCard.classList.add("hidden");
  thumbnailNavWrapper?.classList.add("hidden");
  currentScenes = [];
  selectedSceneNumbers.clear();
  updateSelectedScenesUI();
  startBtn.disabled = true;

  if (!slug) {
    pillarSelect.innerHTML = '<option value="">— Select pillar —</option>';
    pillarSelect.disabled = true;
    return;
  }

  setLoading(pillarSelect, true);
  const res = await bg({
    type: "apiGet",
    path: `/api/channels/${slug}/pillars`,
  });
  if (res.ok && res.data?.pillars) {
    currentPillars = res.data.pillars;
    pillarSelect.innerHTML = '<option value="">— All pillars —</option>';
    for (const p of currentPillars) {
      const opt = document.createElement("option");
      opt.value = p.slug;
      opt.textContent = p.name;
      pillarSelect.appendChild(opt);
    }
    pillarSelect.disabled = false;
  } else {
    pillarSelect.innerHTML = '<option value="">Failed to load</option>';
    addLog("Failed to load pillars: " + (res.error || "unknown"), "error");
  }
});

pillarSelect.addEventListener("change", async () => {
  const pillarSlug = pillarSelect.value;
  const channelSlug = selectedChannelSlug;

  // Reset downstream
  scenesCard.classList.add("hidden");
  thumbnailNavWrapper?.classList.add("hidden");
  currentScenes = [];
  selectedSceneNumbers.clear();
  updateSelectedScenesUI();
  startBtn.disabled = true;

  if (!channelSlug) return;

  setLoading(topicSelect, true);
  let path = `/api/channels/${channelSlug}/topics`;
  if (pillarSlug) path += `?pillar=${pillarSlug}`;

  const res = await bg({ type: "apiGet", path });
  if (res.ok && res.data?.topics) {
    currentTopics = res.data.topics;
    topicSelect.innerHTML = '<option value="">— Select topic —</option>';
    for (const t of currentTopics) {
      const opt = document.createElement("option");
      opt.value = t.slug;
      opt.textContent = t.title;
      topicSelect.appendChild(opt);
    }
    topicSelect.disabled = false;
  } else {
    topicSelect.innerHTML = '<option value="">Failed to load</option>';
    addLog("Failed to load topics: " + (res.error || "unknown"), "error");
  }
});

topicSelect.addEventListener("change", async () => {
  const topicSlug = topicSelect.value;
  const channelSlug = selectedChannelSlug;
  selectedTopicSlug = topicSlug;
  selectedTopicTitle =
    topicSelect.options[topicSelect.selectedIndex]?.textContent || "";

  scenesCard.classList.add("hidden");
  thumbnailNavWrapper?.classList.add("hidden");
  currentScenes = [];
  startBtn.disabled = true;

  if (!topicSlug || !channelSlug) return;

  // Fetch topic detail to get scenes_json and thumbnail prompt
  const res = await bg({
    type: "apiGet",
    path: `/api/channels/${channelSlug}/topics/${topicSlug}`,
  });
  if (res.ok && res.data?.topic) {
    const topic = res.data.topic;
    if (topic.channelImageTheme) {
      selectedChannelTheme = topic.channelImageTheme;
    }
    if (topic.channelThumbnailTheme) {
      selectedChannelThumbnailTheme = topic.channelThumbnailTheme;
    }
    selectedTopicThumbnailPrompt = topic.thumbnailPrompt || topic.thumbnail_prompt || "";

    thumbnailNavWrapper?.classList.remove("hidden");

    let scenes = [];
    if (topic.scenesJson) {
      try {
        scenes =
          typeof topic.scenesJson === "string"
            ? JSON.parse(topic.scenesJson)
            : topic.scenesJson;
      } catch (e) {
        addLog("Failed to parse scenes_json", "error");
      }
    }

    if (scenes.length > 0) {
      currentScenes = scenes;

      // Send context instruction to Flow agent immediately with batch_count and channel theme
      const batchCount = Math.max(1, parseInt(batchCountInput?.value) || 3);
      const instruction = buildInstruction(
        topic.title,
        batchCount,
        selectedChannelTheme,
      );
      addLog(
        `📋 Sending context instruction to Flow agent (batch size: ${batchCount})…`,
        "start",
      );
      const instrRes = await bg({ type: "sendInstruction", instruction });
      if (instrRes.ok) {
        addLog(`✓ Context instruction sent: "${topic.title}"`, "success");
      } else {
        addLog(
          "⚠ Could not send instruction: " +
            (instrRes.error || "Flow tab not found") +
            " — you can still generate manually",
          "warn",
        );
      }

      renderScenes(scenes);
      scenesCard.classList.remove("hidden");
      startBtn.disabled = false;
    } else {
      addLog("No scenes found in this topic", "warn");
    }
  } else {
    addLog("Failed to load topic details: " + (res.error || "unknown"), "error");
  }
});

// ── THUMBNAIL NAVIGATION & CONTROLS ──
openThumbnailBtn?.addEventListener("click", () => {
  showThumbnailScreen();
});

backToScenesBtn?.addEventListener("click", () => {
  thumbnailScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
});

function buildThumbnailInstruction(topicTitle, thumbPrompt, thumbTheme) {
  const template =
    typeof setup !== "undefined" && setup.thumbnail_instruction
      ? setup.thumbnail_instruction
      : `Hi, I need you to assist me in generating a high-converting YouTube thumbnail for content titled "{topicTitle}".\n\nthumbnail_prompt: "{thumbnail_prompt}"\n\nEnsure only one Image is Generated. Name the image thumbnail.png.\n\nwhen generating images ensure that image follow this theme\n"{channel_thumbnail_generation_theme}"`;

  const themeText = (thumbTheme || selectedChannelThumbnailTheme || selectedChannelTheme || "cinematic, high quality, consistent style").trim();
  const promptText = (thumbPrompt || selectedTopicThumbnailPrompt || `High-converting YouTube thumbnail for "${topicTitle}"`).trim();

  return template
    .replace(/\{topicTitle\}/g, topicTitle)
    .replace(/\{thumbnail_prompt\}/g, promptText)
    .replace(/\{thumbnailPrompt\}/g, promptText)
    .replace(/\{channel_thumbnail_generation_theme\}/g, themeText)
    .replace(/\{channelThumbnailTheme\}/g, themeText);
}

generateThumbnailBtn?.addEventListener("click", async () => {
  const prompt = thumbnailPromptInput.value.trim();
  const theme = thumbnailThemeInput.value.trim();

  if (!prompt) {
    addLog("Please enter a thumbnail prompt", "warn");
    return;
  }

  const instruction = buildThumbnailInstruction(selectedTopicTitle, prompt, theme);

  const queue = [
    {
      prompt: instruction,
      sceneNumbers: ["thumbnail"],
      sceneNumber: "thumbnail",
      downloadName: "thumbnail",
      sceneCount: 1,
      label: "Thumbnail",
      batchIndex: 1,
      totalBatches: 1,
      isThumbnail: true,
    },
  ];

  addLog(`▶ Generating thumbnail for "${selectedTopicTitle}"…`, "start");
  thumbProgressCard?.classList.remove("hidden");
  thumbStatusText.textContent = "Sending thumbnail instruction to Flow agent…";
  generateThumbnailBtn.disabled = true;

  const res = await bg({
    type: "start",
    queue,
    totalScenes: 1,
    channelSlug: selectedChannelSlug,
    topicSlug: selectedTopicSlug,
  });

  if (res.ok) {
    thumbStatusText.textContent = "Generating thumbnail…";
  } else {
    addLog("Thumbnail generation failed to start: " + res.error, "error");
    generateThumbnailBtn.disabled = false;
    thumbStatusText.textContent = "Failed";
  }
});

// ── SCENES RENDERING ──

function renderScenes(scenes) {
  scenesList.innerHTML = "";
  sceneCount.textContent = scenes.length;
  selectedSceneNumbers.clear();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const num = scene.scene_number || i + 1;
    const prompt = (scene.image_prompt || "").trim();

    const div = document.createElement("div");
    div.className = "scene-item";
    div.dataset.sceneNum = num;
    div.innerHTML = `
      <input type="checkbox" class="scene-checkbox" data-scene-num="${num}" title="Select for generation" />
      <span class="scene-num">${num}</span>
      <span class="scene-prompt">${escapeHtml(prompt || "(no prompt)")}</span>
      <button type="button" class="btn-scene-gen" title="Generate this scene image">▶</button>
    `;

    const cb = div.querySelector(".scene-checkbox");
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
      const maxBatch = Math.max(1, parseInt(batchCountInput?.value) || 3);
      if (cb.checked) {
        if (selectedSceneNumbers.size >= maxBatch) {
          cb.checked = false;
          addLog(
            `Cannot select more than ${maxBatch} scene(s) (batch count limit: ${maxBatch})`,
            "warn",
          );
          return;
        }
        selectedSceneNumbers.add(scene.scene_number);
      } else {
        selectedSceneNumbers.delete(scene.scene_number);
      }
      updateSelectedScenesUI();
    });

    // Per-scene generate handler
    div.querySelector(".btn-scene-gen").addEventListener("click", (e) => {
      e.stopPropagation();
      generateSingleScene(scene);
    });
    scenesList.appendChild(div);
  }
  updateSelectedScenesUI();
}

function updateSelectedScenesUI() {
  const count = selectedSceneNumbers.size;
  if (count > 0) {
    selectedCountBadge.textContent = `${count} selected`;
    selectedCountBadge.classList.remove("hidden");
    genSelectedCount.textContent = count;
    genSelectedBtn.classList.remove("hidden");
  } else {
    selectedCountBadge.classList.add("hidden");
    genSelectedBtn.classList.add("hidden");
  }
}

function buildBatchPrompt(scenesChunk, channelTheme = "") {
  const scenesText = scenesChunk
    .map((s) => {
      const audioLine = s.audio_text
        ? `audio_text: "${s.audio_text.trim()}"\n`
        : "";
      return `scene_${s.scene_number}\n${audioLine}image_prompt: "${(s.image_prompt || "").trim()}"`;
    })
    .join("\n\n");

  const themeText = (
    channelTheme ||
    selectedChannelTheme ||
    "cinematic, high quality, consistent style"
  ).trim();
  const themeTemplate =
    typeof setup !== "undefined" && setup.theme_instruction
      ? setup.theme_instruction
      : `when generating images ensure that image follow this theme\n"{channel_image_generation_theme}"`;

  const formattedTheme = themeTemplate
    .replace(/\{channel_image_generation_theme\}/g, themeText)
    .replace(/\{channelImageTheme\}/g, themeText);

  return `${scenesText}\n\n${formattedTheme}`;
}

function buildMissingScenesPrompt(scenesList, channelTheme = "") {
  const headerTemplate =
    typeof setup !== "undefined" && setup.missing_scenes_header
      ? setup.missing_scenes_header
      : "Lets Focus on Generating for these scenes";

  const scenesText = scenesList
    .map((s) => {
      const audioLine = s.audio_text
        ? `audio_text: "${s.audio_text.trim()}"\n`
        : "";
      return `scene_${s.scene_number}\n${audioLine}image_prompt: "${(s.image_prompt || "").trim()}"`;
    })
    .join("\n\n");

  const themeText = (
    channelTheme ||
    selectedChannelTheme ||
    "cinematic, high quality, consistent style"
  ).trim();
  const themeTemplate =
    typeof setup !== "undefined" && setup.theme_instruction
      ? setup.theme_instruction
      : `when generating images ensure that image follow this theme\n"{channel_image_generation_theme}"`;

  const formattedTheme = themeTemplate
    .replace(/\{channel_image_generation_theme\}/g, themeText)
    .replace(/\{channelImageTheme\}/g, themeText);

  return `${headerTemplate}\n\n${scenesText}\n\n${formattedTheme}`;
}

async function generateSingleScene(scene) {
  if (!scene.image_prompt) {
    addLog(`Scene ${scene.scene_number} has no image prompt`, "error");
    return;
  }

  const queue = [
    {
      prompt: buildBatchPrompt([scene], selectedChannelTheme),
      sceneNumbers: [scene.scene_number],
      sceneNumber: scene.scene_number,
      sceneCount: 1,
      label: `Scene ${scene.scene_number}`,
      batchIndex: 1,
      totalBatches: 1,
    },
  ];

  addLog(`▶ Generating scene ${scene.scene_number}…`, "start");
  progressCard.classList.remove("hidden");
  updateProgress(0, 1);

  document
    .querySelectorAll(".btn-scene-gen")
    .forEach((b) => (b.disabled = true));

  const res = await bg({
    type: "start",
    queue,
    totalScenes: 1,
    channelSlug: selectedChannelSlug,
    topicSlug: selectedTopicSlug,
  });

  if (res.ok) {
    setRunningUI(true, false);
    statusText.textContent = `Generating scene ${scene.scene_number}…`;
  } else {
    addLog("Start failed: " + res.error, "error");
    document
      .querySelectorAll(".btn-scene-gen")
      .forEach((b) => (b.disabled = false));
  }
}

// ── GENERATE SELECTED SCENES ──
genSelectedBtn.addEventListener("click", async () => {
  if (selectedSceneNumbers.size === 0) return;

  const selectedScenes = currentScenes
    .filter((s) => selectedSceneNumbers.has(s.scene_number) && s.image_prompt)
    .sort((a, b) => a.scene_number - b.scene_number);

  if (selectedScenes.length === 0) {
    addLog("No valid prompts in selected scenes", "error");
    return;
  }

  const sceneNumbers = selectedScenes.map((s) => s.scene_number);
  const label =
    sceneNumbers.length === 1
      ? `Scene ${sceneNumbers[0]}`
      : `Scenes ${sceneNumbers.join(", ")}`;

  const queue = [
    {
      prompt: buildMissingScenesPrompt(selectedScenes, selectedChannelTheme),
      sceneNumbers,
      sceneNumber: sceneNumbers[0],
      sceneCount: selectedScenes.length,
      label,
      batchIndex: 1,
      totalBatches: 1,
    },
  ];

  addLog(
    `▶ Generating for ${selectedScenes.length} selected scene(s): ${label}…`,
    "start",
  );
  progressCard.classList.remove("hidden");
  updateProgress(0, selectedScenes.length);

  setRunningUI(true, false);

  const res = await bg({
    type: "start",
    queue,
    totalScenes: selectedScenes.length,
    channelSlug: selectedChannelSlug,
    topicSlug: selectedTopicSlug,
  });

  if (res.ok) {
    statusText.textContent = `Generating ${label}…`;
  } else {
    addLog("Start failed: " + res.error, "error");
    setRunningUI(false, false);
  }
});

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ── INSTRUCTION PROMPT ──
function buildInstruction(topicTitle, batchCount = 3, channelTheme = "") {
  const template =
    typeof setup !== "undefined" && setup.start_up_instruction
      ? setup.start_up_instruction
      : `Hi, I need you to assist me in generating images for content titled "{topicTitle}".\n\nI will provide the prompts for each scene in batches of "{batch_count}", and you would generate the image.\neach scene prompt would be mapped with a scene number\neg \nscene_1\naudio_text: "the words that would be spoken"\nimage_prompt: "<image prompt text for scene 1>"\n\nscene_2\naudio_text: "the words that would be spoken"\nimage_prompt: "<image prompt text for scene 2>"\n\nscene_3\naudio_text: "the words that would be spoken"\nimage_prompt: "<image prompt text for scene 3>"\n\n\nEnsure only one Image is Generated Per Prompt or Per Scene. and name each image by thier scene number\n\nfor exampe 1.png, 2.png, 3.png continuously\n\nwhen generating images ensure that image follow this theme\n"{channel_image_generation_theme}"`;

  const themeText = (channelTheme || selectedChannelTheme || "").trim();

  return template
    .replace(/\{topicTitle\}/g, topicTitle)
    .replace(/\{batch_count\}/g, String(batchCount))
    .replace(/\{batchCount\}/g, String(batchCount))
    .replace(
      /\{channel_image_generation_theme\}/g,
      themeText || "cinematic, high quality, consistent style",
    )
    .replace(
      /\{channelImageTheme\}/g,
      themeText || "cinematic, high quality, consistent style",
    );
}

// ── GENERATION CONTROLS ──

startBtn.addEventListener("click", async () => {
  if (currentScenes.length === 0) return;

  const startSceneNum = Math.max(1, parseInt(startSceneInput?.value) || 1);
  const batchCount = Math.max(1, parseInt(batchCountInput?.value) || 3);

  const validScenes = currentScenes
    .filter((s) => s.image_prompt && s.scene_number >= startSceneNum)
    .sort((a, b) => a.scene_number - b.scene_number);

  if (validScenes.length === 0) {
    addLog(
      `No image prompts in scenes (from Scene ${startSceneNum} onward)`,
      "error",
    );
    return;
  }

  const queue = [];
  const totalBatches = Math.ceil(validScenes.length / batchCount);

  for (let i = 0; i < validScenes.length; i += batchCount) {
    const chunk = validScenes.slice(i, i + batchCount);
    const sceneNumbers = chunk.map((s) => s.scene_number);
    const label =
      chunk.length === 1
        ? `Scene ${sceneNumbers[0]}`
        : `Scenes ${sceneNumbers[0]}–${sceneNumbers[sceneNumbers.length - 1]}`;

    queue.push({
      prompt: buildBatchPrompt(chunk, selectedChannelTheme),
      sceneNumbers,
      sceneNumber: sceneNumbers[0],
      sceneCount: chunk.length,
      label,
      batchIndex: Math.floor(i / batchCount) + 1,
      totalBatches,
    });
  }

  addLog(
    `Starting generation: ${validScenes.length} scenes (starting from Scene ${startSceneNum}) in ${queue.length} batch${queue.length === 1 ? "" : "es"} (batch size: ${batchCount})`,
    "start",
  );
  progressCard.classList.remove("hidden");
  updateProgress(0, validScenes.length);

  const res = await bg({
    type: "start",
    queue,
    totalScenes: validScenes.length,
    channelSlug: selectedChannelSlug,
    topicSlug: selectedTopicSlug,
  });

  if (res.ok) {
    setRunningUI(true, false);
    statusText.textContent = "Starting…";
  } else {
    addLog("Start failed: " + res.error, "error");
  }
});

pauseBtn.addEventListener("click", async () => {
  const state = await bg({ type: "state" });
  if (state.ok && state.paused) {
    await bg({ type: "resume" });
    pauseBtn.textContent = "Pause";
    statusText.textContent = "Resumed";
    addLog("Resumed", "info");
  } else {
    await bg({ type: "pause" });
    pauseBtn.textContent = "Resume";
    statusText.textContent = "Paused";
    addLog("Paused", "warn");
  }
});

stopBtn.addEventListener("click", async () => {
  await bg({ type: "stop" });
  setRunningUI(false, false);
  statusText.textContent = "Stopped";
  if (generateThumbnailBtn) generateThumbnailBtn.disabled = false;
  addLog("Stopped by user", "warn");
});

function setRunningUI(running, paused) {
  startBtn.disabled = running;
  channelSelect.disabled = running;
  pillarSelect.disabled = running;
  topicSelect.disabled = running;
  if (startSceneInput) startSceneInput.disabled = running;
  if (batchCountInput) batchCountInput.disabled = running;
  if (genSelectedBtn) genSelectedBtn.disabled = running;
  if (openThumbnailBtn) openThumbnailBtn.disabled = running;
  if (generateThumbnailBtn) generateThumbnailBtn.disabled = running;
  pauseBtn.disabled = !running;
  stopBtn.disabled = !running;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  // Toggle per-scene generate buttons and checkboxes
  document
    .querySelectorAll(".btn-scene-gen")
    .forEach((b) => (b.disabled = running));
  document
    .querySelectorAll(".scene-checkbox")
    .forEach((b) => (b.disabled = running));
}

function updateProgress(current, total) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  progressBar.style.width = pct + "%";
  progressText.textContent = `${current} / ${total}`;
}

// ── PROGRESS MESSAGES FROM BACKGROUND ──
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "progress") return;

  switch (msg.kind) {
    case "start":
      if (msg.job?.isInstruction) {
        statusText.textContent = "Sending instruction to agent…";
        addLog("📋 Sending instruction to agent…", "start");
      } else if (msg.job?.isThumbnail) {
        if (thumbStatusText) thumbStatusText.textContent = "Generating thumbnail image in Flow…";
        addLog("▶ Thumbnail: sending prompt to agent…", "start");
      } else {
        const label =
          msg.job?.label ||
          (msg.job?.sceneNumbers
            ? `Scenes ${msg.job.sceneNumbers.join(", ")}`
            : `Scene ${msg.job?.sceneNumber || msg.index + 1}`);
        const batchInfo =
          msg.job?.totalBatches > 1
            ? ` [Batch ${msg.job.batchIndex}/${msg.job.totalBatches}]`
            : "";
        statusText.textContent = `Generating ${label}${batchInfo}…`;
        addLog(`▶ ${label}${batchInfo}: sending prompt…`, "start");
      }
      break;

    case "done":
      if (msg.job?.isThumbnail) {
        if (thumbStatusText) thumbStatusText.textContent = "✓ Thumbnail complete!";
        addLog("✓ Thumbnail generation complete!", "success");
        if (generateThumbnailBtn) generateThumbnailBtn.disabled = false;
      } else if (!msg.job?.isInstruction) {
        const completed =
          msg.completedScenes != null ? msg.completedScenes : msg.index + 1;
        const total =
          msg.totalScenes != null
            ? msg.totalScenes
            : msg.total || currentScenes.length;
        const label =
          msg.job?.label ||
          (msg.job?.sceneNumbers
            ? `Scenes ${msg.job.sceneNumbers.join(", ")}`
            : `Scene ${msg.job?.sceneNumber || msg.index + 1}`);
        updateProgress(completed, total);
        addLog(`✓ ${label} complete (${completed}/${total} scenes)`, "success");
      }
      break;

    case "info":
      addLog(msg.message, "info");
      break;

    case "warn":
      addLog(msg.message, "warn");
      break;

    case "error":
      addLog(msg.message, "error");
      if (generateThumbnailBtn) generateThumbnailBtn.disabled = false;
      break;

    case "finished":
      setRunningUI(false, false);
      if (generateThumbnailBtn) generateThumbnailBtn.disabled = false;
      const finalTotal = msg.total || currentScenes.length;
      updateProgress(finalTotal, finalTotal);
      statusText.textContent = "✓ All complete!";
      addLog(`✓ Finished! All tasks complete.`, "success");
      document
        .querySelectorAll(".btn-scene-gen")
        .forEach((b) => (b.disabled = false));
      break;

    case "stopped":
      setRunningUI(false, false);
      statusText.textContent = "Stopped";
      if (thumbStatusText) thumbStatusText.textContent = "Stopped";
      if (generateThumbnailBtn) generateThumbnailBtn.disabled = false;
      break;
  }
});

// ── Boot ──
init();
