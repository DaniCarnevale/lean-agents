import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";
import {
  PRESETS,
  BUILTIN_ROLES,
  BUILTIN_SKILLS,
  BUILTIN_ROLE_DEFAULTS,
  CUSTOM_ROLE_DEFAULTS,
  DIRECTOR_DEFAULTS,
} from "./presets.js";
import { TARGETS, resolveModel, effortFor, isAlias, REASONING_EFFORTS } from "./models.js";

export const CONFIG_FILE = "orchestration.toml";
export const SANDBOX_MODES = ["read-only", "workspace-write", "danger-full-access"];
const DELEGATION_MODES = ["explicit", "checkpoints"];
const INTAKE_MODES = ["off", "ask", "always"];
const LANGUAGES = ["es", "en"];
const ROLE_NAME = /^[a-z][a-z0-9_]*$/;

// Known keys per table. [claude], [codex] and the tool names under
// [models.aliases] are pass-through, so they are not listed.
const KNOWN_KEYS = {
  root: ["schema", "targets", "language", "preset", "project", "models", "orchestration", "roles", "skills", "claude", "codex"],
  project: ["name", "summary", "sources_of_truth", "rules", "verify", "docs"],
  docs: ["status", "validation", "adr"],
  models: ["director", "director_effort", "aliases"],
  alias: ["strong", "balanced", "fast"],
  orchestration: ["delegation", "max_threads", "intake", "keywords"],
  skills: ["include"],
  role: ["enabled", "description", "focus", "checklist", "instructions", "model", "effort", "sandbox", "claude_tools"],
};
const MAX_SUGGESTION_DISTANCE = 2;

export class ConfigError extends Error {
  constructor(problems, warnings = []) {
    super(`Invalid ${CONFIG_FILE}:\n- ${problems.join("\n- ")}`);
    this.problems = problems;
    this.warnings = warnings;
  }
}

export function readConfig(root) {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) return null;
  const raw = parse(fs.readFileSync(file, "utf8"));
  return normalizeConfig(raw);
}

