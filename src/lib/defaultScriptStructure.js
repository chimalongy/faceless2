export const DEFAULT_SCRIPT_STRUCTURE = Object.freeze({
  tone_and_voice:
    "Engaging, confident, excitedly, and authoritatively. Spoken directly to the listener with clarity and strong forward momentum.",
  hook_instructions:
    "Start immediately with a bold, high-stakes statement, shocking paradox, question or counterintuitive reality. Zero generic greetings, zero 'welcome back', zero throat-clearing.",
  content_flow: [
    "1. Hook: Grab immediate attention by challenging an assumption or revealing an alarming truth or and interesting question relating to the topic to be discussed.",
    "2. Core Concept: Clearly introduce the central question or mechanism without stalling.",
    "3. In-Depth Breakdown: Deliver the meat of the story or analysis with compelling, concrete examples and vivid explanations.",
    "4. The Critical Twist: Introduce the counterintuitive consequence, hidden angle, or major turning point.",
    "5. Lasting Takeaway: Close with a strong, thought-provoking realization that reframes the topic for the viewer.",
  ],
  retention_rules: [
    "Every section must introduce a fresh insight or revelation to pull the listener forward.",
    "Explain complex mechanisms with simple, tangible real-world analogies.",
    "Keep momentum high—never repeat points or summarize what was already stated.",
  ],
  banned_phrases: [
    "In today's fast-paced world",
    "Let's dive in",
    "Without further ado",
    "It is important to remember",
    "Throughout human history",
    "Imagine standing on a hill",
    "As we all know",
  ],
});

export const SCRIPT_STRUCTURE_PRESETS = Object.freeze([
  {
    id: "engaging_storytelling",
    name: "Engaging Storytelling",
    description:
      "High-retention spoken narrative flow with strong hooks, escalating curiosity, and lasting payoff.",
    structure: DEFAULT_SCRIPT_STRUCTURE,
  },
  {
    id: "deep_dive_breakdown",
    name: "Deep-Dive Breakdown",
    description:
      "Forensic and analytical spoken structure tracing hidden mechanics, evidence, and systemic insights.",
    structure: {
      tone_and_voice:
        "Analytical, sharp, objective, and investigative. Direct and fact-driven.",
      hook_instructions:
        "Open with a shocking statistic, an overlooked anomaly, or a pivotal contradiction in the first 10 seconds.",
      content_flow: [
        "1. The Anomaly: Present the contradiction or hidden question everyone overlooked.",
        "2. The Underlying System: Unpack the machinery, incentives, and key players step-by-step.",
        "3. Concrete Evidence: Walk through real-world case studies, data points, or documented events.",
        "4. The Ripple Effect: Highlight the unintended consequences and how it directly affects people.",
        "5. The Verdict: Deliver a clear, evidence-backed conclusion that changes how the viewer understands the system.",
      ],
      pacing_and_delivery: {
        sentence_variety:
          "Crisp, rhythmic, evidentiary beats. Move cleanly from observation to revelation.",
      },
      retention_rules: [
        "State the conflict clearly before diving into the data.",
        "Ground every claim in concrete realities rather than abstract speculation.",
      ],
      banned_phrases: [
        "In a world where",
        "It goes without saying",
        "At the end of the day",
        "Only time will tell",
        "Needless to say",
      ],
    },
  },
  {
    id: "fast_paced_explainer",
    name: "Fast-Paced Explainer",
    description:
      "Quick, punchy breakdown making complex concepts instantly understandable with high energy.",
    structure: {
      tone_and_voice:
        "Energetic, clear, conversational, and direct. Enthusiastic without being juvenile.",
      hook_instructions:
        "Drop the viewer right into the most bizarre, fascinating, or urgent aspect of the topic immediately.",
      content_flow: [
        "1. Instant Hook: What makes this crazy, urgent, or counterintuitive right now.",
        "2. The Core Mechanism: How it works in plain, simple English.",
        "3. Surprising Nuances: The lesser-known facts, edge cases, or common misconceptions.",
        "4. Real-World Impact: Why this matters to the viewer today.",
        "5. Wrap-Up: A memorable closing line that leaves a strong impression.",
      ],
      pacing_and_delivery: {
        sentence_variety:
          "Fast, energetic, punchy sentences. High density of information.",
      },
      retention_rules: [
        "Strip all unnecessary jargon and filler.",
        "Use memorable analogies that explain mechanisms in 5 seconds.",
      ],
      banned_phrases: [
        "Science is fascinating",
        "As we can see",
        "Believe it or not",
        "In summary",
        "To put it simply",
      ],
    },
  },
]);

// Legacy field names that map onto a canonical field. First match wins.
const FIELD_ALIASES = {
  tone_and_voice: ["tone_and_voice", "narrative_style"],
  hook_instructions: ["hook_instructions", "hook_formula"],
};

/**
 * Fields that are recognized by the schema but deliberately excluded from
 * the rendered "custom keys" catch-all — because either they're rendered
 * elsewhere (via FIELD_ALIASES) or they're deprecated/unused on purpose.
 * Keeping this list explicit (rather than folding silently into
 * recognizedKeys) makes it clear these are intentional omissions, not bugs.
 */
const INTENTIONALLY_UNRENDERED_KEYS = new Set([
  "curiosity_loops", // reserved for future use; not yet mapped to a section
  "act_structure", // deprecated legacy key from an older schema version
]);

// Keys inside pacing_and_delivery that are tracked for other purposes
// (e.g. consumed by a script-generation step directly) rather than
// rendered as a bullet in this directive block.
const PACING_KEYS_TO_SKIP = new Set(["paragraph_length", "voice"]);

