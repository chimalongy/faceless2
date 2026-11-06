/**
 * Image Theme & Consistent Visual Identity Utilities
 *
 * Implements the 6-field "Keep Consistent" structure from Qwen Image Studio:
 * - visualStyle
 * - characterIdentity
 * - wardrobe
 * - colorPalette
 * - rendering
 * - backgroundTreatment
 */

export const IMAGE_THEME_FIELDS = [
  {
    key: "visualStyle",
    label: "Visual Style",
    placeholder: "e.g. Cinematic 2D animated illustration with soft anime-inspired line work and subtle film grain...",
    description: "Overall artistic medium, style direction, and line work.",
  },
  {
    key: "characterIdentity",
    label: "Character Identity",
    placeholder: "e.g. 30-year-old Black man, short buzz cut fade, trimmed goatee, athletic slim build, stoic calm expression...",
    description: "Fixed subject physical traits, facial features, and build.",
  },
  {
    key: "wardrobe",
    label: "Wardrobe",
    placeholder: "e.g. Charcoal gray oversized heavyweight hoodie, dark raw denim trousers, black leather boots...",
    description: "Consistent clothing, materials, and accessories across scenes.",
  },
  {
    key: "colorPalette",
    label: "Color Palette",
    placeholder: "e.g. Deep navy obsidian, warm amber streetlamp highlights, deep indigo shadows, muted saturation...",
    description: "Dominant color grading, accents, and shadow tones.",
  },
  {
    key: "rendering",
    label: "Rendering",
    placeholder: "e.g. High-detail digital illustration, volumetric atmospheric lighting, cinematic anamorphic bokeh...",
    description: "Lighting technique, shading, texture, and optical qualities.",
  },
  {
    key: "backgroundTreatment",
    label: "Background Treatment",
    placeholder: "e.g. Modern minimalist urban architecture, clean surfaces, soft depth of field blurring the background...",
    description: "Environmental setting rules, depth of field, and atmosphere.",
  },
];

export const DEFAULT_IMAGE_THEME = Object.freeze({
  visualStyle: "",
  characterIdentity: "",
  wardrobe: "",
  colorPalette: "",
  rendering: "",
  backgroundTreatment: "",
});

/**
 * Parses any incoming image_theme (JSON string, raw legacy string, or object)
 * into a structured 6-field object.
 *
 * @param {string|object|null|undefined} input
 * @returns {{visualStyle: string, characterIdentity: string, wardrobe: string, colorPalette: string, rendering: string, backgroundTreatment: string}}
 */
export function parseImageTheme(input) {
  if (!input) {
    return { ...DEFAULT_IMAGE_THEME };
  }

  let obj = input;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return { ...DEFAULT_IMAGE_THEME };
    }
    try {
      obj = JSON.parse(trimmed);
    } catch {
      // Legacy plain text string fallback — treat the entire string as visualStyle
      return {
        ...DEFAULT_IMAGE_THEME,
        visualStyle: trimmed,
      };
    }
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ...DEFAULT_IMAGE_THEME };
  }

  // Handle nested creative_themes or image_theme wrapper if passed
  if (obj.image_theme && typeof obj.image_theme === "object") {
    obj = obj.image_theme;
  } else if (obj.imageTheme && typeof obj.imageTheme === "object") {
    obj = obj.imageTheme;
  }

  const clean = (val) => (typeof val === "string" ? val.trim() : "");

  return {
    visualStyle: clean(obj.visualStyle ?? obj.visual_style ?? obj.style ?? ""),
    characterIdentity: clean(obj.characterIdentity ?? obj.character_identity ?? obj.character ?? ""),
    wardrobe: clean(obj.wardrobe ?? obj.clothing ?? obj.outfit ?? ""),
    colorPalette: clean(obj.colorPalette ?? obj.color_palette ?? obj.colors ?? obj.palette ?? ""),
    rendering: clean(obj.rendering ?? obj.render ?? obj.lighting ?? ""),
    backgroundTreatment: clean(obj.backgroundTreatment ?? obj.background_treatment ?? obj.background ?? ""),
  };
}

