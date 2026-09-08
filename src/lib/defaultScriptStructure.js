/**
 * Default Script Structure templates and prompt formatting utilities.
 * Defines the content and delivery blueprint that guides any LLM on what is to be said,
 * how to speak it, pacing, hook formula, content flow, and words to avoid.
 */

export const DEFAULT_SCRIPT_STRUCTURE = {
  tone_and_voice: "Engaging, confident, conversational, and authoritative. Spoken directly to the listener with clarity and strong forward momentum.",
  hook_instructions: "Start immediately with a bold, high-stakes statement, shocking paradox, or counterintuitive reality in the first 10-15 seconds. Zero generic greetings, zero 'welcome back', zero throat-clearing.",
  content_flow: [
    "1. Hook: Grab immediate attention by challenging an assumption or revealing an alarming truth.",
    "2. Core Concept: Clearly introduce the central question or mechanism without stalling.",
    "3. In-Depth Breakdown: Deliver the meat of the story or analysis with compelling, concrete examples and vivid explanations.",
    "4. The Critical Twist: Introduce the counterintuitive consequence, hidden angle, or major turning point.",
    "5. Lasting Takeaway: Close with a strong, thought-provoking realization that reframes the topic for the viewer."
  ],
  pacing_and_delivery: {
    sentence_variety: "Vary sentence length aggressively. Pair short punchy lines with rhythmic explanations. Avoid dense academic run-ons.",
    paragraph_length: "Strictly 2 to 4 spoken lines per paragraph for natural breathing and momentum.",
    voice: "Active voice, direct address ('you', 'your world'). Speak with crisp conviction."
  },
  retention_rules: [
    "Every section must introduce a fresh insight or revelation to pull the listener forward.",
    "Explain complex mechanisms with simple, tangible real-world analogies.",
    "Keep momentum high—never repeat points or summarize what was already stated."
  ],
  banned_phrases: [
    "In today's fast-paced world",
    "Let's dive in",
    "Without further ado",
    "It is important to remember",
    "Throughout human history",
    "Imagine standing on a hill",
    "In conclusion",
    "As we all know",
    "Have you ever wondered"
  ]
};

export const SCRIPT_STRUCTURE_PRESETS = [
  {
    id: "engaging_storytelling",
    name: "Engaging Storytelling",
    description: "High-retention spoken narrative flow with strong hooks, escalating curiosity, and lasting payoff.",
    structure: DEFAULT_SCRIPT_STRUCTURE,
  },
  {
    id: "deep_dive_breakdown",
    name: "Deep-Dive Breakdown",
    description: "Forensic and analytical spoken structure tracing hidden mechanics, evidence, and systemic insights.",
    structure: {
      tone_and_voice: "Analytical, sharp, objective, and investigative. Direct and fact-driven.",
      hook_instructions: "Open with a shocking statistic, an overlooked anomaly, or a pivotal contradiction in the first 10 seconds.",
      content_flow: [
        "1. The Anomaly: Present the contradiction or hidden question everyone overlooked.",
        "2. The Underlying System: Unpack the machinery, incentives, and key players step-by-step.",
        "3. Concrete Evidence: Walk through real-world case studies, data points, or documented events.",
        "4. The Ripple Effect: Highlight the unintended consequences and how it directly affects people.",
        "5. The Verdict: Deliver a clear, evidence-backed conclusion that changes how the viewer understands the system."
      ],
      pacing_and_delivery: {
        sentence_variety: "Crisp, rhythmic, evidentiary beats. Move cleanly from observation to revelation.",
        paragraph_length: "2 to 3 spoken sentences per beat.",
        voice: "Informed narrator presenting undeniable proof directly to the listener."
      },
      retention_rules: [
        "State the conflict clearly before diving into the data.",
        "Ground every claim in concrete realities rather than abstract speculation."
      ],
      banned_phrases: [
        "In a world where",
        "It goes without saying",
        "At the end of the day",
        "Only time will tell",
        "Needless to say"
      ]
    }
  },
  {
    id: "fast_paced_explainer",
    name: "Fast-Paced Explainer",
    description: "Quick, punchy breakdown making complex concepts instantly understandable with high energy.",
    structure: {
      tone_and_voice: "Energetic, clear, conversational, and direct. Enthusiastic without being juvenile.",
      hook_instructions: "Drop the viewer right into the most bizarre, fascinating, or urgent aspect of the topic immediately.",
      content_flow: [
        "1. Instant Hook: What makes this crazy, urgent, or counterintuitive right now.",
        "2. The Core Mechanism: How it works in plain, simple English.",
        "3. Surprising Nuances: The lesser-known facts, edge cases, or common misconceptions.",
        "4. Real-World Impact: Why this matters to the viewer today.",
        "5. Wrap-Up: A memorable closing line that leaves a strong impression."
      ],
      pacing_and_delivery: {
        sentence_variety: "Fast, energetic, punchy sentences. High density of information.",
        paragraph_length: "2 to 3 spoken lines.",
        voice: "Dynamic explainer making technical or complex ideas click effortlessly."
      },
      retention_rules: [
        "Strip all unnecessary jargon and filler.",
        "Use memorable analogies that explain mechanisms in 5 seconds."
      ],
      banned_phrases: [
        "Science is fascinating",
        "As we can see",
        "Believe it or not",
        "In summary",
        "To put it simply"
      ]
    }
  }
];

