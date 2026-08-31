import { defineConfig } from "@trigger.dev/sdk";
import { ffmpeg } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_wqauzosrghrjhvqiqyia",
  dirs: ["./src/trigger"],
  build: {
    extensions: [ffmpeg()],
  },
  maxDuration: 3600, // Maximum execution duration in seconds (1 hour)
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
