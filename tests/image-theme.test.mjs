import test from "node:test";
import assert from "node:assert/strict";

import {
  parseImageTheme,
  serializeImageTheme,
  formatImageThemeBlock,
  buildFullImagePrompt,
  formatCameraFraming,
  shouldIncludeCharacterIdentity,
  shouldIncludeWardrobe,
  formatCharacterForPrompt,
  IMAGE_THEME_FIELDS,
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

test("buildFullImagePrompt compiles focused prompt starting with scene and style directives", () => {
  const theme = {
    visualStyle: "2D illustration",
    characterIdentity: "Detective",
  };
  const scene = "Walking down a misty alley at midnight";
  const prompt = buildFullImagePrompt(theme, scene);

  // Starts with the scene
  assert.ok(prompt.startsWith("Walking down a misty alley at midnight"));
  assert.match(prompt, /STYLE & VISUAL DIRECTION:/);
  assert.match(prompt, /Visual Style: 2D illustration/);
  assert.match(prompt, /Character Identity: Detective/);
  // No bloated meta-instructions
  assert.doesNotMatch(prompt, /IMAGE GENERATION INSTRUCTIONS/);
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

test("buildFullImagePrompt includes framing tag at the very top", () => {
  const theme = { visualStyle: "Anime cel-shaded" };
  const scene = "The main character looks at the horizon.";
  const camera = {
    shot_type: "medium_close_up",
    camera_angle: "eye_level",
    lens: "50mm standard prime",
  };
  const prompt = buildFullImagePrompt(theme, scene, camera);

  assert.ok(
    prompt.startsWith("[Framing: Medium Close Up Shot, Eye Level Angle, 50mm standard prime]\nThe main character looks at the horizon.")
  );
  assert.match(prompt, /Visual Style: Anime cel-shaded/);
  assert.doesNotMatch(prompt, /IMAGE GENERATION INSTRUCTIONS/);
});

test("shouldIncludeCharacterIdentity and shouldIncludeWardrobe handle 'clean stitching' and 'worms eye' without false positives", () => {
  const footScene = "An extreme close-up highlights the main character's feet resting near the vehicle's floor pedals, showcasing premium, pristine designer sneakers with clean stitching and textured soles. Soft ambient cabin light catches the fine materials of the footwear, casting gentle shadows on the clean floor mat below. The background is softly blurred, emphasizing the sharp focus on the high-end shoes.";
  const camera = {
    shot_type: "extreme_close_up",
    camera_angle: "worms_eye",
    lens: "100mm macro",
  };

  assert.equal(shouldIncludeCharacterIdentity(footScene, camera), false);
  assert.equal(shouldIncludeWardrobe(footScene, camera), false);

  const theme = {
    visualStyle: "Modern 2D digital illustration",
    characterIdentity: "The Observer is a lean young adult White male with round amber-tinted glasses.",
    wardrobe: "The Observer wears a burnt-orange button-down overshirt worn over a charcoal T-shirt.",
    rendering: "Clean uniform line-art",
    colorPalette: "Warm whites",
    backgroundTreatment: "Clear depth separation",
  };

  const compiled = buildFullImagePrompt(theme, footScene, camera);
  assert.doesNotMatch(compiled, /Character Identity:/);
  assert.doesNotMatch(compiled, /Wardrobe:/);
  assert.doesNotMatch(compiled, /amber-tinted glasses/);
  assert.doesNotMatch(compiled, /burnt-orange button-down overshirt/);
  assert.match(compiled, /Visual Style: Modern 2D digital illustration/);
  assert.match(compiled, /Rendering: Clean uniform line-art/);
});


test("shouldIncludeCharacterIdentity includes facial traits on medium / portrait shots", () => {
  const faceScene = "The main character sits behind the steering wheel, looking thoughtfully out the windshield.";
  const camera = { shot_type: "medium_shot", camera_angle: "eye_level" };

  assert.equal(shouldIncludeCharacterIdentity(faceScene, camera), true);

  const theme = {
    visualStyle: "2D animation",
    characterIdentity: "Young man with amber glasses and messy dark hair",
    wardrobe: "Orange overshirt and dark pants",
  };

  const compiled = buildFullImagePrompt(theme, faceScene, camera);
  assert.match(compiled, /amber glasses/);
  assert.match(compiled, /Orange overshirt/);
});

test("IMAGE_THEME_FIELDS contains 4 visual style fields without wardrobe or characterIdentity", () => {
  assert.equal(IMAGE_THEME_FIELDS.length, 4);
  const keys = IMAGE_THEME_FIELDS.map((f) => f.key);
  assert.deepEqual(keys, ["visualStyle", "colorPalette", "rendering", "backgroundTreatment"]);
  assert.equal(keys.includes("characterIdentity"), false);
  assert.equal(keys.includes("wardrobe"), false);
});

test("formatCharacterForPrompt produces structured 4-field specification", () => {
  const character = {
    name: "The Observer",
    physicalSpec: "Lean young adult White male with fair skin, tousled dark-brown hair",
    signatureFeature: "Signature round amber-tinted glasses",
    wardrobe: "Burnt-orange button-down overshirt over charcoal T-shirt",
  };

  const formatted = formatCharacterForPrompt(character);
  assert.match(formatted, /Name: The Observer/);
  assert.match(formatted, /Physical Spec: Lean young adult White male/);
  assert.match(formatted, /Signature Feature: Signature round amber-tinted glasses/);
  assert.match(formatted, /Wardrobe: Burnt-orange button-down overshirt/);
});

test("buildFullImagePrompt injects structured character into scene prompts", () => {
  const theme = {
    visualStyle: "Modern 2D illustration",
    colorPalette: "Deep navy and amber",
    rendering: "Clean lines",
    backgroundTreatment: "Atmospheric depth",
  };
  const character = {
    name: "The Observer",
    physicalSpec: "Lean young adult male with dark-brown hair",
    signatureFeature: "Signature round amber-tinted glasses",
    wardrobe: "Burnt-orange button-down overshirt",
  };
  const scene = "The Observer gazes across the cityscape from a high balcony, holding a coffee cup.";
  const camera = { shot_type: "medium_shot", camera_angle: "eye_level" };

  const compiled = buildFullImagePrompt(theme, scene, camera, character);
  assert.match(compiled, /Visual Style: Modern 2D illustration/);
  assert.match(compiled, /Character Identity: Lean young adult male with dark-brown hair/);
  assert.match(compiled, /Signature Feature: Signature round amber-tinted glasses/);
  assert.match(compiled, /Wardrobe: Burnt-orange button-down overshirt/);
});
