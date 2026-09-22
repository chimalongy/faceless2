/**
 * Default Outro Scene Configuration for Short-Form Content (YouTube Shorts, TikTok, Reels)
 * 
 * Edit this configuration file at any time to modify:
 * - audio_text: The call-to-action narration spoken at the end
 * - images: The 9:16 vertical character/visual prompt
 * - transition: Transition effect into/out of this scene (e.g. "fade-out")
 * - ken_burns: Camera motion direction and intensity (e.g. "zoom-in")
 * 
 * This scene will automatically be appended as the final scene whenever
 * scenes are pasted for a short-form topic in the studio.
 */

export const DEFAULT_SHORT_OUTRO_SCENE = {
  audio_text: "If you enjoyed this, like, follow and share — @moneykoncepts.",
  number_of_images: 1,
  images: [
    {
      image_number: 1,
      image_prompt:
        "Vertical 9:16 portrait composition, dynamic framing, medium shot of The Observer standing centered in a bright sunlit room, tousled dark-brown hair, round amber-tinted glasses, burnt-orange button-down overshirt over charcoal T-shirt, facing directly toward camera with a calm approachable expression and a slight nod, warm even daylight filling the space, soft natural highlights along his silhouette, clean 2D digital illustration with crisp black line-art and cell-shading, subject centered with top 15% and bottom 25% kept clear for UI overlays, no text or logos in image",
    },
  ],
  transition: "fade-out",
  ken_burns: {
    direction: "zoom-in",
    intensity: 0.1,
  },
};

/**
 * Returns a complete outro scene object with the specified scene number.
 *
 * @param {number} sceneNumber - The scene number to assign (last index + 1)
 * @param {Object} [overrides={}] - Optional property overrides
 * @returns {Object} Structured scene object conforming to the scenes schema
 */
export function getShortOutroScene(sceneNumber, overrides = {}) {
  const base = {
    ...DEFAULT_SHORT_OUTRO_SCENE,
    ...overrides,
  };

  const images = (base.images || []).map((img, idx) => ({
    image_number: img.image_number || idx + 1,
    image_prompt: img.image_prompt || "",
  }));

  const primaryPrompt = images[0]?.image_prompt || "";

  return {
    scene_number: sceneNumber,
    audio_text: base.audio_text,
    number_of_images: base.number_of_images || images.length || 1,
    images,
    image_prompt: primaryPrompt,
    transition: base.transition || "fade-out",
    ken_burns: {
      direction: base.ken_burns?.direction || "zoom-in",
      intensity:
        typeof base.ken_burns?.intensity === "number"
          ? base.ken_burns.intensity
          : 0.1,
    },
  };
}

export default DEFAULT_SHORT_OUTRO_SCENE;
