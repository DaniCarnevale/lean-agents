# Changelog

## 0.2.0 — 2026-11-02

- Claude Code support. `targets = ["claude"]`, `["codex"]` or both; `init --target` or an interactive question picks the tool.
- Claude Code output: `CLAUDE.md` (imports `AGENTS.md` when both tools are used), `.claude/agents/*.md` with tool allowlists for read-only roles and `disallowedTools: Agent` for specialists, `.claude/skills/`, `.claude/settings.json`.
- Model aliases and effort levels resolved per tool; `[models.aliases.<tool>]`; per-tool model tables.
- `[claude]` pass-through into `.claude/settings.json`; optional `claude_tools` per role.
- doctor: 17 Claude Code rules (LA101–LA142); subagent-guard and skill-reference checks cover both tools.
- Lockfile moved to `.lean-agents.lock.json` (the old `.codex/lean-agents.lock.json` is migrated automatically).
- README rewritten around what the tool does today.

## 0.1.0 — 2026-11-02

- `init`: detects verify commands, sources of truth and docs; writes `orchestration.toml`; generates files.
- `sync`: lockfile-based regeneration that never overwrites hand edits without `--force` (keeps `.bak`).
- `doctor`: 25 rules (LA001–LA060) for Codex agent setups, text and `--json` output, `--strict`.
- Presets `minimal`, `standard`, `web-fullstack`; built-in roles `reviewer`, `explorer`, `ui_auditor`; custom specialists.
- Original skills `intake`, `adr`, `verify`, `contract-first` in English and Spanish.
- Example: `examples/sts-to-tts`.
