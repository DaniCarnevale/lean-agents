// Model aliases keep presets stable while concrete model ids change.
// Override per project in orchestration.toml:
//   [models.aliases]
//   strong = "some-new-model"
//
// Tiers are only used by `doctor` to spot inverted setups (a subagent on a
// stronger tier than the director). Unknown models are reported as info, never
// as errors, because model catalogs change faster than this file.

export const DEFAULT_ALIASES = {
  strong: "gpt-6.1-sol",
  balanced: "gpt-6-sol",
  fast: "gpt-6-luna",
};

export const ALIASES_UPDATED = "2026-11";

export const MODEL_TIERS = {
  "gpt-6-astra": 3,
  "gpt-6.1-sol": 3,
  "gpt-6-sol": 2,
  "gpt-6-luna": 1,
  "gpt-5.6-sol": 2,
  "gpt-5.6-terra": 2,
  "gpt-5.6-luna": 1,
  "gpt-5.5": 2,
  "gpt-5.4": 2,
};

export const TIER_NAMES = { 1: "fast", 2: "balanced", 3: "strong" };

export const REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"];

export function resolveModel(value, aliases = {}) {
  if (!value) return undefined;
  const merged = { ...DEFAULT_ALIASES, ...aliases };
  return merged[value] ?? value;
}

export function tierOf(model) {
  if (!model) return undefined;
  return MODEL_TIERS[model];
}
