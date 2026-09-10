/* Faceless Studio — Extension Settings
 * You can edit this configuration file at any time.
 */

const setup = {
  start_up_instruction: `Hi, I need you to assist me in generating images for content titled "{topicTitle}".

I will provide the prompts for each scene in batches of "{batch_count}", and you would generate the image.
each scene prompt would be mapped with a scene identifier.
eg 
scene_1
audio_text: "the words that would be spoken"
image_prompt: "<image prompt text for scene 1>"

scene_2_1
audio_text: "the words that would be spoken"
image_prompt: "<image prompt text for image 1 of scene 2>"

scene_2_2
audio_text: "the words that would be spoken"
image_prompt: "<image prompt text for image 2 of scene 2>"

scene_3
audio_text: "the words that would be spoken"
image_prompt: "<image prompt text for scene 3>"


Ensure only one Image is Generated Per Prompt. Name each image by its scene identifier:
- For single-image scenes: name by scene number (e.g. 1.png, 3.png)
- For multi-image scenes: name by scene and image number (e.g. 2_1.png, 2_2.png)

when generating images ensure that image follow this theme
"{channel_image_generation_theme}"

make sure the generated images are inline (visual description) of what is being said in the audio-text.
`,

  theme_instruction: `when generating images ensure that image follow this theme
"{channel_image_generation_theme}"

make sure the generated images are inline (visual description) of what is being said in the audio-text.
`,

  missing_scenes_header: `Lets Focus on Generating for these scenes`,

  thumbnail_instruction: `Hi, I need you to assist me in generating a high-converting YouTube thumbnail for content titled "{topicTitle}".

thumbnail_prompt: "{thumbnail_prompt}"

Ensure only one Image is Generated. Name the image thumbnail.png.

when generating images ensure that image follow this theme
"{channel_thumbnail_generation_theme}"`,
};

// Export for module/bundler compatibility if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = setup;
}
