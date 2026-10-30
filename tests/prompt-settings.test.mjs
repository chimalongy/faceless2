import test from "node:test";
import assert from "node:assert/strict";

import {
  getScriptGenerationSystemPrompt,
  SCRIPT_GENERATION_SYSTEM_PROMPT,
} from "../src/lib/LLMPrompts/ScriptGenerationPrompt.js";

import {
  getShortScriptGenerationSystemPrompt,
  SHORT_SCRIPT_GENERATION_SYSTEM_PROMPT,
} from "../src/lib/LLMPrompts/ShortScriptGenerationPrompt.js";

import {
  getSceneGenerationPrompt,
  SCENE_GENERATION_SYSTEM_PROMPT,
} from "../src/lib/LLMPrompts/SceneGenerationPrompt.js";

import {
  getShortSceneGenerationPrompt,
  SHORT_SCENE_GENERATION_SYSTEM_PROMPT,
} from "../src/lib/LLMPrompts/ShortSceneGenerationPrompt.js";

import {
  getThumbnailPromptGeneration,
  THUMBNAIL_PROMPT_SYSTEM_PROMPT,
} from "../src/lib/LLMPrompts/ThumbnailPromptGeneration.js";

test("getScriptGenerationSystemPrompt uses default prompt when promptTemplate is omitted", () => {
  const result = getScriptGenerationSystemPrompt({
    channelName: "Stoic Realm",
    channelNiche: "Philosophy",
    channelDescription: "Deep wisdom for modern life",
    channelMission: "Help people achieve inner tranquility",
    contentPillarName: "Marcus Aurelius Wisdom",
    contentPillarCategoryTag: "Stoicism",
    contentPillarTone: "Somber, reflective, philosophical",
    contentPillarLength: "8-12 minutes",
    contentPillarWordsCount: "1500 words",
    contentPillarDescription: "Analyze the Meditations",
    topic: "Overcoming Fear of Failure",
  });

  assert.ok(result.includes("Stoic Realm"));
  assert.ok(result.includes("Overcoming Fear of Failure"));
  assert.ok(result.includes("Marcus Aurelius Wisdom"));
  assert.ok(result.includes("You are an elite YouTube scriptwriter"));
});

test("getScriptGenerationSystemPrompt replaces placeholders in a custom promptTemplate", () => {
  const customTemplate = `CHANNEL: {channel_name} | TOPIC: {topic} | TONE: {content_pillar_tone} | TARGET: {content_pillar_words_count}`;

  const result = getScriptGenerationSystemPrompt({
    channelName: "Stoic Realm",
    channelNiche: "Philosophy",
    channelDescription: "Deep wisdom",
    channelMission: "Tranquility",
    contentPillarName: "Ancient Wisdom",
    contentPillarCategoryTag: "Stoicism",
    contentPillarTone: "Deep and Calm",
    contentPillarLength: "10 mins",
    contentPillarWordsCount: "1600 words",
    contentPillarDescription: "Meditations",
    topic: "The Art of Silence",
    promptTemplate: customTemplate,
  });

  assert.equal(
    result,
    "CHANNEL: Stoic Realm | TOPIC: The Art of Silence | TONE: Deep and Calm | TARGET: 1600 words"
  );
});

test("getShortScriptGenerationSystemPrompt uses custom promptTemplate when provided", () => {
  const customTemplate = `CUSTOM SHORT SCRIPT for {channel_name}: Topic is {topic}. Tone: {content_pillar_tone}.`;

  const result = getShortScriptGenerationSystemPrompt({
    channelName: "Stoic Shorts",
    channelNiche: "Mindset",
    channelDescription: "Quick mental models",
    channelMission: "Daily clarity",
    contentPillarName: "Bite Sized Stoicism",
    contentPillarCategoryTag: "Micro-learning",
    contentPillarTone: "Urgent & Direct",
    topic: "Stop Caring What They Think",
    promptTemplate: customTemplate,
  });

  assert.equal(
    result,
    "CUSTOM SHORT SCRIPT for Stoic Shorts: Topic is Stop Caring What They Think. Tone: Urgent & Direct."
  );
});

