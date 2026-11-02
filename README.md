# lean-agents

**A lean, director-first orchestration standard for Codex subagents.**
One config file per project generates `AGENTS.md`, `.codex/config.toml`, custom agents and skills in the places Codex actually reads. `doctor` lints any Codex agent setup, whether or not lean-agents generated it.

[Español](README.es.md)

```bash
npx github:DaniCarnevale/lean-agents init      # detect stack, write orchestration.toml, generate files
npx github:DaniCarnevale/lean-agents doctor    # lint the setup (works on any repo)
```

## Why

Multi-agent setups fail in quiet ways. Here are real mistakes from a production-style repo, all now `doctor` rules:

| Mistake | What actually happens | Rule |
|---|---|---|
| `AGENTS.override.md` next to `AGENTS.md` | Codex loads only the override; the base rules (privacy, licenses, spending) are silently ignored | `LA010` |
| Skills in `.codex/skills/` | Codex scans `.agents/skills/`; the skills are never discovered | `LA040` |
| `[agents] max_concurrent_threads_per_session = 2` | Not a Codex key; the real limit stays at the default of 6 | `LA020` |
| Reviewer told "do not modify files" | Nothing enforces it without `sandbox_mode = "read-only"` | `LA035` |
| Director protocol in `AGENTS.md` | Subagents read it too, and may route work to intake or refuse to implement | `LA012` |
| Director on the fast model, a doc agent on the strongest | The role that plans and integrates gets the least capacity | `LA036` |

More agents is not more quality. Every subagent starts cold and rereads context, so token use grows with each one you add. Handing off tightly coupled work (one contract, three layers) also loses context at every boundary. Delegation pays off in three cases: **independent review with fresh context**, **read-only exploration that would pollute the main context**, and **specialist work that is truly independent**. lean-agents is built around that.

## Principles

1. **The director does the work.** The root session implements and integrates. Delegation is the exception and needs a reason.
2. **Few roles, enforced boundaries.** Reviewers and explorers are `read-only` by sandbox, not by politeness.
3. **One pass per subagent**, a fixed `HANDOFF` format, at most one follow-up and no retry loops.
4. **Procedures are skills, not agents.** Intake, ADRs, verification and contract-first run inline in the director's context, loaded on demand.
5. **Evidence over claims.** Generated rules forbid invented test results, and the `verify` skill reports what ran and what did not.
6. **Small instructions.** The generated `AGENTS.md` stays well under 8 KB because every agent pays for it on every turn.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reasoning.

## Install

Node.js 20+. Codex CLI with subagents enabled.

```bash
# Private repo: needs Git access to github.com/DaniCarnevale/lean-agents (SSH key or credential manager)
npx github:DaniCarnevale/lean-agents init

# Or pin it as a dev dependency
npm i -D github:DaniCarnevale/lean-agents#v0.1.0
npx lean-agents init
```

## Usage

```bash
lean-agents init [dir]     # create orchestration.toml (asks name, language, preset) and generate files
lean-agents sync [dir]     # regenerate files after editing orchestration.toml
lean-agents doctor [dir]   # lint; --json for CI, --strict to fail on warnings
lean-agents presets        # list presets and model aliases
```

`init` and `sync` never overwrite a file they did not create, or one you edited by hand. They show `skip`, and `--force` replaces the file while keeping a `.bak` copy. A lockfile (`.codex/lean-agents.lock.json`) records what was generated. Use `--dry-run` to preview.

### Generated layout

```
AGENTS.md                      project rules + verification + director protocol (with a subagent guard)
orchestration.toml             the only file you edit
.codex/config.toml             director model, [agents] max_threads / max_depth = 1, your [codex] extras
.codex/agents/reviewer.toml    read-only independent reviewer
.codex/agents/explorer.toml    read-only cheap explorer
.codex/agents/<specialist>.toml
.agents/skills/{intake,adr,verify,contract-first}/SKILL.md
```

