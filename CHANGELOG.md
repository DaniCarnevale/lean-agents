# Changelog

## 0.1.0 — 2026-11-02

- `init`: detects verify commands, sources of truth and docs; writes `orchestration.toml`; generates files.
- `sync`: lockfile-based regeneration that never overwrites hand edits without `--force` (keeps `.bak`).
- `doctor`: 25 rules (LA001–LA060) for Codex agent setups, text and `--json` output, `--strict`.
- Presets `minimal`, `standard`, `web-fullstack`; built-in roles `reviewer`, `explorer`, `ui_auditor`; custom specialists.
- Original skills `intake`, `adr`, `verify`, `contract-first` in English and Spanish.
- Example: `examples/sts-to-tts`.