/**
 * Formats a scriptStructure (object or JSON string) into a clean, markdown directive section
 * that commands the LLM to follow the channel's custom script style.
 */
export function formatScriptStructureForPrompt(structureInput) {
  if (!structureInput) {
    structureInput = DEFAULT_SCRIPT_STRUCTURE;
  }

  let structure = structureInput;
  if (typeof structureInput === "string") {
    try {
      structure = JSON.parse(structureInput);
    } catch {
      return `### SCRIPT CONTENT & DELIVERY DIRECTIVES:\n${structureInput.trim()}`;
    }
  }

  if (!structure || typeof structure !== "object" || Array.isArray(structure)) {
    return "";
  }

  const sections = [];

  if (structure.tone_and_voice || structure.narrative_style) {
    sections.push(`### 1. TONE & VOICE\n${structure.tone_and_voice || structure.narrative_style}`);
  }

  if (structure.hook_instructions || structure.hook_formula) {
    sections.push(`### 2. HOOK INSTRUCTIONS (FIRST 15 SECONDS)\n${structure.hook_instructions || structure.hook_formula}`);
  }

  if (Array.isArray(structure.content_flow) && structure.content_flow.length > 0) {
    const flow = structure.content_flow.map((item) => `- ${typeof item === "object" ? JSON.stringify(item) : item}`).join("\n");
    sections.push(`### 3. CONTENT FLOW & IDEAS PROGRESSION\nDeliver the narration following this progression of ideas:\n${flow}`);
  }

  if (structure.pacing_and_delivery && typeof structure.pacing_and_delivery === "object") {
    const rules = Object.entries(structure.pacing_and_delivery)
      .map(([k, v]) => `- **${k.replace(/_/g, " ").toUpperCase()}**: ${v}`)
      .join("\n");
    sections.push(`### 4. PACING & DELIVERY RULES\n${rules}`);
  }

  if (Array.isArray(structure.retention_rules) && structure.retention_rules.length > 0) {
    const retention = structure.retention_rules.map((l) => `- ${l}`).join("\n");
    sections.push(`### 5. RETENTION & ENGAGEMENT RULES\n${retention}`);
  }

  if (Array.isArray(structure.banned_phrases) && structure.banned_phrases.length > 0) {
    const banned = structure.banned_phrases.map((p) => `"${p}"`).join(", ");
    sections.push(`### 6. BANNED CLICHÉS & PHRASES (STRICTLY FORBIDDEN)\nDO NOT USE ANY OF THE FOLLOWING WORDS OR FORMULAS UNDER ANY CIRCUMSTANCES:\n${banned}`);
  }

  // Any other custom keys in the JSON
  const recognizedKeys = new Set([
    "tone_and_voice",
    "narrative_style",
    "hook_instructions",
    "hook_formula",
    "content_flow",
    "pacing_and_delivery",
    "retention_rules",
    "curiosity_loops",
    "banned_phrases",
    "act_structure" // in case legacy object had it, we ignore it
  ]);

  const customEntries = Object.entries(structure).filter(([k]) => !recognizedKeys.has(k));
  if (customEntries.length > 0) {
    const customText = customEntries.map(([k, v]) => {
      const valStr = typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
      return `- **${k.replace(/_/g, " ").toUpperCase()}**:\n${valStr}`;
    }).join("\n");
    sections.push(`### 7. CHANNEL-SPECIFIC CONTENT GUIDELINES\n${customText}`);
  }

  return sections.join("\n\n");
}