## Configuration

```toml
schema = 1
language = "en"            # en | es: language of the generated instructions
preset = "standard"        # minimal | standard | web-fullstack

[project]
name = "my-app"
summary = "What this repo is, in one line."
sources_of_truth = ["contracts/", "docs/PLAN.md"]
rules = ["Never send customer data to third-party APIs without approval."]
verify = ["pnpm lint", "pnpm test", "uv run pytest"]

[project.docs]
status = "docs/STATUS.md"
adr = "docs/adr"

[models]
director = "strong"        # alias (strong | balanced | fast) or a concrete model id
director_effort = "high"

[models.aliases]           # optional: remap aliases when model names change
# strong = "gpt-6.1-sol"

[orchestration]
delegation = "checkpoints" # explicit: only when the user asks | checkpoints: reviewer/explorer on the director's initiative
max_threads = 2
intake = "ask"             # off | ask (only ambiguous or large changes) | always
keywords = true            # ORCHESTRATION SOLO / OFF / ON / STATUS

[roles.reviewer]
checklist = ["Public API stays backward compatible."]

[roles.explorer]
enabled = false            # turn off a preset role

[roles.payments]           # add a specialist
description = "Payments specialist: provider adapters, idempotency, webhooks and reconciliation."
focus = ["idempotency keys", "webhook signature checks"]
model = "strong"
effort = "high"
sandbox = "workspace-write"
instructions = "Never log card data."

[codex]                    # passed through to .codex/config.toml (MCP servers, approvals, …)
# approval_policy = "on-request"
# [codex.mcp_servers.docs]
# command = "docs-mcp"
```

### Presets

| Preset | Roles | Skills | Delegation |
|---|---|---|---|
| `minimal` | reviewer | intake, verify | explicit, 1 thread |
| `standard` | reviewer, explorer | intake, adr, verify | checkpoints, 2 threads |
| `web-fullstack` | reviewer, explorer, ui_auditor | intake, adr, verify, contract-first | checkpoints, 2 threads |

Model aliases (updated 2026-11): `strong` = `gpt-6.1-sol`, `balanced` = `gpt-6-sol`, `fast` = `gpt-6-luna`. Model catalogs change often; remap them in `[models.aliases]` without touching anything else.

## doctor

```
✖ error LA010 override-shadows-agents-md  AGENTS.override.md
         AGENTS.override.md and AGENTS.md live in the same folder (.). Codex loads only the override, ...
         fix: Merge both into one file. ...
```

It exits with 1 when there are errors (or warnings, with `--strict`), so it fits in CI. Full rule list: [docs/RULES.md](docs/RULES.md).

```yaml
# .github/workflows/agents.yml
- run: npx github:DaniCarnevale/lean-agents doctor --strict
```

## Example

[`examples/sts-to-tts`](examples/sts-to-tts) is a speech-translation POC (FastAPI + WebSocket + React + local STT/TTS). It was migrated from 7 agents and 13 skills, 2 errors and 12 warnings in `doctor`, to a director with 3 read-only helpers and 1 specialist, with zero findings.

## Limitations

- Codex documents that subagents spawn **when explicitly requested**. `delegation = "checkpoints"` gives the director standing permission in `AGENTS.md`, but whether Codex treats that as a request can depend on the version. If the director never delegates, ask for a role by name ("use reviewer on this diff").
- Keyword modes (`ORCHESTRATION OFF`) are a conversation convention, not a Codex feature. They can be lost after context compaction, so the instructions tell the director to assume OFF when unsure.
- The model tier table is a heuristic for `LA036` only. Unknown models are reported as info, never as errors.
- Measure before you scale. Run the same few real tasks with `ORCHESTRATION OFF` and with delegation, then compare tokens (`/status`), time and review findings.

## License

MIT © Daniel Carnevale. The skills are original and do not include third-party content.
