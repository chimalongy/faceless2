import { task, logger } from "@trigger.dev/sdk";

export const generateImagesTask = task({
  id: "generate-images",
  run: async (payload) => {
    logger.log("Generating images with payload:", { payload });

    // Placeholder execution - to be implemented
    return {
      success: true,
      message: "Images generation task completed",
      payload,
    };
  },
});

export default generateImagesTask;
