# Changelog

## Unreleased

- Codex, aligned with its current docs. Run `sync` to update existing projects:
  - Generated files use `max_concurrent_threads_per_session` and no longer write `max_depth`, which Codex does not document, or `sandbox_mode` in agent files, which Codex ignores. Read-only and no-nesting rules for Codex subagents now rely on their instructions.
  - Effort levels: `max` reaches Codex as written, `ultra` is new (`max` in Claude Code), and `minimal` becomes `low`.
  - doctor: LA020 accepts every documented `[agents]` key, LA024 reports the legacy `max_threads`, LA038 reports agent settings that Codex ignores, and LA032 and LA033 now check `.codex/config.toml`. LA021 and LA035 are removed.
- `models.director_effort` now reaches Claude Code as `effortLevel` in `.claude/settings.json`. Claude Code does not accept `max` in that key, so `max` is written as `xhigh`. Run `sync` to update existing projects.
- `[claude].effortLevel` is now an error: use `models.director_effort`.
- doctor: LA122 (unknown `effortLevel`) and LA123 (`env.CLAUDE_CODE_EFFORT_LEVEL` overrides `effortLevel`).
- `init` uses `make check` only when the Makefile has a `check` target; otherwise it keeps detecting per ecosystem.
- `init` finds frontend and backend dependencies in workspace packages declared in `pnpm-workspace.yaml` or in the `workspaces` field of `package.json` (array or `{ packages: [...] }`). It supports `dir/*` and literal paths and ignores more complex patterns.
- CLI: `--key=value` splits on the first `=` only and accepts only `target`, `preset`, `lang` and `name`. Unknown options and boolean flags with a value, such as `--force=true`, exit with code 2.
- doctor: `runDoctor` split into one function per area and a single frontmatter reader, with the same findings.
- CI also runs on macOS and on pushes to `develop`.
- README: the repository is public, so installing from GitHub needs no special access.
- Unknown keys in `orchestration.toml` are warnings with a suggestion when one is close. `sync` and `init` print them, and doctor reports them as LA003, so they fail under `--strict`.

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
