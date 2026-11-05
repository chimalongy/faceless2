"use client";

import { useState } from "react";

const CONSISTENT_FIELDS = [
  {
    key: "visualStyle",
    label: "Visual Style",
    placeholder: "Describe the overall visual style...",
  },
  {
    key: "characterIdentity",
    label: "Character Identity",
    placeholder: "Describe the character's fixed identity...",
  },
  {
    key: "wardrobe",
    label: "Wardrobe",
    placeholder: "Describe the character's consistent clothing...",
  },
  {
    key: "colorPalette",
    label: "Color Palette",
    placeholder: "Describe the consistent color palette...",
  },
  {
    key: "rendering",
    label: "Rendering",
    placeholder: "Describe the rendering characteristics...",
  },
  {
    key: "backgroundTreatment",
    label: "Background Treatment",
    placeholder: "Describe the consistent background treatment...",
  },
];

export default function Home() {
  const [consistent, setConsistent] = useState({
    visualStyle: "",
    characterIdentity: "",
    wardrobe: "",
    colorPalette: "",
    rendering: "",
    backgroundTreatment: "",
  });

  const [scene, setScene] = useState("");

  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");

  const [image, setImage] = useState(null);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleConsistentChange(key, value) {
    setConsistent((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleApplyJson() {
    setJsonError("");

    try {
      const parsed = JSON.parse(jsonInput);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setJsonError("JSON must contain an object.");
        return;
      }

      const updated = { ...consistent };

      CONSISTENT_FIELDS.forEach((field) => {
        if (
          Object.prototype.hasOwnProperty.call(parsed, field.key)
        ) {
          const value = parsed[field.key];

          if (typeof value !== "string") {
            setJsonError(
              `"${field.key}" must contain a string value.`
            );
            return;
          }

          updated[field.key] = value;
        }
      });

      setConsistent(updated);
      setShowJsonModal(false);
      setJsonInput("");
      setJsonError("");
    } catch (err) {
      setJsonError("Invalid JSON. Please check the JSON syntax.");
    }
  }

  function buildPrompt() {
    return `VISUAL IDENTITY

Visual Style:
${consistent.visualStyle}

Character Identity:
${consistent.characterIdentity}

Wardrobe:
${consistent.wardrobe}

Color Palette:
${consistent.colorPalette}

Rendering:
${consistent.rendering}

Background Treatment:
${consistent.backgroundTreatment}


SCENE

${scene}


IMAGE GENERATION INSTRUCTIONS

Create a single coherent cinematic image.

Preserve all visual identity characteristics consistently.
Do not change the character's physical identity or wardrobe unless explicitly instructed.

Maintain the specified visual style, rendering characteristics,
color palette and background treatment.

Follow the scene description exactly, including the environment,
characters, actions, objects, composition, camera viewpoint,
lighting and mood.

The image should look like part of the same visual production
as other scenes using this visual identity.`;
  }

  async function generateImage() {
    setLoading(true);
    setError("");
    setImage(null);

    const prompt = buildPrompt();

    setFinalPrompt(prompt);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          width: 1376,
          height: 768,
          num_inference_steps: 8,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Image generation failed."
        );
      }

      if (!data.image_base64) {
        throw new Error("The API did not return an image.");
      }

      setImage(`data:image/png;base64,${data.image_base64}`);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setConsistent({
      visualStyle: "",
      characterIdentity: "",
      wardrobe: "",
      colorPalette: "",
      rendering: "",
      backgroundTreatment: "",
    });

    setScene("");
    setImage(null);
    setFinalPrompt("");
    setError("");
    setJsonInput("");
    setJsonError("");
  }

  return (
    <main className="min-h-screen bg-[#0b0d10] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-8">

        {/* HEADER */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              AI Image Generator
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              Keep your visual identity consistent while changing
              the scene for every image.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowJsonModal(true)}
              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
            >
              Upload JSON
            </button>

            <button
              onClick={clearAll}
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800"
            >
              Clear
            </button>
          </div>
        </div>

        {/* MAIN EDITOR */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          {/* KEEP CONSISTENT */}
          <section className="rounded-xl border border-gray-800 bg-[#111418] p-6">

            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Keep Consistent
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                These characteristics remain consistent across
                your generated scenes.
              </p>
            </div>

            <div className="space-y-5">

              {CONSISTENT_FIELDS.map((field) => (
                <div key={field.key}>

                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    {field.label}
                  </label>

                  <textarea
                    value={consistent[field.key]}
                    onChange={(e) =>
                      handleConsistentChange(
                        field.key,
                        e.target.value
                      )
                    }
                    placeholder={field.placeholder}
                    rows={4}
                    className="w-full resize-y rounded-lg border border-gray-700 bg-[#0b0d10] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-blue-500"
                  />

                </div>
              ))}

            </div>
          </section>

          {/* SCENE */}
          <section className="rounded-xl border border-gray-800 bg-[#111418] p-6">

            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Scene
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Everything that changes from scene to scene goes
                here.
              </p>
            </div>

            <textarea
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              placeholder={`Describe the entire scene here.

Example:

A young man is sitting alone at a small wooden desk in a dark apartment at night. Several unpaid bills are scattered across the desk. He looks worried while staring at his laptop.

The apartment is dimly lit by a warm desk lamp. The camera is positioned slightly above and in front of him. Medium cinematic shot. The background contains a small sofa and apartment windows showing the city lights outside.

Cinematic composition, emotional mood, shallow depth of field.`}
              className="min-h-[600px] w-full resize-y rounded-lg border border-gray-700 bg-[#0b0d10] px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-gray-600 focus:border-blue-500"
            />

            <button
              onClick={generateImage}
              disabled={loading || !scene.trim()}
              className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Generating Image..." : "Generate Image"}
            </button>

          </section>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* GENERATED IMAGE */}
        {image && (
          <section className="mt-8 rounded-xl border border-gray-800 bg-[#111418] p-6">

            <h2 className="mb-4 text-xl font-semibold">
              Generated Image
            </h2>

            <div className="overflow-hidden rounded-lg border border-gray-800 bg-black">
              <img
                src={image}
                alt="Generated scene"
                className="w-full"
              />
            </div>

          </section>
        )}

        {/* FINAL PROMPT */}
        {finalPrompt && (
          <section className="mt-6 rounded-xl border border-gray-800 bg-[#111418] p-6">

            <h2 className="mb-4 text-xl font-semibold">
              Final Prompt
            </h2>

            <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-[#0b0d10] p-5 text-sm leading-6 text-gray-300">
              {finalPrompt}
            </pre>

          </section>
        )}

      </div>

      {/* JSON MODAL */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">

          <div className="w-full max-w-3xl rounded-xl border border-gray-700 bg-[#111418] shadow-2xl">

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">

              <div>
                <h2 className="text-lg font-semibold">
                  Import Consistent Visual Identity
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Paste your JSON below to populate the
                  Keep Consistent fields.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowJsonModal(false);
                  setJsonError("");
                }}
                className="text-xl text-gray-500 hover:text-white"
              >
                ×
              </button>

            </div>

            {/* MODAL BODY */}
            <div className="p-6">

              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setJsonError("");
                }}
                placeholder={`{
  "visualStyle": "Cinematic 2D animated illustration",
  "characterIdentity": "30-year-old Black man, short hair, slim build",
  "wardrobe": "Dark blue hoodie, black jeans, white sneakers",
  "colorPalette": "Deep blue, warm orange, muted gray",
  "rendering": "High-detail digital illustration, soft shading",
  "backgroundTreatment": "Clean cinematic backgrounds with subtle depth of field"
}`}
                className="min-h-[400px] w-full resize-y rounded-lg border border-gray-700 bg-[#0b0d10] px-4 py-4 font-mono text-sm leading-6 text-white outline-none placeholder:text-gray-700 focus:border-blue-500"
              />

              {/* JSON ERROR */}
              {jsonError && (
                <div className="mt-3 rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                  {jsonError}
                </div>
              )}

              {/* MODAL ACTIONS */}
              <div className="mt-5 flex justify-end gap-3">

                <button
                  onClick={() => {
                    setShowJsonModal(false);
                    setJsonError("");
                  }}
                  className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>

                <button
                  onClick={handleApplyJson}
                  disabled={!jsonInput.trim()}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply JSON
                </button>

              </div>

            </div>

          </div>
        </div>
      )}

    </main>
  );
}