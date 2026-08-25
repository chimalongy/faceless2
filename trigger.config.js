import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_bwrjxmtjohczffccdzae",
  dirs: ["./src/trigger"],
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