function pickAliasedValue(structure, canonicalKey) {
  const aliases = FIELD_ALIASES[canonicalKey] || [canonicalKey];
  for (const alias of aliases) {
    if (structure[alias]) return structure[alias];
  }
  return undefined;
}

function renderContentFlow(content_flow) {
  if (!Array.isArray(content_flow) || content_flow.length === 0) return null;
  const flow = content_flow
    .map(
      (item) =>
        `- ${typeof item === "object" ? JSON.stringify(item) : String(item).trim()}`,
    )
    .join("\n");
  return `Deliver the narration following this progression of ideas:\n${flow}`;
}

function renderPacingAndDelivery(pacing_and_delivery) {
  if (!pacing_and_delivery || typeof pacing_and_delivery !== "object")
    return null;
  const rules = Object.entries(pacing_and_delivery)
    .filter(
      ([key, value]) =>
        !PACING_KEYS_TO_SKIP.has(key) &&
        value != null &&
        String(value).trim() !== "",
    )
    .map(
      ([key, value]) =>
        `- **${key.replace(/_/g, " ").toUpperCase()}**: ${value}`,
    )
    .join("\n");
  return rules.trim() ? rules : null;
}

function renderBulletList(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const cleaned = items.map((item) => String(item).trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  return cleaned.map((item) => `- ${item}`).join("\n");
}

function renderBannedPhrases(banned_phrases) {
  if (!Array.isArray(banned_phrases) || banned_phrases.length === 0)
    return null;
  // De-dupe (case-insensitive) while preserving original casing of first occurrence.
  const seen = new Set();
  const cleaned = [];
  for (const phrase of banned_phrases) {
    const trimmed = String(phrase).trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
  }
  if (cleaned.length === 0) return null;
  const list = cleaned.map((p) => `"${p}"`).join(", ");
  return `DO NOT USE ANY OF THE FOLLOWING WORDS OR FORMULAS UNDER ANY CIRCUMSTANCES:\n${list}`;
}

/**
 * Ordered list of directive sections. Order here is the order they'll be
 * numbered and rendered in — add/remove/reorder freely, numbering is
 * derived automatically instead of being hardcoded per-section.
 */
const SECTION_BUILDERS = [
  {
    heading: "TONE & VOICE",
    build: (structure) => pickAliasedValue(structure, "tone_and_voice"),
  },
  {
    heading: "HOOK INSTRUCTIONS (FIRST 15 SECONDS)",
    build: (structure) => pickAliasedValue(structure, "hook_instructions"),
  },
  {
    heading: "CONTENT FLOW & IDEAS PROGRESSION",
    build: (structure) => renderContentFlow(structure.content_flow),
  },
  {
    heading: "PACING & DELIVERY RULES",
    build: (structure) =>
      renderPacingAndDelivery(structure.pacing_and_delivery),
  },
  {
    heading: "RETENTION & ENGAGEMENT RULES",
    build: (structure) => renderBulletList(structure.retention_rules),
  },
  {
    heading: "BANNED CLICHÉS & PHRASES (STRICTLY FORBIDDEN)",
    build: (structure) => renderBannedPhrases(structure.banned_phrases),
  },
];

function renderCustomFields(structure) {
  const recognized = new Set([
    ...Object.values(FIELD_ALIASES).flat(),
    "content_flow",
    "pacing_and_delivery",
    "retention_rules",
    "banned_phrases",
    ...INTENTIONALLY_UNRENDERED_KEYS,
  ]);

  const customEntries = Object.entries(structure).filter(
    ([key, value]) => !recognized.has(key) && value != null && value !== "",
  );
  if (customEntries.length === 0) return null;

  return customEntries
    .map(([key, value]) => {
      const valStr =
        typeof value === "object"
          ? JSON.stringify(value, null, 2)
          : String(value);
      return `- **${key.replace(/_/g, " ").toUpperCase()}**:\n${valStr}`;
    })
    .join("\n");
}

/**
 * Formats a scriptStructure (object or JSON string) into a clean, markdown directive section
 * that commands the LLM to follow the channel's custom script style.
 *
 * @param {ScriptStructure|string|null|undefined} structureInput
 * @returns {string}
 */
export function formatScriptStructureForPrompt(structureInput) {
  let structure = structureInput ?? DEFAULT_SCRIPT_STRUCTURE;

  if (typeof structure === "string") {
    const trimmed = structure.trim();
    if (!trimmed) {
      structure = DEFAULT_SCRIPT_STRUCTURE;
    } else {
      try {
        structure = JSON.parse(trimmed);
      } catch (err) {
        // Not valid JSON — treat the raw string itself as a freeform directive
        // block rather than silently discarding the caller's input.
        return `### SCRIPT CONTENT & DELIVERY DIRECTIVES:\n${trimmed}`;
      }
    }
  }

  if (!structure || typeof structure !== "object" || Array.isArray(structure)) {
    return "";
  }

  const sections = [];
  let sectionNumber = 1;

  for (const { heading, build } of SECTION_BUILDERS) {
    const body = build(structure);
    if (body) {
      sections.push(`### ${sectionNumber}. ${heading}\n${body}`);
      sectionNumber += 1;
    }
  }

  const customBlock = renderCustomFields(structure);
  if (customBlock) {
    sections.push(
      `### ${sectionNumber}. CHANNEL-SPECIFIC CONTENT GUIDELINES\n${customBlock}`,
    );
    sectionNumber += 1;
  }

  return sections.join("\n\n");
}