/**
 * Checks if the image theme has any content configured.
 *
 * @param {string|object} theme
 * @returns {boolean}
 */
export function hasImageThemeContent(theme) {
  const parsed = parseImageTheme(theme);
  return Boolean(
    parsed.visualStyle ||
    parsed.characterIdentity ||
    parsed.wardrobe ||
    parsed.colorPalette ||
    parsed.rendering ||
    parsed.backgroundTreatment
  );
}

/**
 * Serializes the theme to a standardized JSON string for storage in PostgreSQL.
 *
 * @param {string|object} theme
 * @returns {string}
 */
export function serializeImageTheme(theme) {
  const parsed = parseImageTheme(theme);
  return JSON.stringify(parsed);
}

function formatStructuredThemeObject(parsed) {
  const lines = ["VISUAL IDENTITY", ""];

  if (parsed.visualStyle) {
    lines.push(`Visual Style:\n${parsed.visualStyle}\n`);
  }
  if (parsed.characterIdentity) {
    lines.push(`Character Identity:\n${parsed.characterIdentity}\n`);
  }
  if (parsed.wardrobe) {
    lines.push(`Wardrobe:\n${parsed.wardrobe}\n`);
  }
  if (parsed.colorPalette) {
    lines.push(`Color Palette:\n${parsed.colorPalette}\n`);
  }
  if (parsed.rendering) {
    lines.push(`Rendering:\n${parsed.rendering}\n`);
  }
  if (parsed.backgroundTreatment) {
    lines.push(`Background Treatment:\n${parsed.backgroundTreatment}\n`);
  }

  if (lines.length === 2) {
    return "";
  }

  return lines.join("\n").trim();
}

/**
 * Formats the structured image theme into the VISUAL IDENTITY block
 * for LLM storyboard director and image generation pipelines.
 * If given a legacy unstructured string, returns the string directly.
 *
 * @param {string|object} theme
 * @returns {string}
 */
export function formatImageThemeBlock(theme) {
  if (!theme) return "";

  if (typeof theme === "string") {
    const trimmed = theme.trim();
    if (!trimmed) return "";
    try {
      const parsedJson = JSON.parse(trimmed);
      if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
        return formatStructuredThemeObject(parseImageTheme(parsedJson));
      }
    } catch {
      // Legacy plain text string — return as-is for backward compatibility
      return trimmed;
    }
  }

  if (typeof theme === "object" && theme !== null && !Array.isArray(theme)) {
    return formatStructuredThemeObject(parseImageTheme(theme));
  }

  return "";
}

/**
 * Formats camera framing, angle, and lens options into a concise framing tag
 * to prepend to the scene prompt for AI image generation models.
 *
 * @param {object} [cameraOptions={}]
 * @param {string} [cameraOptions.shotType] - e.g. "extreme_wide", "medium_shot", "close_up"
 * @param {string} [cameraOptions.cameraAngle] - e.g. "low_angle", "eye_level", "dutch_angle"
 * @param {string} [cameraOptions.lens] - e.g. "35mm cinematic", "85mm portrait compression"
 * @returns {string} e.g. "[Framing: Medium Shot, Low Angle, 85mm portrait compression]" or ""
 */
export function formatCameraFraming(cameraOptions = {}) {
  if (!cameraOptions || typeof cameraOptions !== "object") return "";

  const shotType = (cameraOptions.shotType || cameraOptions.shot_type || "").trim();
  const cameraAngle = (cameraOptions.cameraAngle || cameraOptions.camera_angle || "").trim();
  const lens = (cameraOptions.lens || "").trim();

  const parts = [];

  if (shotType) {
    const readable = shotType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    parts.push(readable.toLowerCase().includes("shot") ? readable : `${readable} Shot`);
  }

  if (cameraAngle) {
    const readable = cameraAngle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    parts.push(readable.toLowerCase().includes("angle") ? readable : `${readable} Angle`);
  }

  if (lens) {
    parts.push(lens);
  }

  return parts.length > 0 ? `[Framing: ${parts.join(", ")}]` : "";
}

