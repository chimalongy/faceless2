/* Faceless Studio — Extension Settings
 * You can edit this configuration file at any time.
 */

const setup = {
  start_up_instruction: `Hi, I need you to assist me in generating images for content titled "{topicTitle}".

I will provide the prompts for each scene in batches of "{batch_count}", and you would generate the image.
each scene prompt would be mapped with a scene number
eg 
scene_1
audio_text: "the words that would be spoken"
image_prompt: "<image prompt text for scene 1>"

scene_2
audio_text: "the words that would be spoken"
image_prompt: "<image prompt text for scene 2>"

scene_3
audio_text: "the words that would be spoken"
image_prompt: "<image prompt text for scene 3>"


Ensure only one Image is Generated Per Prompt or Per Scene. and name each image by thier scene number

for exampe 1.png, 2.png, 3.png continuously

when generating images ensure that image follow this theme
"{channel_image_generation_theme}"`,

  theme_instruction: `when generating images ensure that image follow this theme
"{channel_image_generation_theme}"`,

  missing_scenes_header: `Lets Focus on Generating for these scenes`,

  thumbnail_instruction: `Hi, I need you to assist me in generating a high-converting YouTube thumbnail for content titled "{topicTitle}".

thumbnail_prompt: "{thumbnail_prompt}"

Ensure only one Image is Generated. Name the image thumbnail.png.

when generating images ensure that image follow this theme
"{channel_thumbnail_generation_theme}"`
};

// Export for module/bundler compatibility if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = setup;
}
