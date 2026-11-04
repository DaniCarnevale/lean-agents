# doctor rules

`lean-agents doctor` checks the agent setup of any repository for Claude Code and Codex. It exits with 1 when there is at least one **error**, or at least one **warning** under `--strict`. **Info** findings never fail.

### Codex and shared rules

| ID | Name | Severity | What it catches |
|---|---|---|---|
| LA001 | config-parse-error | error | A `.codex/config.toml` or agent TOML file that does not parse. |
| LA002 | orchestration-config-invalid | error | `orchestration.toml` has invalid values (unknown preset, mode, role or skill). |
| LA003 | orchestration-unknown-key | warn | `orchestration.toml` has a key that lean-agents does not know, usually a typo. Suggests the right key when it can. `[claude]`, `[codex]` and the tool names under `[models.aliases]` are not checked. |
| LA010 | override-shadows-agents-md | error | `AGENTS.override.md` and `AGENTS.md` in the same folder. Codex loads only the override. |
| LA011 | instructions-too-large | warn / info | The instruction chain for a folder exceeds 32 KiB (`project_doc_max_bytes` default; the rest is dropped) or 16 KiB (info: paid every turn). |
| LA012 | subagent-guard-missing | warn | Project instructions (AGENTS.md or CLAUDE.md) define a director/orchestration protocol and subagents exist, but nothing tells subagents to skip it. |
| LA020 | unknown-agents-key | warn | A key under `[agents]` that Codex does not document (known: `enabled`, `max_concurrent_threads_per_session`, `max_threads`, `default_subagent_model`, `default_subagent_reasoning_effort`, `interrupt_message`). Suggests the right key when it can. |
| LA022 | many-threads | info | The thread limit is above 4. |
| LA023 | no-thread-limit | info | Custom agents exist but no thread limit is set, so Codex chooses it. |
| LA024 | legacy-thread-key | info | `max_threads` is used; it still works as a legacy alias of `max_concurrent_threads_per_session`. |
| LA030 | agent-missing-field | error | An agent file without `name`, `description` or `developer_instructions`. |
| LA031 | duplicate-agent-name | error | Two agent files with the same `name`. |
| LA032 | invalid-sandbox-mode | error | `sandbox_mode` in `.codex/config.toml` is not `read-only`, `workspace-write` or `danger-full-access`. |
| LA033 | full-access-session | warn | `.codex/config.toml` sets `danger-full-access`, and subagents inherit it. |
| LA034 | invalid-reasoning-effort | warn | `model_reasoning_effort` is not `low`, `medium`, `high`, `xhigh`, `max` or `ultra`. Available levels also depend on the model. |
| LA036 | director-weaker-than-subagent | info | A subagent's model is on a stronger tier than the director's. |
| LA037 | unknown-model | info | A model id not in the tier table; tier checks are skipped for it. |
| LA038 | agent-setting-ignored | warn | A custom agent file sets `sandbox_mode`, `approval_policy`, `model_provider`, `mcp_servers` or `service_tier`. Codex ignores them there, because subagents inherit them from the parent session. |
| LA040 | skills-in-unscanned-folder | error | `SKILL.md` files under `.codex/skills/`. Codex scans `.agents/skills/`. |
| LA041 | skill-missing-frontmatter | error | A `SKILL.md` in `.agents/skills/` without `name` and `description`. |
| LA042 | skill-name-mismatch | warn | Skill `name` differs from its folder name. |
| LA043 | missing-skill-reference | warn | Instructions or agents reference a skill (`.agents/skills/x`, `` `$x` ``, ``skill `x` ``) that neither tool can find. Notes when it exists in the wrong folder. |
| LA044 | large-skill | info | A skill over 20 KB; all of it enters context when used. |
| LA045 | skills-list-budget | info | Skill names and descriptions total more than about 8,000 characters (Codex's default initial list budget). |
| LA050 | instructions-not-versioned | info | `AGENTS.md`, `CLAUDE.md`, `.codex`, `.agents` or `.claude` excluded via `.gitignore` or `.git/info/exclude` (local files such as `settings.local.json` are fine). |
| LA060 | generated-files-out-of-sync | warn / info | lean-agents projects only: generated files are stale (warn) or were edited by hand (info). |

### Claude Code

| ID | Name | Severity | What it catches |
|---|---|---|---|
| LA101 | claude-frontmatter-invalid | error | A subagent or skill file that does not start with a `---` YAML frontmatter line. |
| LA110 | claude-md-hides-agents-md | warn | `CLAUDE.md` and `AGENTS.md` both exist and `CLAUDE.md` does not import `@AGENTS.md`: Claude Code reads only `CLAUDE.md`, so the rules in `AGENTS.md` never reach it. |
| LA111 | claude-md-long | info | More than 200 lines of instructions load every session (imports included). |
| LA120 | claude-settings-invalid | error | `.claude/settings.json` is not valid JSON. |
| LA121 | claude-nested-subagents | info | Subagents can launch their own subagents (no `disallowedTools: Agent` and no `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`). |
| LA122 | claude-invalid-effort-level | warn | `effortLevel` in `.claude/settings.json` is not `low`, `medium`, `high` or `xhigh`. Claude Code does not accept `max` in this key. |
| LA123 | claude-effort-env-override | info | `env.CLAUDE_CODE_EFFORT_LEVEL` is set in `.claude/settings.json`; it takes priority over `effortLevel`. |
| LA130 | claude-agent-missing-field | error | A subagent without `name` or `description`. |
| LA131 | claude-duplicate-agent-name | error | Two subagents with the same `name`. |
| LA132 | claude-agent-invalid-name | error | A `name` containing `:` or starting with `-`. |
| LA133 | claude-unknown-model | warn | `model` is not an alias (`sonnet`, `opus`, `haiku`, `fable`, `inherit`) nor a full `claude-*` id. |
| LA134 | claude-invalid-effort | warn | `effort` not in `low`, `medium`, `high`, `xhigh`, `max`. |
| LA135 | claude-invalid-permission-mode | warn | `permissionMode` is not a documented value. |
| LA136 | claude-read-only-role-without-tool-limits | warn | The body says "do not modify files" but the tools still include edit tools such as Write or Edit. Bash is allowed, because a reviewer needs it to read diffs. |
| LA137 | claude-director-weaker-than-subagent | info | A subagent's model is stronger than the project default model in `.claude/settings.json`. |
| LA138 | claude-agent-descriptions-budget | info | Subagent descriptions are long enough to approach Claude Code's startup warning. |
| LA140 | claude-skills-not-shared | info | The repo uses Claude Code and has Codex skills, but no `.claude/skills/`. |
| LA141 | claude-skill-missing-description | warn | A Claude Code skill without `description`. |
| LA142 | claude-skill-description-truncated | info | `description` + `when_to_use` exceed 1,536 characters. |

## Sources

The rules encode tool behavior as documented in November 2026. For Codex: one instruction file per folder with the override taking precedence, a 32 KiB default for `project_doc_max_bytes`, skill discovery under `.agents/skills`, the `[agents]` keys, custom agent fields and subagents inheriting the parent's sandbox and approvals. For Claude Code: `CLAUDE.md` taking precedence over `AGENTS.md` unless it imports it, subagent frontmatter fields, skills under `.claude/skills`, and the 200-line guidance for `CLAUDE.md`. If a tool changes, open an issue with a link to its docs.