function asList(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

const isTable = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

function closestKey(key, known) {
  let best = null;
  let bestDistance = MAX_SUGGESTION_DISTANCE + 1;
  for (const candidate of known) {
    const distance = editDistance(key, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

// Unknown keys are warnings, not errors, so a config written for a newer
// version still loads.
function unknownKeyWarnings(raw) {
  const warnings = [];
  const check = (table, known, where) => {
    if (!isTable(table)) return;
    for (const key of Object.keys(table)) {
      if (known.includes(key)) continue;
      const suggestion = closestKey(key, known);
      const prefix = where ? `[${where}] ` : "";
      warnings.push(
        suggestion
          ? `${prefix}\`${key}\` does not exist, did you mean \`${suggestion}\`?`
          : `${prefix}\`${key}\` does not exist (known keys: ${known.join(", ")}).`
      );
    }
  };
  const tablesIn = (value) => (isTable(value) ? Object.entries(value) : []);
  check(raw, KNOWN_KEYS.root, "");
  check(raw.project, KNOWN_KEYS.project, "project");
  check(raw.project?.docs, KNOWN_KEYS.docs, "project.docs");
  check(raw.models, KNOWN_KEYS.models, "models");
  for (const [tool, table] of tablesIn(raw.models?.aliases)) check(table, KNOWN_KEYS.alias, `models.aliases.${tool}`);
  check(raw.orchestration, KNOWN_KEYS.orchestration, "orchestration");
  check(raw.skills, KNOWN_KEYS.skills, "skills");
  for (const [name, table] of tablesIn(raw.roles)) check(table, KNOWN_KEYS.role, `roles.${name}`);
  return warnings;
}

// A model value is an alias (strong | balanced | fast), a concrete id, or a
// table with one id per target. A bare concrete id only makes sense when the
// project targets a single tool.
function resolvePerTarget(value, targets, aliases, where, problems) {
  const out = {};
  if (isTable(value)) {
    for (const t of targets) {
      if (!value[t]) problems.push(`${where}: missing a model for "${t}"`);
      out[t] = resolveModel(t, value[t], aliases);
    }
    return out;
  }
  if (!isAlias(value) && targets.length > 1) {
    problems.push(`${where}: "${value}" is a concrete model id; with several targets use an alias (strong, balanced, fast) or a table like { claude = "opus", codex = "gpt-6.1-sol" }`);
  }
  for (const t of targets) out[t] = resolveModel(t, value, aliases);
  return out;
}

function effortsPerTarget(effort, targets) {
  return Object.fromEntries(targets.map((t) => [t, effortFor(t, effort)]));
}

// Turns the user-facing TOML into a fully resolved model used by the renderer.
export function normalizeConfig(raw) {
  const problems = [];
  const warnings = unknownKeyWarnings(raw);
  const presetName = raw.preset ?? "standard";
  const preset = PRESETS[presetName];
  if (!preset) problems.push(`preset "${presetName}" does not exist (use: ${Object.keys(PRESETS).join(", ")})`);
  const p = preset ?? PRESETS.standard;

  const language = raw.language ?? "en";
  if (!LANGUAGES.includes(language)) problems.push(`language must be one of ${LANGUAGES.join(", ")}`);

  // Configs written before targets existed were Codex-only.
  const targets = raw.targets === undefined ? ["codex"] : asList(raw.targets);
  if (!targets.length) problems.push(`targets must list at least one of ${TARGETS.join(", ")}`);
  for (const t of targets) {
    if (!TARGETS.includes(t)) problems.push(`targets: unknown tool "${t}" (use: ${TARGETS.join(", ")})`);
  }
  const validTargets = TARGETS.filter((t) => targets.includes(t));

  const project = raw.project ?? {};
  const docs = project.docs ?? {};
  const aliases = raw.models?.aliases ?? {};

  const orch = { ...p.orchestration, ...(raw.orchestration ?? {}) };
  if (!DELEGATION_MODES.includes(orch.delegation)) problems.push(`orchestration.delegation must be one of ${DELEGATION_MODES.join(", ")}`);
  if (!INTAKE_MODES.includes(orch.intake)) problems.push(`orchestration.intake must be one of ${INTAKE_MODES.join(", ")}`);
  if (!Number.isInteger(orch.max_threads) || orch.max_threads < 1 || orch.max_threads > 6) {
    problems.push("orchestration.max_threads must be an integer between 1 and 6");
  }
  orch.keywords = orch.keywords ?? true;

  const directorEffort = raw.models?.director_effort ?? DIRECTOR_DEFAULTS.effort;
  if (!REASONING_EFFORTS.includes(directorEffort)) problems.push(`models.director_effort must be one of ${REASONING_EFFORTS.join(", ")}`);
  const director = {
    model: resolvePerTarget(raw.models?.director ?? DIRECTOR_DEFAULTS.model, validTargets, aliases, "models.director", problems),
    effort: effortsPerTarget(directorEffort, validTargets),
  };

  // Roles: preset built-ins first, then user tables (which may disable or add).
  const rawRoles = raw.roles ?? {};
  const roles = [];
  const names = new Set([...p.roles, ...Object.keys(rawRoles)]);
  for (const name of names) {
    const user = rawRoles[name] ?? {};
    if (user.enabled === false) continue;
    if (!ROLE_NAME.test(name)) {
      problems.push(`role "${name}": names must be snake_case (a-z, 0-9, _)`);
      continue;
    }
    const builtin = BUILTIN_ROLES.includes(name);
    const defaults = builtin ? BUILTIN_ROLE_DEFAULTS[name] : CUSTOM_ROLE_DEFAULTS;
    if (!builtin && !user.description) problems.push(`role "${name}": custom roles need a description`);
    const effort = user.effort ?? defaults.effort;
    if (!REASONING_EFFORTS.includes(effort)) problems.push(`role "${name}": effort must be one of ${REASONING_EFFORTS.join(", ")}`);
    const sandbox = user.sandbox ?? defaults.sandbox;
    if (!SANDBOX_MODES.includes(sandbox)) problems.push(`role "${name}": sandbox must be one of ${SANDBOX_MODES.join(", ")}`);
    if (sandbox === "danger-full-access") problems.push(`role "${name}": danger-full-access is not allowed in lean-agents roles`);
    roles.push({
      name,
      builtin,
      description: user.description,
      focus: asList(user.focus),
      checklist: asList(user.checklist),
      instructions: user.instructions ? String(user.instructions).trim() : "",
      model: resolvePerTarget(user.model ?? defaults.model, validTargets, aliases, `role "${name}".model`, problems),
      effort: effortsPerTarget(effort, validTargets),
      sandbox,
      claudeTools: user.claude_tools ? asList(user.claude_tools) : (defaults.claudeTools ?? null),
    });
  }

  const skills = raw.skills?.include ? asList(raw.skills.include) : [...p.skills];
  for (const s of skills) {
    if (!BUILTIN_SKILLS.includes(s)) problems.push(`skills.include: unknown skill "${s}" (available: ${BUILTIN_SKILLS.join(", ")})`);
  }
  if (orch.intake !== "off" && !skills.includes("intake")) skills.unshift("intake");

  const codex = raw.codex ?? {};
  for (const reserved of ["model", "model_reasoning_effort", "agents"]) {
    if (reserved in codex) problems.push(`[codex].${reserved} is managed by lean-agents; use [models] / [orchestration] instead`);
  }
  const claude = raw.claude ?? {};
  if ("model" in claude) problems.push("[claude].model is managed by lean-agents; use [models] instead");
  if ("effortLevel" in claude) problems.push("[claude].effortLevel is managed by lean-agents; use models.director_effort instead");

  if (problems.length) throw new ConfigError(problems, warnings);

  return {
    warnings,
    schema: raw.schema ?? 1,
    preset: presetName,
    language,
    targets: validTargets,
    project: {
      name: project.name ?? "project",
      summary: project.summary ?? "",
      sourcesOfTruth: asList(project.sources_of_truth),
      rules: asList(project.rules),
      verify: asList(project.verify),
      docs: {
        adr: docs.adr ?? "docs/adr",
        status: docs.status,
        validation: docs.validation,
      },
    },
    director,
    orchestration: orch,
    roles,
    skills,
    codex,
    claude,
  };
}
