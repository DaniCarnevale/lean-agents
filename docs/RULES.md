# doctor rules

`lean-agents doctor` exits with 1 when there is at least one **error**, or at least one **warning** under `--strict`. **Info** findings never fail.

| ID | Name | Severity | What it catches |
|---|---|---|---|
| LA001 | config-parse-error | error | A `.codex/config.toml` or agent TOML file that does not parse. |
| LA002 | orchestration-config-invalid | error | `orchestration.toml` has invalid values (unknown preset, mode, role or skill). |
| LA010 | override-shadows-agents-md | error | `AGENTS.override.md` and `AGENTS.md` in the same folder. Codex loads only the override. |
| LA011 | instructions-too-large | warn / info | The instruction chain for a folder exceeds 32 KiB (`project_doc_max_bytes` default; the rest is dropped) or 16 KiB (info: paid every turn). |
| LA012 | subagent-guard-missing | warn | Root instructions define a director/orchestration protocol and custom agents exist, but nothing tells subagents to skip it. |
| LA020 | unknown-agents-key | warn | A key under `[agents]` that Codex does not document (known: `max_threads`, `max_depth`, `job_max_runtime_seconds`). Suggests the right key when it can. |
| LA021 | max-depth-above-one | warn | `max_depth > 1`: subagents can spawn subagents. |
| LA022 | many-threads | info | `max_threads > 4`. |
| LA023 | no-thread-limit | info | Custom agents exist but `max_threads` is unset (default 6). |
| LA030 | agent-missing-field | error | An agent file without `name`, `description` or `developer_instructions`. |
| LA031 | duplicate-agent-name | error | Two agent files with the same `name`. |
| LA032 | invalid-sandbox-mode | error | `sandbox_mode` not in `read-only`, `workspace-write`, `danger-full-access`. |
| LA033 | full-access-agent | warn | An agent with `danger-full-access`. |
| LA034 | invalid-reasoning-effort | warn | `model_reasoning_effort` not in `minimal`, `low`, `medium`, `high`, `xhigh`. |
| LA035 | read-only-role-without-sandbox | warn | Instructions say "do not modify files" (EN/ES patterns) but `sandbox_mode` is not `read-only`. |
| LA036 | director-weaker-than-subagent | info | A subagent's model is on a stronger tier than the director's. |
| LA037 | unknown-model | info | A model id not in the tier table; tier checks are skipped for it. |
| LA040 | skills-in-unscanned-folder | error | `SKILL.md` files under `.codex/skills/`. Codex scans `.agents/skills/`. |
| LA041 | skill-missing-frontmatter | error | A `SKILL.md` in `.agents/skills/` without `name` and `description`. |
| LA042 | skill-name-mismatch | warn | Skill `name` differs from its folder name. |
| LA043 | missing-skill-reference | warn | Instructions reference a skill (`.agents/skills/x`, `` `$x` ``, ``skill `x` ``) that Codex cannot find. Notes when it exists in the wrong folder. |
| LA044 | large-skill | info | A skill over 20 KB; all of it enters context when used. |
| LA045 | skills-list-budget | info | Skill names and descriptions total more than about 8,000 characters (Codex's default initial list budget). |
| LA050 | instructions-not-versioned | info | `AGENTS.md`, `.codex` or `.agents` excluded via `.gitignore` or `.git/info/exclude`. |
| LA060 | generated-files-out-of-sync | warn / info | lean-agents projects only: generated files are stale (warn) or were edited by hand (info). |

## Sources for Codex behavior

The rules encode Codex behavior as documented in November 2026: one instruction file per folder with the override taking precedence, a 32 KiB default for `project_doc_max_bytes`, skill discovery under `.agents/skills`, the `[agents]` keys, and custom agent fields. If Codex changes, open an issue with a link to the docs.
