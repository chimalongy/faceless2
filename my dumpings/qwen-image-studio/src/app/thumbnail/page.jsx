"use client";

import { useState } from "react";

const DEFAULT_THUMBNAIL_DATA = {
  // Image Theme / Keep Consistent
  visualStyle: "",
  characterIdentity: "",
  wardrobe: "",
  colorPalette: "",
  rendering: "",
  backgroundTreatment: "",

  // Thumbnail Details
  subject: "",
  expression: "",
  action: "",
  composition: "",
  lighting: "",
  thumbnailText: "",
};

export default function ThumbnailPage() {
  const [data, setData] = useState(DEFAULT_THUMBNAIL_DATA);

  const [jsonInput, setJsonInput] = useState("");
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonError, setJsonError] = useState("");

  const [steps, setSteps] = useState(50);
  const [guidanceScale, setGuidanceScale] = useState(4);
  const [seed, setSeed] = useState(42);

  const [image, setImage] = useState(null);
  const [prompt, setPrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field, value) {
    setData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function applyJson() {
    setJsonError("");

    try {
      const parsed = JSON.parse(jsonInput);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("JSON must contain an object.");
      }

      const nextData = {
        ...DEFAULT_THUMBNAIL_DATA,
      };

      // -----------------------------------------
      // IMAGE THEME / KEEP CONSISTENT
      // -----------------------------------------

      if (typeof parsed.visualStyle === "string") {
        nextData.visualStyle = parsed.visualStyle;
      }

      if (typeof parsed.characterIdentity === "string") {
        nextData.characterIdentity =
          parsed.characterIdentity;
      }

      if (typeof parsed.wardrobe === "string") {
        nextData.wardrobe = parsed.wardrobe;
      }

      if (typeof parsed.colorPalette === "string") {
        nextData.colorPalette = parsed.colorPalette;
      }

      if (typeof parsed.rendering === "string") {
        nextData.rendering = parsed.rendering;
      }

      if (
        typeof parsed.backgroundTreatment === "string"
      ) {
        nextData.backgroundTreatment =
          parsed.backgroundTreatment;
      }

      // -----------------------------------------
      // THUMBNAIL DETAILS
      // -----------------------------------------

      if (typeof parsed.subject === "string") {
        nextData.subject = parsed.subject;
      } else if (
        parsed.subject &&
        typeof parsed.subject === "object"
      ) {
        nextData.subject =
          parsed.subject.description || "";

        if (parsed.subject.expression) {
          nextData.expression =
            parsed.subject.expression;
        }

        if (parsed.subject.action) {
          nextData.action =
            parsed.subject.action;
        }

        if (parsed.subject.wardrobe) {
          nextData.wardrobe =
            parsed.subject.wardrobe;
        }
      }

      if (typeof parsed.expression === "string") {
        nextData.expression =
          parsed.expression;
      }

      if (typeof parsed.action === "string") {
        nextData.action =
          parsed.action;
      }

      if (typeof parsed.composition === "string") {
        nextData.composition =
          parsed.composition;
      } else if (
        parsed.composition &&
        typeof parsed.composition === "object"
      ) {
        const compositionParts = [];

        if (parsed.composition.camera) {
          compositionParts.push(
            `Camera: ${parsed.composition.camera}`
          );
        }

        if (parsed.composition.subjectPosition) {
          compositionParts.push(
            `Subject Position: ${parsed.composition.subjectPosition}`
          );
        }

        if (parsed.composition.focalPoint) {
          compositionParts.push(
            `Focal Point: ${parsed.composition.focalPoint}`
          );
        }

        if (parsed.composition.framing) {
          compositionParts.push(
            `Framing: ${parsed.composition.framing}`
          );
        }

        nextData.composition =
          compositionParts.join("\n");
      }

      if (typeof parsed.lighting === "string") {
        nextData.lighting =
          parsed.lighting;
      } else if (
        parsed.lighting &&
        typeof parsed.lighting === "object"
      ) {
        const lightingParts = [];

        Object.entries(parsed.lighting).forEach(
          ([key, value]) => {
            if (value) {
              const label = key
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (char) =>
                  char.toUpperCase()
                );

              lightingParts.push(
                `${label}: ${value}`
              );
            }
          }
        );

        nextData.lighting =
          lightingParts.join("\n");
      }

      if (
        typeof parsed.thumbnailText === "string"
      ) {
        nextData.thumbnailText =
          parsed.thumbnailText;
      }

      // -----------------------------------------
      // APPLY
      // -----------------------------------------

      setData(nextData);

      setShowJsonModal(false);
      setJsonInput("");
      setJsonError("");

    } catch (err) {
      setJsonError(
        err.message || "Invalid JSON."
      );
    }
  }

  function buildPrompt() {
    return `
IMAGE THEME / KEEP CONSISTENT

Visual Style:
${data.visualStyle}

Character Identity:
${data.characterIdentity}

Wardrobe:
${data.wardrobe}

Color Palette:
${data.colorPalette}

Rendering:
${data.rendering}

Background Treatment:
${data.backgroundTreatment}


THUMBNAIL DETAILS

Main Subject:
${data.subject}

Expression / Emotion:
${data.expression}

Action:
${data.action}

Composition:
${data.composition}

Lighting:
${data.lighting}


THUMBNAIL CONCEPT

Create a highly compelling YouTube thumbnail based on
the visual identity and thumbnail details above.

The image must preserve the established visual identity
from the Image Theme / Keep Consistent section.

The thumbnail should communicate the concept immediately
and create strong curiosity.

The main subject should be visually dominant and easy to
understand at a small thumbnail size.

Use strong facial expressions, readable body language,
clear visual hierarchy, and strong subject/background
separation.

Do not introduce unrelated characters, objects, styles,
colors, or visual elements that conflict with the
established image theme.


THUMBNAIL TEXT

${data.thumbnailText}


FINAL GENERATION INSTRUCTIONS

Create a polished, high-impact YouTube thumbnail.

Prioritize:

- Immediate visual comprehension
- Strong emotional impact
- Clear focal point
- Strong subject separation
- Dramatic composition
- Curiosity
- Professional visual hierarchy
- High visual quality
- Clean readable shapes
- Cinematic presentation
- Consistency with the Image Theme
- Consistency with Character Identity
- Consistency with Wardrobe
- Consistency with Color Palette
- Consistency with Rendering
- Consistency with Background Treatment

The image should look like a professionally art-directed
YouTube thumbnail.

Do not produce a generic stock-image appearance.
Do not introduce unrelated objects or concepts.
Do not turn the image into a normal wide cinematic scene.
Do not sacrifice character consistency for thumbnail effects.
`.trim();
  }

  async function generateThumbnail() {
    setLoading(true);
    setError("");
    setImage(null);

    const finalPrompt = buildPrompt();

    setPrompt(finalPrompt);

    try {
      const response = await fetch(
        "/api/generate-thumbnail",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: finalPrompt,
            width: 1664,
            height: 928,
            num_inference_steps: Number(steps),
            guidance_scale:
              Number(guidanceScale),
            seed: Number(seed),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Thumbnail generation failed."
        );
      }

      if (!result.image_base64) {
        throw new Error(
          "The generation endpoint did not return an image."
        );
      }

      setImage(
        `data:image/png;base64,${result.image_base64}`
      );

    } catch (err) {
      setError(
        err.message ||
          "Unable to generate thumbnail."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setData(DEFAULT_THUMBNAIL_DATA);
    setImage(null);
    setPrompt("");
    setError("");
    setJsonInput("");
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="mx-auto max-w-[1800px] px-6 py-8">

        {/* HEADER */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Thumbnail Studio
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              Generate high-impact YouTube thumbnails
              while preserving your established image theme.
            </p>
          </div>

          <button
            onClick={() => {
              setShowJsonModal(true);
              setJsonError("");
            }}
            className="rounded-lg border border-gray-700 bg-[#151519] px-4 py-2 text-sm font-medium hover:bg-[#1d1d23]"
          >
            Upload JSON
          </button>
        </div>


        {/* MAIN GRID */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          {/* ================================================== */}
          {/* LEFT COLUMN */}
          {/* ================================================== */}

          <section className="space-y-6">

            {/* IMAGE THEME */}
            <div className="rounded-xl border border-gray-800 bg-[#111114] p-6">

              <div className="mb-5">
                <h2 className="text-xl font-semibold">
                  Image Theme
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Keep Consistent
                </p>
              </div>

              <div className="space-y-5">

                <Field
                  label="Visual Style"
                  value={data.visualStyle}
                  onChange={(value) =>
                    updateField(
                      "visualStyle",
                      value
                    )
                  }
                  placeholder="Describe the overall visual art style..."
                />

                <Field
                  label="Character Identity"
                  value={data.characterIdentity}
                  onChange={(value) =>
                    updateField(
                      "characterIdentity",
                      value
                    )
                  }
                  placeholder="Describe the recurring character identity..."
                />

                <Field
                  label="Wardrobe"
                  value={data.wardrobe}
                  onChange={(value) =>
                    updateField(
                      "wardrobe",
                      value
                    )
                  }
                  placeholder="Describe clothing, colors and accessories..."
                />

                <Field
                  label="Color Palette"
                  value={data.colorPalette}
                  onChange={(value) =>
                    updateField(
                      "colorPalette",
                      value
                    )
                  }
                  placeholder="Describe the recurring color palette..."
                />

                <Field
                  label="Rendering"
                  value={data.rendering}
                  onChange={(value) =>
                    updateField(
                      "rendering",
                      value
                    )
                  }
                  placeholder="Describe rendering, shading, linework, textures..."
                />

                <Field
                  label="Background Treatment"
                  value={data.backgroundTreatment}
                  onChange={(value) =>
                    updateField(
                      "backgroundTreatment",
                      value
                    )
                  }
                  placeholder="Describe how backgrounds should be treated..."
                />

              </div>
            </div>


            {/* THUMBNAIL DETAILS */}
            <div className="rounded-xl border border-gray-800 bg-[#111114] p-6">

              <div className="mb-5">
                <h2 className="text-xl font-semibold">
                  Thumbnail Details
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Details specific to this thumbnail
                </p>
              </div>

              <div className="space-y-5">

                <Field
                  label="Main Subject"
                  value={data.subject}
                  onChange={(value) =>
                    updateField(
                      "subject",
                      value
                    )
                  }
                  placeholder="What is the main subject of the thumbnail?"
                />

                <Field
                  label="Expression / Emotion"
                  value={data.expression}
                  onChange={(value) =>
                    updateField(
                      "expression",
                      value
                    )
                  }
                  placeholder="Describe the emotion and facial expression..."
                />

                <Field
                  label="Action"
                  value={data.action}
                  onChange={(value) =>
                    updateField(
                      "action",
                      value
                    )
                  }
                  placeholder="Describe what the subject is doing..."
                />

                <Field
                  label="Composition"
                  value={data.composition}
                  onChange={(value) =>
                    updateField(
                      "composition",
                      value
                    )
                  }
                  placeholder="Describe camera angle, framing, subject position and focal point..."
                />

                <Field
                  label="Lighting"
                  value={data.lighting}
                  onChange={(value) =>
                    updateField(
                      "lighting",
                      value
                    )
                  }
                  placeholder="Describe the lighting and contrast..."
                />

                <Field
                  label="Thumbnail Text"
                  value={data.thumbnailText}
                  onChange={(value) =>
                    updateField(
                      "thumbnailText",
                      value
                    )
                  }
                  placeholder="Optional text that should appear in the thumbnail..."
                />

              </div>
            </div>


            {/* GENERATION SETTINGS */}
            <div className="rounded-xl border border-gray-800 bg-[#111114] p-6">

              <h2 className="mb-5 text-xl font-semibold">
                Generation Settings
              </h2>

              <div className="grid grid-cols-3 gap-4">

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Steps
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={steps}
                    onChange={(e) =>
                      setSteps(e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-700 bg-[#18181c] px-3 py-2 outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Guidance
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    value={guidanceScale}
                    onChange={(e) =>
                      setGuidanceScale(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-700 bg-[#18181c] px-3 py-2 outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Seed
                  </label>

                  <input
                    type="number"
                    value={seed}
                    onChange={(e) =>
                      setSeed(e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-700 bg-[#18181c] px-3 py-2 outline-none focus:border-gray-500"
                  />
                </div>

              </div>
            </div>


            {/* ACTIONS */}
            <div className="flex gap-3">

              <button
                onClick={generateThumbnail}
                disabled={loading}
                className="flex-1 rounded-lg bg-white px-5 py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Generating Thumbnail..."
                  : "Generate Thumbnail"}
              </button>

              <button
                onClick={clearAll}
                disabled={loading}
                className="rounded-lg border border-gray-700 px-5 py-3 text-sm text-gray-300 hover:bg-[#151519]"
              >
                Clear
              </button>

            </div>

          </section>


          {/* ================================================== */}
          {/* RIGHT COLUMN */}
          {/* ================================================== */}

          <section className="space-y-6">

            {/* IMAGE PREVIEW */}
            <div className="rounded-xl border border-gray-800 bg-[#111114] p-6">

              <div className="mb-4 flex items-center justify-between">

                <div>
                  <h2 className="text-xl font-semibold">
                    Generated Thumbnail
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    1664 × 928
                  </p>
                </div>

              </div>

              <div className="flex min-h-[500px] items-center justify-center rounded-lg border border-gray-800 bg-black">

                {loading ? (
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-white" />

                    <p className="text-sm text-gray-400">
                      Generating thumbnail...
                    </p>
                  </div>
                ) : image ? (
                  <img
                    src={image}
                    alt="Generated thumbnail"
                    className="max-h-[700px] w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="text-center text-gray-600">
                    <p className="text-lg">
                      No thumbnail generated
                    </p>

                    <p className="mt-2 text-sm">
                      Configure the image theme and
                      thumbnail details, then generate.
                    </p>
                  </div>
                )}

              </div>
            </div>


            {/* FINAL PROMPT */}
            {prompt && (
              <div className="rounded-xl border border-gray-800 bg-[#111114] p-6">

                <div className="mb-4 flex items-center justify-between">

                  <h2 className="text-xl font-semibold">
                    Final Prompt
                  </h2>

                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        prompt
                      )
                    }
                    className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#18181c]"
                  >
                    Copy
                  </button>

                </div>

                <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-black p-4 text-sm leading-6 text-gray-400">
                  {prompt}
                </pre>

              </div>
            )}

            {/* ERROR */}
            {error && (
              <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

          </section>

        </div>
      </div>


      {/* ====================================================== */}
      {/* JSON MODAL */}
      {/* ====================================================== */}

      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">

          <div className="w-full max-w-3xl rounded-xl border border-gray-800 bg-[#111114] shadow-2xl">

            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">

              <div>
                <h2 className="text-lg font-semibold">
                  Upload Image Theme & Thumbnail JSON
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Paste your JSON below. The fields will be
                  automatically populated.
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


            <div className="p-6">

              <textarea
                value={jsonInput}
                onChange={(e) =>
                  setJsonInput(e.target.value)
                }
                placeholder={`{
  "visualStyle": "...",
  "characterIdentity": "...",
  "wardrobe": "...",
  "colorPalette": "...",
  "rendering": "...",
  "backgroundTreatment": "...",

  "subject": "...",
  "expression": "...",
  "action": "...",
  "composition": "...",
  "lighting": "...",
  "thumbnailText": "..."
}`}
                className="h-[450px] w-full resize-none rounded-lg border border-gray-700 bg-black p-4 font-mono text-sm text-gray-300 outline-none focus:border-gray-500"
              />

              {jsonError && (
                <div className="mt-3 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
                  {jsonError}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-3">

                <button
                  onClick={() => {
                    setShowJsonModal(false);
                    setJsonError("");
                  }}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-[#18181c]"
                >
                  Cancel
                </button>

                <button
                  onClick={applyJson}
                  className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-200"
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


/* ============================================================
   FIELD COMPONENT
============================================================ */

function Field({
  label,
  value,
  onChange,
  placeholder,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-lg border border-gray-700 bg-[#18181c] px-4 py-3 text-sm text-gray-200 outline-none placeholder:text-gray-600 focus:border-gray-500"
      />
    </div>
  );
}