/**
 * Determines whether the character's facial and head physical identity should be injected into the prompt.
 * Prevents prompt pollution (e.g. forcing face, glasses, and hair into a macro shot of feet, pedals, or objects).
 *
 * @param {string} scenePrompt
 * @param {object} [cameraOptions={}]
 * @returns {boolean}
 */
export function shouldIncludeCharacterIdentity(scenePrompt = "", cameraOptions = {}) {
  const prompt = (scenePrompt || "").toLowerCase();
  const shotType = (cameraOptions.shotType || cameraOptions.shot_type || "").toLowerCase();
  const lens = (cameraOptions.lens || "").toLowerCase();

  const isMacroOrExtremeCloseUp =
    shotType === "extreme_close_up" ||
    lens.includes("macro") ||
    prompt.includes("extreme close-up") ||
    prompt.includes("macro shot");

  // Facial keywords that indicate the face or head is the intended focal subject
  const faceKeywords = [
    "face", "eyes", "eye", "glasses", "spectacles", "expression", "gaze",
    "smile", "frown", "stare", "glance", "brow", "lips", "mouth", "hair",
    "forehead", "jaw", "chin", "looking at", "smirking", "grinning"
  ];
  const mentionsFace = faceKeywords.some((kw) => prompt.includes(kw));

  // If it is a macro or extreme close-up, only include character face if the face is explicitly the subject
  if (isMacroOrExtremeCloseUp && !mentionsFace) {
    return false;
  }

  // If the prompt specifically targets isolated limbs, footwear, or objects and does not mention face
  const isolatedBodyOrObject = [
    "feet", "foot", "shoes", "sneakers", "pedal", "pedals", "hands holding",
    "fingers", "wrist", "watch", "phone", "pocket watch", "coin", "keyboard",
    "steering wheel", "desk", "workbench", "floor mat", "keys"
  ];
  const isTargetingIsolatedPart = isolatedBodyOrObject.some((term) => prompt.includes(term));

  if (isTargetingIsolatedPart && !mentionsFace && (shotType === "close_up" || isMacroOrExtremeCloseUp)) {
    return false;
  }

  // Pure environment / landscape establishing shots without human subjects
  const hasSubjectMention =
    prompt.includes("main character") ||
    prompt.includes("observer") ||
    prompt.includes("protagonist") ||
    prompt.includes("man ") ||
    prompt.includes("he ") ||
    prompt.includes("his ") ||
    prompt.includes("person");

  if (shotType === "extreme_wide" && !hasSubjectMention) {
    return false;
  }

  return true;
}

/**
 * Determines whether the wardrobe directives should be injected into the prompt.
 *
 * @param {string} scenePrompt
 * @param {object} [cameraOptions={}]
 * @returns {boolean}
 */
export function shouldIncludeWardrobe(scenePrompt = "", cameraOptions = {}) {
  const prompt = (scenePrompt || "").toLowerCase();
  const shotType = (cameraOptions.shotType || cameraOptions.shot_type || "").toLowerCase();
  const lens = (cameraOptions.lens || "").toLowerCase();

  const isMacroOrExtremeCloseUp = shotType === "extreme_close_up" || lens.includes("macro");

  // If extreme macro focusing on an inanimate object (phone, watch, coin, book, key) with no clothing
  const mentionsClothingOrBody = [
    "wear", "wearing", "shoe", "shoes", "sneaker", "sneakers", "boots",
    "jacket", "shirt", "t-shirt", "overshirt", "hoodie", "trouser", "trousers",
    "pants", "sleeve", "pocket", "coat", "suit", "feet", "foot", "torso"
  ];
  const isClothingRelevant = mentionsClothingOrBody.some((kw) => prompt.includes(kw));

  if (isMacroOrExtremeCloseUp && !isClothingRelevant) {
    return false;
  }

  // Pure environment shot without human subjects
  const hasSubjectMention =
    prompt.includes("main character") ||
    prompt.includes("observer") ||
    prompt.includes("protagonist") ||
    prompt.includes("man ") ||
    prompt.includes("he ") ||
    prompt.includes("his ") ||
    prompt.includes("person");

  if (shotType === "extreme_wide" && !hasSubjectMention) {
    return false;
  }

  return true;
}

