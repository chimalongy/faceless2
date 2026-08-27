/* Faceless Studio — Extension Settings
 * You can edit this configuration file at any time.
 */

const setup = {
  start_up_instruction: `Hi, I need you to assist me in generating images for content titled "{topicTitle}".

I will provide the prompts for each scene in batches of "{batch_count}", and you would generate the image.
each scene prompt would be mapped with a scene number
eg 
scene_1
image_prompt:

scene_2
image_prompt

scene_3


Ensure only one Image is Generated Per Prompt or Per Scene. and name each image by thier scene number

for exampe 1.png, 2.png, 3.png continuously

when generating images ensure that image follow this theme
"{channel_image_generation_theme}"`,

  theme_instruction: `when generating images ensure that image follow this theme
"{channel_image_generation_theme}"`,

  missing_scenes_header: `Lets Focus on Generating for these scenes`
};

// Export for module/bundler compatibility if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = setup;
}
