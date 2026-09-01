import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/settings/endpoints - Read all general settings, endpoints, and LLM accounts from Neon DB
export async function GET() {
  try {
    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({
        defaultLlmSource: "gemini",
        defaultLlmModel: "gemini-2.5-flash",
        scriptGenSource: "gemini",
        scriptGenStrictSource: false,
        scriptGenModel: "gemini-2.5-flash",
        scriptGenStrictModel: false,
        sceneGenSource: "gemini",
        sceneGenStrictSource: false,
        sceneGenModel: "gemini-2.5-flash",
        sceneGenStrictModel: false,
        gemmaBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
        openRouterBaseUrl: "https://openrouter.ai/api/v1",
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
        default_llm_source AS "defaultLlmSource",
        default_llm_model AS "defaultLlmModel", 
        script_gen_source AS "scriptGenSource",
        script_gen_strict_source AS "scriptGenStrictSource",
        script_gen_model AS "scriptGenModel", 
        script_gen_strict_model AS "scriptGenStrictModel",
        scene_gen_source AS "sceneGenSource",
        scene_gen_strict_source AS "sceneGenStrictSource",
        scene_gen_model AS "sceneGenModel", 
        scene_gen_strict_model AS "sceneGenStrictModel",
        gemma_base_url AS "gemmaBaseUrl",
        open_router_base_url AS "openRouterBaseUrl",
        modal_video_render_url AS "modalVideoRenderUrl",
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
      SELECT id, account_email AS "accountEmail", source, account_id AS "accountId", api_token AS "apiToken", created, updated
      FROM llm_accounts
      ORDER BY id ASC;
    `;

    const generalData = generalRows?.[0] || {};
    const defaultLlmSource = generalData.defaultLlmSource || "gemini";
    const defaultLlmModel = generalData.defaultLlmModel || "gemini-2.5-flash";

    const scriptGenSource = generalData.scriptGenSource || defaultLlmSource;
    const scriptGenStrictSource = Boolean(generalData.scriptGenStrictSource);
    const scriptGenModel = generalData.scriptGenModel || defaultLlmModel;
    const scriptGenStrictModel = Boolean(generalData.scriptGenStrictModel);

    const sceneGenSource = generalData.sceneGenSource || defaultLlmSource;
    const sceneGenStrictSource = Boolean(generalData.sceneGenStrictSource);
    const sceneGenModel = generalData.sceneGenModel || defaultLlmModel;
    const sceneGenStrictModel = Boolean(generalData.sceneGenStrictModel);

    const gemmaBaseUrl = generalData.gemmaBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/";
    const openRouterBaseUrl = generalData.openRouterBaseUrl || "https://openrouter.ai/api/v1";
    const modalVideoRenderUrl = generalData.modalVideoRenderUrl || process.env.MODAL_RENDERER_API_URL || "https://me-chimaobi--faceless-video-renderer-api.modal.run";

    return NextResponse.json({
      success: true,
      dbConnected: true,
      defaultLlmSource,
      defaultLlmModel,
      scriptGenSource,
      scriptGenStrictSource,
      scriptGenModel,
      scriptGenStrictModel,
      sceneGenSource,
      sceneGenStrictSource,
      sceneGenModel,
      sceneGenStrictModel,
      gemmaBaseUrl,
      openRouterBaseUrl,
      modalVideoRenderUrl,
      generalSettings: generalData,
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
    const {
      imageEndpoints = [],
      audioEndpoints = [],
      llmAccounts = [],
      defaultLlmSource = "gemini",
      defaultLlmModel = "gemini-2.5-flash",
      scriptGenSource = "gemini",
      scriptGenStrictSource = false,
      scriptGenModel = "gemini-2.5-flash",
      scriptGenStrictModel = false,
      sceneGenSource = "gemini",
      sceneGenStrictSource = false,
      sceneGenModel = "gemini-2.5-flash",
      sceneGenStrictModel = false,
      gemmaBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/",
      openRouterBaseUrl = "https://openrouter.ai/api/v1",
      modalVideoRenderUrl = "https://me-chimaobi--faceless-video-renderer-api.modal.run",
    } = body;

    // 1. Sync General Settings
    const defSource = (defaultLlmSource || "gemini").trim();
    const defModel = (defaultLlmModel || "gemini-2.5-flash").trim();

    const scrSource = (scriptGenSource || defSource).trim();
    const isScrStrictSource = Boolean(scriptGenStrictSource);
    const scrModel = (scriptGenModel || defModel).trim();
    const isScrStrictModel = Boolean(scriptGenStrictModel);

    const scnSource = (sceneGenSource || defSource).trim();
    const isScnStrictSource = Boolean(sceneGenStrictSource);
    const scnModel = (sceneGenModel || defModel).trim();
    const isScnStrictModel = Boolean(sceneGenStrictModel);

    const gemmaUrl = (gemmaBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/").trim();
    const openRouterUrl = (openRouterBaseUrl || "https://openrouter.ai/api/v1").trim();
    const modalRenderUrl = (modalVideoRenderUrl || process.env.MODAL_RENDERER_API_URL || "https://me-chimaobi--faceless-video-renderer-api.modal.run").trim();

    const existing = await sql`SELECT id FROM general_settings LIMIT 1;`;
    if (existing && existing.length > 0) {
      await sql`
        UPDATE general_settings 
        SET 
          default_llm_source = ${defSource},
          default_llm_model = ${defModel}, 
          script_gen_source = ${scrSource},
          script_gen_strict_source = ${isScrStrictSource},
          script_gen_model = ${scrModel}, 
          script_gen_strict_model = ${isScrStrictModel},
          scene_gen_source = ${scnSource},
          scene_gen_strict_source = ${isScnStrictSource},
          scene_gen_model = ${scnModel}, 
          scene_gen_strict_model = ${isScnStrictModel},
          gemma_base_url = ${gemmaUrl},
          open_router_base_url = ${openRouterUrl},
          modal_video_render_url = ${modalRenderUrl},
          updated_at = NOW()
        WHERE id = ${existing[0].id};
      `;
    } else {
      await sql`
        INSERT INTO general_settings (
          default_llm_source,
          default_llm_model,
          script_gen_source,
          script_gen_strict_source,
          script_gen_model,
          script_gen_strict_model,
          scene_gen_source,
          scene_gen_strict_source,
          scene_gen_model,
          scene_gen_strict_model,
          gemma_base_url,
          open_router_base_url,
          modal_video_render_url,
          created_at,
          updated_at
        )
        VALUES (
          ${defSource},
          ${defModel},
          ${scrSource},
          ${isScrStrictSource},
          ${scrModel},
          ${isScrStrictModel},
          ${scnSource},
          ${isScnStrictSource},
          ${scnModel},
          ${isScnStrictModel},
          ${gemmaUrl},
          ${openRouterUrl},
          ${modalRenderUrl},
          NOW(),
          NOW()
        );
      `;
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

    // 4. Sync LLM Accounts: Delete current and re-insert
    await sql`DELETE FROM llm_accounts;`;
    if (Array.isArray(llmAccounts) && llmAccounts.length > 0) {
      for (const acc of llmAccounts) {
        const email = (acc.accountEmail || acc["account-email"] || acc.account_email || "").trim();
        const source = (acc.source || "gemini").trim();
        const accountId = (acc.accountId || acc["account-id"] || acc.account_id || "").trim();
        const apiToken = (acc.apiToken || acc["api-token"] || acc.api_token || "").trim();

        if (email || apiToken) {
          await sql`
            INSERT INTO llm_accounts (account_email, source, account_id, api_token, created, updated)
            VALUES (${email}, ${source}, ${accountId}, ${apiToken}, NOW(), NOW());
          `;
        }
      }
    }

    // Fetch fresh state from database
    const refreshedGeneralRows = await sql`
      SELECT 
        id, 
        default_llm_source AS "defaultLlmSource",
        default_llm_model AS "defaultLlmModel", 
        script_gen_source AS "scriptGenSource",
        script_gen_strict_source AS "scriptGenStrictSource",
        script_gen_model AS "scriptGenModel", 
        script_gen_strict_model AS "scriptGenStrictModel",
        scene_gen_source AS "sceneGenSource",
        scene_gen_strict_source AS "sceneGenStrictSource",
        scene_gen_model AS "sceneGenModel", 
        scene_gen_strict_model AS "sceneGenStrictModel",
        gemma_base_url AS "gemmaBaseUrl",
        open_router_base_url AS "openRouterBaseUrl",
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
      SELECT id, account_email AS "accountEmail", source, account_id AS "accountId", api_token AS "apiToken", created, updated
      FROM llm_accounts
      ORDER BY id ASC;
    `;

    const refreshedGen = refreshedGeneralRows?.[0] || {};

    return NextResponse.json({
      success: true,
      defaultLlmSource: refreshedGen.defaultLlmSource || defSource,
      defaultLlmModel: refreshedGen.defaultLlmModel || defModel,
      scriptGenSource: refreshedGen.scriptGenSource || scrSource,
      scriptGenStrictSource: Boolean(refreshedGen.scriptGenStrictSource),
      scriptGenModel: refreshedGen.scriptGenModel || scrModel,
      scriptGenStrictModel: Boolean(refreshedGen.scriptGenStrictModel),
      sceneGenSource: refreshedGen.sceneGenSource || scnSource,
      sceneGenStrictSource: Boolean(refreshedGen.sceneGenStrictSource),
      sceneGenModel: refreshedGen.sceneGenModel || scnModel,
      sceneGenStrictModel: Boolean(refreshedGen.sceneGenStrictModel),
      gemmaBaseUrl: refreshedGen.gemmaBaseUrl || gemmaUrl,
      openRouterBaseUrl: refreshedGen.openRouterBaseUrl || openRouterUrl,
      generalSettings: refreshedGen,
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