test("getSceneGenerationPrompt uses custom promptTemplate when provided", () => {
  const customTemplate = `SCENE DIRECTIVE for {CHANNEL_NAME}: Theme={CHANNEL_IMAGE_THEME}. Script={ACTIVE_SCRIPT}. MainChar={USE_MAIN_CHARACTER}.`;

  const result = getSceneGenerationPrompt({
    channelName: "Stoic Visuals",
    channelNiche: "Cinematic",
    channelDescription: "High art faceless videos",
    channelMission: "Visual stoicism",
    channelImageTheme: "Dark oil painting chiaroscuro",
    contentPillarName: "Deep Reflections",
    contentPillarCategoryTag: "Art",
    contentPillarTone: "Moody",
    contentPillarDescription: "Visual narratives",
    activeScript: "In the shadow of the Colosseum, a philosopher ponders.",
    promptTemplate: customTemplate,
  });

  assert.equal(
    result,
    "SCENE DIRECTIVE for Stoic Visuals: Theme=Dark oil painting chiaroscuro. Script=In the shadow of the Colosseum, a philosopher ponders.. MainChar=No."
  );
});

test("getShortSceneGenerationPrompt uses custom promptTemplate when provided", () => {
  const customTemplate = `VERTICAL 9:16 SCENE: Channel={CHANNEL_NAME}, Theme={CHANNEL_IMAGE_THEME}, Script: {ACTIVE_SCRIPT}`;

  const result = getShortSceneGenerationPrompt({
    channelName: "Daily Wisdom Shorts",
    channelNiche: "Mindset",
    channelDescription: "Quick thoughts",
    channelMission: "Clarity",
    channelImageTheme: "Minimalist dark 3D render",
    contentPillarName: "Rules of Life",
    contentPillarCategoryTag: "Habits",
    contentPillarTone: "Punchy",
    contentPillarDescription: "Rules to live by",
    activeScript: "Rule number one: master your mornings.",
    promptTemplate: customTemplate,
  });

  assert.equal(
    result,
    "VERTICAL 9:16 SCENE: Channel=Daily Wisdom Shorts, Theme=Minimalist dark 3D render, Script: Rule number one: master your mornings."
  );
});

test("getThumbnailPromptGeneration uses custom promptTemplate when provided", () => {
  const customTemplate = `GENERATE THUMBNAIL for {topic}: Style={channel_image_generation_theme}, Layout={channel_thumbnail_generation_theme}`;

  const result = getThumbnailPromptGeneration({
    channelImageGenerationTheme: "Cinematic hyper-realistic portrait photography",
    channelThumbnailGenerationTheme: "Bold centered subject, high contrast yellow text on right",
    topic: "Why 99% Fail at Life",
    promptTemplate: customTemplate,
  });

  assert.equal(
    result,
    "GENERATE THUMBNAIL for Why 99% Fail at Life: Style=Cinematic hyper-realistic portrait photography, Layout=Bold centered subject, high contrast yellow text on right"
  );
});

test("scriptStructureToText and formatScriptStructureForPrompt support plain text narrative blueprints", async () => {
  const { scriptStructureToText, formatScriptStructureForPrompt, DEFAULT_SCRIPT_STRUCTURE_TEXT } = await import("../src/lib/defaultScriptStructure.js");

  // Plain text directive passed directly
  const plainTextDirective = "1. HOOK: Hit them with a paradox.\n2. ACT 1: Unpack the problem.\n3. ACT 2: Reveal the solution.";
  assert.equal(scriptStructureToText(plainTextDirective), plainTextDirective);
  assert.equal(formatScriptStructureForPrompt(plainTextDirective), plainTextDirective);

  // Object wrapper with text key { text: "..." }
  assert.equal(scriptStructureToText({ text: plainTextDirective }), plainTextDirective);
  assert.equal(formatScriptStructureForPrompt({ text: plainTextDirective }), plainTextDirective);

  // Null or empty falls back to DEFAULT_SCRIPT_STRUCTURE_TEXT
  assert.equal(scriptStructureToText(null), DEFAULT_SCRIPT_STRUCTURE_TEXT);
  assert.equal(scriptStructureToText("   "), DEFAULT_SCRIPT_STRUCTURE_TEXT);
});


