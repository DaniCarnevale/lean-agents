import { renderAgentsMd, renderClaudeMd, SKILL_DIRS } from "./templates/agents-md.js";
import { renderRole, roleFileName, renderCodexConfig, renderClaudeAgent, renderClaudeSettings } from "./templates/roles.js";
import { renderSkill } from "./templates/skills.js";

// Returns { relativePath: content } for every file lean-agents manages,
// for each coding tool listed in `targets`.
export function renderAll(cfg) {
  const files = {};
  const codex = cfg.targets.includes("codex");
  const claude = cfg.targets.includes("claude");

  if (codex) {
    files["AGENTS.md"] = renderAgentsMd(cfg);
    files[".codex/config.toml"] = renderCodexConfig(cfg);
    for (const role of cfg.roles) files[`.codex/agents/${roleFileName(role)}`] = renderRole(cfg, role);
  }
  if (claude) {
    files["CLAUDE.md"] = renderClaudeMd(cfg);
    files[".claude/settings.json"] = renderClaudeSettings(cfg);
    for (const role of cfg.roles) files[`.claude/agents/${role.name.replace(/_/g, "-")}.md`] = renderClaudeAgent(cfg, role);
  }
  for (const target of cfg.targets) {
    for (const skill of cfg.skills) files[`${SKILL_DIRS[target]}/${skill}/SKILL.md`] = renderSkill(cfg, skill);
  }
  return files;
}
