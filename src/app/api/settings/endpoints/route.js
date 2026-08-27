import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/settings/endpoints - Read all general settings, endpoints, and LLM accounts from Neon DB
export async function GET() {
  try {
    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({
        defaultLlmModel: "@cf/meta/llama-3.1-70b-instruct",
        scriptGenModel: "@cf/meta/llama-3.1-70b-instruct",
        sceneGenModel: "@cf/meta/llama-3.1-70b-instruct",
        imageEndpoints: [],
        audioEndpoints: [],
        llmAccounts: [],
        dbConnected: false,
      });
    }

    await initDbSchema();

    const generalRows = await sql`
      SELECT 
        id, 
        default_llm_model AS "defaultLlmModel", 
        script_gen_model AS "scriptGenModel", 
        scene_gen_model AS "sceneGenModel", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;

    const imageRows = await sql`
      SELECT id, account_email AS "accountEmail", gen_url AS "genUrl", usage, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM image_endpoints
      ORDER BY id ASC;
    `;

    const audioRows = await sql`
      SELECT id, account_email AS "accountEmail", gen_url AS "genUrl", usage, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM audio_endpoints
      ORDER BY id ASC;
    `;

    const llmRows = await sql`
      SELECT id, account_email AS "accountEmail", account_id AS "accountId", api_token AS "apiToken", created, updated
      FROM llm_accounts
      ORDER BY id ASC;
    `;

    const defaultLlmModel = generalRows && generalRows[0] ? (generalRows[0].defaultLlmModel || "@cf/meta/llama-3.1-70b-instruct") : "@cf/meta/llama-3.1-70b-instruct";
    const scriptGenModel = generalRows && generalRows[0] ? (generalRows[0].scriptGenModel || "@cf/meta/llama-3.1-70b-instruct") : "@cf/meta/llama-3.1-70b-instruct";
    const sceneGenModel = generalRows && generalRows[0] ? (generalRows[0].sceneGenModel || "@cf/meta/llama-3.1-70b-instruct") : "@cf/meta/llama-3.1-70b-instruct";

    return NextResponse.json({
      success: true,
      dbConnected: true,
      defaultLlmModel,
      scriptGenModel,
      sceneGenModel,
      generalSettings: generalRows && generalRows[0] ? generalRows[0] : { defaultLlmModel: "gpt-4o", scriptGenModel: "gpt-4o", sceneGenModel: "gpt-4o" },
      imageEndpoints: imageRows || [],
      audioEndpoints: audioRows || [],
      llmAccounts: llmRows || [],
    });
  } catch (error) {
    console.error("Failed to fetch endpoints from DB:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load endpoints from database" },
      { status: 500 }
    );
  }
}

// POST /api/settings/endpoints - Synchronize / Save all general settings, endpoints, and LLM accounts to Neon DB
export async function POST(request) {
  try {
    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json(
        { error: "Database not connected. Please configure DATABASE_URL." },
        { status: 503 }
      );
    }

    await initDbSchema();
    const body = await request.json();
    const { imageEndpoints = [], audioEndpoints = [], llmAccounts = [], defaultLlmModel, scriptGenModel, sceneGenModel } = body;

    // 1. Sync General Settings
    if (defaultLlmModel !== undefined || scriptGenModel !== undefined || sceneGenModel !== undefined) {
      const defModel = (defaultLlmModel || "@cf/meta/llama-3.1-70b-instruct").trim();
      const scrModel = (scriptGenModel || defaultLlmModel || "@cf/meta/llama-3.1-70b-instruct").trim();
      const scnModel = (sceneGenModel || defaultLlmModel || "@cf/meta/llama-3.1-70b-instruct").trim();

      const existing = await sql`SELECT id FROM general_settings LIMIT 1;`;
      if (existing && existing.length > 0) {
        await sql`
          UPDATE general_settings 
          SET 
            default_llm_model = ${defModel}, 
            script_gen_model = ${scrModel}, 
            scene_gen_model = ${scnModel}, 
            updated_at = NOW()
          WHERE id = ${existing[0].id};
        `;
      } else {
        await sql`
          INSERT INTO general_settings (default_llm_model, script_gen_model, scene_gen_model, created_at, updated_at)
          VALUES (${defModel}, ${scrModel}, ${scnModel}, NOW(), NOW());
        `;
      }
    }

    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    // 2. Sync Image Endpoints: Delete current and re-insert or upsert
    await sql`DELETE FROM image_endpoints;`;
    if (Array.isArray(imageEndpoints) && imageEndpoints.length > 0) {
      for (const ep of imageEndpoints) {
        const email = (ep.accountEmail || ep["account-email"] || "").trim();
        const url = (ep.genUrl || ep["gen-url"] || "").trim();
        const usage = parseInt(ep.usage, 10) || 0;

        if (email || url) {
          await sql`
            INSERT INTO image_endpoints (account_email, gen_url, usage, last_reset_month, updated_at)
            VALUES (${email}, ${url}, ${usage}, ${currentMonth}, NOW());
          `;
        }
      }
    }

    // 3. Sync Audio Endpoints: Delete current and re-insert or upsert
    await sql`DELETE FROM audio_endpoints;`;
    if (Array.isArray(audioEndpoints) && audioEndpoints.length > 0) {
      for (const ep of audioEndpoints) {
        const email = (ep.accountEmail || ep["account-email"] || "").trim();
        const url = (ep.genUrl || ep["gen-url"] || "").trim();
        const usage = parseInt(ep.usage, 10) || 0;

        if (email || url) {
          await sql`
            INSERT INTO audio_endpoints (account_email, gen_url, usage, last_reset_month, updated_at)
            VALUES (${email}, ${url}, ${usage}, ${currentMonth}, NOW());
          `;
        }
      }
    }

    // 4. Sync LLM Accounts: Delete current and re-insert or upsert
    await sql`DELETE FROM llm_accounts;`;
    if (Array.isArray(llmAccounts) && llmAccounts.length > 0) {
      for (const acc of llmAccounts) {
        const email = (acc.accountEmail || acc["account-email"] || acc.account_email || "").trim();
        const accountId = (acc.accountId || acc["account-id"] || acc.account_id || "").trim();
        const apiToken = (acc.apiToken || acc["api-token"] || acc.api_token || "").trim();

        if (email || accountId || apiToken) {
          await sql`
            INSERT INTO llm_accounts (account_email, account_id, api_token, created, updated)
            VALUES (${email}, ${accountId}, ${apiToken}, NOW(), NOW());
          `;
        }
      }
    }

    // Fetch fresh state from database
    const refreshedGeneralRows = await sql`
      SELECT 
        id, 
        default_llm_model AS "defaultLlmModel", 
        script_gen_model AS "scriptGenModel", 
        scene_gen_model AS "sceneGenModel", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;

    const refreshedImageRows = await sql`
      SELECT id, account_email AS "accountEmail", gen_url AS "genUrl", usage, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM image_endpoints
      ORDER BY id ASC;
    `;

    const refreshedAudioRows = await sql`
      SELECT id, account_email AS "accountEmail", gen_url AS "genUrl", usage, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM audio_endpoints
      ORDER BY id ASC;
    `;

    const refreshedLlmRows = await sql`
      SELECT id, account_email AS "accountEmail", account_id AS "accountId", api_token AS "apiToken", created, updated
      FROM llm_accounts
      ORDER BY id ASC;
    `;

    return NextResponse.json({
      success: true,
      defaultLlmModel: refreshedGeneralRows && refreshedGeneralRows[0] ? refreshedGeneralRows[0].defaultLlmModel : (defaultLlmModel || "gpt-4o"),
      scriptGenModel: refreshedGeneralRows && refreshedGeneralRows[0] ? refreshedGeneralRows[0].scriptGenModel : (scriptGenModel || "gpt-4o"),
      sceneGenModel: refreshedGeneralRows && refreshedGeneralRows[0] ? refreshedGeneralRows[0].sceneGenModel : (sceneGenModel || "gpt-4o"),
      generalSettings: refreshedGeneralRows && refreshedGeneralRows[0] ? refreshedGeneralRows[0] : null,
      imageEndpoints: refreshedImageRows || [],
      audioEndpoints: refreshedAudioRows || [],
      llmAccounts: refreshedLlmRows || [],
    });
  } catch (error) {
    console.error("Failed to save endpoints to DB:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save endpoints to database" },
      { status: 500 }
    );
  }
}
