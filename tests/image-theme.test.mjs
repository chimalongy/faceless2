import test from "node:test";
import assert from "node:assert/strict";

import {
  parseImageTheme,
  serializeImageTheme,
  formatImageThemeBlock,
  buildFullImagePrompt,
  formatCameraFraming,
  DEFAULT_IMAGE_THEME,
} from "../src/lib/image-theme.js";

test("parseImageTheme handles empty or null input", () => {
  assert.deepEqual(parseImageTheme(null), DEFAULT_IMAGE_THEME);
  assert.deepEqual(parseImageTheme(""), DEFAULT_IMAGE_THEME);
  assert.deepEqual(parseImageTheme("   "), DEFAULT_IMAGE_THEME);
});

test("parseImageTheme handles legacy plain text gracefully", () => {
  const legacyText = "Dark modern editorial, gold accents, cinematic lighting";
  const parsed = parseImageTheme(legacyText);
  assert.equal(parsed.visualStyle, legacyText);
  assert.equal(parsed.characterIdentity, "");
  assert.equal(parsed.wardrobe, "");
});

test("parseImageTheme parses valid JSON string with camelCase", () => {
  const json = JSON.stringify({
    visualStyle: "2D anime style",
    characterIdentity: "Young detective",
    wardrobe: "Brown trench coat",
    colorPalette: "Sepia and teal",
    rendering: "Cel shaded",
    backgroundTreatment: "Rainy city street",
  });
  const parsed = parseImageTheme(json);
  assert.equal(parsed.visualStyle, "2D anime style");
  assert.equal(parsed.characterIdentity, "Young detective");
  assert.equal(parsed.wardrobe, "Brown trench coat");
  assert.equal(parsed.colorPalette, "Sepia and teal");
  assert.equal(parsed.rendering, "Cel shaded");
  assert.equal(parsed.backgroundTreatment, "Rainy city street");
});

test("parseImageTheme parses snake_case keys correctly", () => {
  const obj = {
    visual_style: "3D Pixar",
    character_identity: "Friendly robot",
    clothing: "Silver armor",
    color_palette: "Warm pastels",
    lighting: "Soft ambient",
    background_treatment: "Sunny garden",
  };
  const parsed = parseImageTheme(obj);
  assert.equal(parsed.visualStyle, "3D Pixar");
  assert.equal(parsed.characterIdentity, "Friendly robot");
  assert.equal(parsed.wardrobe, "Silver armor");
  assert.equal(parsed.colorPalette, "Warm pastels");
  assert.equal(parsed.rendering, "Soft ambient");
  assert.equal(parsed.backgroundTreatment, "Sunny garden");
});

test("serializeImageTheme produces valid JSON string", () => {
  const input = {
    visualStyle: "Cinematic Film",
    wardrobe: "Black suit",
  };
  const serialized = serializeImageTheme(input);
  const reParsed = JSON.parse(serialized);
  assert.equal(reParsed.visualStyle, "Cinematic Film");
  assert.equal(reParsed.wardrobe, "Black suit");
  assert.equal(reParsed.characterIdentity, "");
});

test("formatImageThemeBlock formats VISUAL IDENTITY section properly", () => {
  const theme = {
    visualStyle: "Cyberpunk neon",
    characterIdentity: "Cyborg mercenary",
  };
  const block = formatImageThemeBlock(theme);
  assert.match(block, /^VISUAL IDENTITY/);
  assert.match(block, /Visual Style:\nCyberpunk neon/);
  assert.match(block, /Character Identity:\nCyborg mercenary/);
  assert.doesNotMatch(block, /Wardrobe:/);
});

test("buildFullImagePrompt compiles full prompt with scene and instructions", () => {
  const theme = {
    visualStyle: "2D illustration",
    characterIdentity: "Detective",
  };
  const scene = "Walking down a misty alley at midnight";
  const prompt = buildFullImagePrompt(theme, scene);

  assert.match(prompt, /VISUAL IDENTITY/);
  assert.match(prompt, /Visual Style:\n2D illustration/);
  assert.match(prompt, /SCENE\n\nWalking down a misty alley at midnight/);
  assert.match(prompt, /IMAGE GENERATION INSTRUCTIONS/);
  assert.match(prompt, /Preserve all visual identity characteristics consistently/);
});

test("formatCameraFraming formats shot_type, camera_angle, and lens correctly", () => {
  assert.equal(formatCameraFraming({}), "");
  assert.equal(
    formatCameraFraming({ shot_type: "medium_shot", camera_angle: "low_angle", lens: "85mm portrait compression" }),
    "[Framing: Medium Shot, Low Angle, 85mm portrait compression]"
  );
  assert.equal(
    formatCameraFraming({ shotType: "close_up", cameraAngle: "dutch_angle" }),
    "[Framing: Close Up Shot, Dutch Angle]"
  );
  assert.equal(
    formatCameraFraming({ lens: "24mm wide-angle" }),
    "[Framing: 24mm wide-angle]"
  );
});

test("buildFullImagePrompt includes framing tag when cameraOptions provided", () => {
  const theme = { visualStyle: "Anime cel-shaded" };
  const scene = "The main character looks at the horizon.";
  const camera = {
    shot_type: "medium_close_up",
    camera_angle: "eye_level",
    lens: "50mm standard prime",
  };
  const prompt = buildFullImagePrompt(theme, scene, camera);

  assert.match(
    prompt,
    /SCENE\n\n\[Framing: Medium Close Up Shot, Eye Level Angle, 50mm standard prime\]\nThe main character looks at the horizon\./
  );
});


