import { getDbSql, initDbSchema } from "@/lib/db";

/**
 * Get the configured maximum image generations allowed per URL per month.
 * Default is 250 (from process.env.MAX_IMAGE_URL_GEN).
 */
export function getMaxImageUrlGen() {
  const envVal = parseInt(process.env.MAX_IMAGE_URL_GEN, 10);
  return !isNaN(envVal) && envVal > 0 ? envVal : 250;
}

/**
 * Get current year-month string (e.g., "2026-08")
 */
export function getCurrentMonthString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Load all image API keys and endpoints from the database.
 * Only resets monthly usage when the month rolls over (e.g., from 2026-07 to 2026-08).
 * Never resets user-configured values within the same month.
 */
export async function loadImageEndpoints() {
  const sql = getDbSql();
  if (!sql) {
    throw new Error("Database connection not available. Please check DATABASE_URL.");
  }

  await initDbSchema();

  const currentMonth = getCurrentMonthString();
  const maxQuota = getMaxImageUrlGen();

  try {
    // 1. Initialize any uninitialized rows to the current month WITHOUT modifying their usage
    await sql`
      UPDATE image_endpoints
      SET last_reset_month = ${currentMonth}
      WHERE last_reset_month IS NULL;
    `;

    // 2. Only reset usage on the 1st of a new month (when last_reset_month is from a previous month)
    await sql`
      UPDATE image_endpoints
      SET usage = ${maxQuota},
          last_reset_month = ${currentMonth},
          updated_at = NOW()
      WHERE last_reset_month != ${currentMonth};
    `;
  } catch (resetErr) {
    console.warn("Could not check monthly image endpoint quota rollover:", resetErr);
  }

  // Fetch all endpoints ordered by ID
  const endpoints = await sql`
    SELECT 
      id,
      account_email AS "accountEmail",
      gen_url AS "genUrl",
      usage,
      last_reset_month AS "lastResetMonth",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM image_endpoints
    ORDER BY id ASC;
  `;

  return endpoints || [];
}

/**
 * Decrement the usage count for a specific endpoint by 1 in the database.
 */
export async function decrementEndpointUsage(endpointId) {
  const sql = getDbSql();
  if (!sql || !endpointId) return 0;

  try {
    const updated = await sql`
      UPDATE image_endpoints
      SET usage = GREATEST(0, usage - 1),
          updated_at = NOW()
      WHERE id = ${endpointId}
      RETURNING usage;
    `;
    return updated?.[0]?.usage ?? 0;
  } catch (err) {
    console.error(`Failed to decrement usage for endpoint ${endpointId}:`, err);
    return 0;
  }
}

/**
 * Generate an image using the loaded endpoints pool.
 * Loops through endpoints and skips any with usage === 0.
 * If all endpoints are exhausted (0), returns a clear error.
 * 
 * @param {Object} options
 * @param {string} options.prompt - The full image prompt
 * @param {number} [options.width=1664] - Image width
 * @param {number} [options.height=928] - Image height
 * @param {number} [options.numInferenceSteps=50] - Inference steps
 * @param {number} [options.seed=42] - Seed
 * @param {number} [options.timeoutMs=300000] - Timeout in milliseconds (default: 5 min)
 * @returns {Promise<{ success: boolean, imageBase64: string, imageBuffer: Buffer, endpointUsed: string, remainingUsage: number }>}
 */
export async function generateImage({
  prompt,
  width = 1664,
  height = 928,
  numInferenceSteps = 50,
  seed = 42,
  timeoutMs = 300000,
}) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("Prompt is required for image generation.");
  }

  // 1. Load all API keys and endpoints
  const endpoints = await loadImageEndpoints();

  if (!endpoints || endpoints.length === 0) {
    throw new Error("No image generation endpoints found in database. Please add one in Dashboard Settings.");
  }

  // 2. Filter endpoints that still have available usage (> 0)
  const availableEndpoints = endpoints.filter((ep) => ep.genUrl && (parseInt(ep.usage, 10) > 0));

  // If all endpoints have 0 usage remaining
  if (availableEndpoints.length === 0) {
    throw new Error("Endpoint usage exhausted. All image generation endpoints have 0 remaining quota.");
  }

  let lastError = null;

  // 3. Loop through available endpoints that have usage > 0
  for (const endpoint of availableEndpoints) {
    const currentUsage = parseInt(endpoint.usage, 10);
    if (currentUsage <= 0) {
      console.log(`[ImageGenerator] Skipping endpoint ${endpoint.accountEmail} (usage is 0).`);
      continue;
    }

    console.log(
      `[ImageGenerator] Attempting generation with endpoint: ${endpoint.accountEmail} (${endpoint.genUrl}) - Remaining Quota: ${currentUsage}`
    );

    const payload = {
      prompt,
      width,
      height,
      num_inference_steps: numInferenceSteps,
      seed,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint.genUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();

      if (data && data.status === "success") {
        const base64Data = data.image_base64;
        if (!base64Data) {
          throw new Error("Endpoint responded with success but no image_base64 payload was returned.");
        }

        const imageBuffer = Buffer.from(base64Data, "base64");

        // 4. Reduce usage by 1 in the database
        const remainingUsage = await decrementEndpointUsage(endpoint.id);

        console.log(
          `[ImageGenerator] Success! Generated image via ${endpoint.accountEmail}. Endpoint usage decremented to ${remainingUsage}.`
        );

        return {
          success: true,
          imageBase64: base64Data,
          imageBuffer,
          endpointUsed: endpoint.accountEmail,
          genUrlUsed: endpoint.genUrl,
          remainingUsage,
        };
      } else {
        const errMsg = data?.message || JSON.stringify(data);
        console.warn(`[ImageGenerator] Endpoint ${endpoint.accountEmail} returned non-success status:`, errMsg);
        lastError = new Error(`Endpoint returned status: ${errMsg}`);
      }
    } catch (reqError) {
      console.warn(`[ImageGenerator] Failed request to endpoint ${endpoint.accountEmail}:`, reqError.message);
      lastError = reqError;
      // Continue to next endpoint in the pool
    }
  }

  // If all attempts failed
  throw new Error(`Image generation failed across all available endpoints: ${lastError?.message || "Unknown error"}`);
}