/**
 * Builds the focused, high-impact prompt for AI image generation models (Qwen Image Turbo / Modal).
 * - Puts the Scene & Camera Framing at the very top so diffusion models anchor their attention on the scene action.
 * - Eliminates redundant boilerplate meta-instructions ("IMAGE GENERATION INSTRUCTIONS...").
 * - Conditionally filters character facial identity & wardrobe to prevent multi-subject hallucinations
 *   (e.g. prevents faces from appearing in close-ups of feet, pedals, or inanimate objects).
 *
 * @param {string|object} theme - The channel image theme
 * @param {string} scenePrompt - The specific scene description/prompt
 * @param {object} [cameraOptions={}] - Optional camera framing parameters ({ shotType, cameraAngle, lens })
 * @returns {string}
 */
export function buildFullImagePrompt(theme, scenePrompt = "", cameraOptions = {}) {
  const cleanScene = (scenePrompt || "").trim();
  const framingTag = formatCameraFraming(cameraOptions);

  // 1. Scene & Framing Section (ALWAYS FIRST FOR DIFFUSION ATTENTION)
  let sceneBlock = "";
  if (framingTag && cleanScene) {
    sceneBlock = `${framingTag}\n${cleanScene}`;
  } else if (framingTag) {
    sceneBlock = framingTag;
  } else if (cleanScene) {
    sceneBlock = cleanScene;
  }

  // 2. Style & Visual Direction Section (AFTER THE SCENE)
  const sections = [];
  if (sceneBlock) {
    sections.push(sceneBlock);
  }

  if (theme) {
    let parsed = null;
    let isLegacyString = false;

    if (typeof theme === "string") {
      const trimmed = theme.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          parsed = parseImageTheme(trimmed);
        } catch {
          isLegacyString = true;
        }
      } else if (trimmed) {
        isLegacyString = true;
      }
    } else if (typeof theme === "object" && theme !== null && !Array.isArray(theme)) {
      parsed = parseImageTheme(theme);
    }

    if (parsed) {
      const includeChar = shouldIncludeCharacterIdentity(cleanScene, cameraOptions);
      const includeWardrobe = shouldIncludeWardrobe(cleanScene, cameraOptions);

      const styleLines = [];

      if (parsed.visualStyle) {
        styleLines.push(`Visual Style: ${parsed.visualStyle}`);
      }
      if (includeChar && parsed.characterIdentity) {
        styleLines.push(`Character Identity: ${parsed.characterIdentity}`);
      }
      if (includeWardrobe && parsed.wardrobe) {
        styleLines.push(`Wardrobe: ${parsed.wardrobe}`);
      }
      if (parsed.rendering) {
        styleLines.push(`Rendering: ${parsed.rendering}`);
      }
      if (parsed.colorPalette) {
        styleLines.push(`Color Palette: ${parsed.colorPalette}`);
      }
      if (parsed.backgroundTreatment) {
        styleLines.push(`Background Treatment: ${parsed.backgroundTreatment}`);
      }

      if (styleLines.length > 0) {
        sections.push(`STYLE & VISUAL DIRECTION:\n${styleLines.join("\n\n")}`);
      }
    } else if (isLegacyString) {
      sections.push(`STYLE & VISUAL DIRECTION:\n${theme.trim()}`);
    }
  }

  return sections.join("\n\n");
}
