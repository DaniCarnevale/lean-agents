// Presets decide which built-in roles and skills are on by default.
// Everything can be overridden in orchestration.toml.

export const BUILTIN_ROLES = ["reviewer", "explorer", "ui_auditor"];

export const BUILTIN_SKILLS = ["intake", "adr", "verify", "contract-first"];

export const PRESETS = {
  minimal: {
    description: "Director + independent reviewer. Best starting point for small repos.",
    roles: ["reviewer"],
    skills: ["intake", "verify"],
    orchestration: { delegation: "explicit", max_threads: 1, intake: "ask" },
  },
  standard: {
    description: "Director + reviewer + cheap read-only explorer. Good default for most projects.",
    roles: ["reviewer", "explorer"],
    skills: ["intake", "adr", "verify"],
    orchestration: { delegation: "checkpoints", max_threads: 2, intake: "ask" },
  },
  "web-fullstack": {
    description: "Standard + UI auditor and contract-first workflow for frontend/backend repos.",
    roles: ["reviewer", "explorer", "ui_auditor"],
    skills: ["intake", "adr", "verify", "contract-first"],
    orchestration: { delegation: "checkpoints", max_threads: 2, intake: "ask" },
  },
};

export const BUILTIN_ROLE_DEFAULTS = {
  // Bash lets it read diffs and run checks. It is the one read-only role that can
  // run commands, so in Claude Code its read-only rule rests on its instructions.
  reviewer: { model: "balanced", effort: "high", sandbox: "read-only", claudeTools: ["Read", "Grep", "Glob", "Bash"] },
  explorer: { model: "fast", effort: "medium", sandbox: "read-only" },
  ui_auditor: { model: "fast", effort: "high", sandbox: "read-only" },
};

export const CUSTOM_ROLE_DEFAULTS = { model: "strong", effort: "high", sandbox: "workspace-write" };

export const DIRECTOR_DEFAULTS = { model: "strong", effort: "high" };
