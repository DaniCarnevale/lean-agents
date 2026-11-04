// Model aliases keep presets stable while concrete model ids change.
// Each target (coding tool) has its own catalog. Override per project:
//
//   [models.aliases.codex]
//   strong = "some-new-model"
//
// Tiers are only used by `doctor` to spot inverted setups (a subagent on a
// stronger tier than the director). Unknown models are reported as info, never
// as errors, because model catalogs change faster than this file.

export const TARGETS = ["claude", "codex"];

export const DEFAULT_ALIASES = {
  codex: { strong: "gpt-6.1-sol", balanced: "gpt-6-sol", fast: "gpt-6-luna" },
  claude: { strong: "opus", balanced: "sonnet", fast: "haiku" },
};

export const ALIASES_UPDATED = "2026-11";

export const MODEL_TIERS = {
  codex: {
    "gpt-6-astra": 3,
    "gpt-6.1-sol": 3,
    "gpt-6-sol": 2,
    "gpt-6-luna": 1,
    "gpt-5.6-sol": 2,
    "gpt-5.6-terra": 2,
    "gpt-5.6-luna": 1,
    "gpt-5.5": 2,
    "gpt-5.4": 2,
  },
  claude: {
    fable: 3,
    opus: 3,
    sonnet: 2,
    haiku: 1,
  },
};

export const TIER_NAMES = { 1: "fast", 2: "balanced", 3: "strong" };

// Union of the levels both tools accept; each target maps the ones it lacks.
export const REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max"];
export const TARGET_EFFORTS = {
  codex: ["minimal", "low", "medium", "high", "xhigh"],
  claude: ["low", "medium", "high", "xhigh", "max"],
};

// `effortLevel` in .claude/settings.json is narrower than subagent `effort`:
// Claude Code does not accept `max` there.
export const CLAUDE_SETTINGS_EFFORTS = ["low", "medium", "high", "xhigh"];

export function effortFor(target, effort) {
  if (target === "codex" && effort === "max") return "xhigh";
  if (target === "claude" && effort === "minimal") return "low";
  return effort;
}

export const claudeSettingsEffort = (effort) => (effort === "max" ? "xhigh" : effort);

export const isAlias = (value) => ["strong", "balanced", "fast"].includes(value);

export function resolveModel(target, value, aliases = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object") return value[target];
  const merged = { ...DEFAULT_ALIASES[target], ...(aliases[target] ?? {}) };
  return merged[value] ?? value;
}

export function tierOf(target, model) {
  if (!model) return undefined;
  const table = MODEL_TIERS[target] ?? {};
  if (table[model]) return table[model];
  if (target === "claude") {
    // Full ids such as claude-opus-5-5 map to their family.
    const family = Object.keys(table).find((f) => model.startsWith(`claude-${f}`));
    return family ? table[family] : undefined;
  }
  return undefined;
}
