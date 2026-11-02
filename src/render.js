import { renderAgentsMd } from "./templates/agents-md.js";
import { renderRole, roleFileName, renderCodexConfig } from "./templates/roles.js";
import { renderSkill } from "./templates/skills.js";

// Returns { relativePath: content } for every file lean-agents manages.
export function renderAll(cfg) {
  const files = {
    "AGENTS.md": renderAgentsMd(cfg),
    ".codex/config.toml": renderCodexConfig(cfg),
  };
  for (const role of cfg.roles) files[`.codex/agents/${roleFileName(role)}`] = renderRole(cfg, role);
  for (const skill of cfg.skills) files[`.agents/skills/${skill}/SKILL.md`] = renderSkill(cfg, skill);
  return files;
}
