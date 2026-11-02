# lean-agents

**Director-first agent setup for Claude Code and Codex.**

[Leer en español](README.es.md)

lean-agents sets up a small, disciplined team of AI coding agents in any repository. You answer a few questions, and it generates everything your tool needs: project instructions, subagents, skills and settings, in the places Claude Code and Codex actually read. Then `doctor` checks that the setup works.

```bash
npx github:DaniCarnevale/lean-agents init --target claude   # Claude Code
npx github:DaniCarnevale/lean-agents init --target codex    # Codex
npx github:DaniCarnevale/lean-agents init --target both     # both tools, one shared source
```

## What you get

- **A director.** Your main session plans, implements and integrates the work. It delegates only when that adds something: an independent review, a read-only search that would clutter its context, or specialist work that is truly separate.
- **A few helpers with real limits.**
  - `reviewer`: reviews diffs with fresh context.
  - `explorer`: cheap read-only searches through code and logs.
  - `ui_auditor`: UI and accessibility audits.
  - Any specialists you declare yourself.

  Read-only roles are enforced by the tool's own permissions, not by asking nicely.
- **Skills for the recurring procedures.**
  - `intake`: turns a request into a short draft to approve.
  - `adr`: records architecture decisions.
  - `verify`: checks a change before closing it.
  - `contract-first`: changes shared APIs starting from the contract.
- **One config file**, `orchestration.toml`. You edit it, run `sync`, and every generated file stays consistent.
- **A linter.** `doctor` validates any Claude Code or Codex agent setup in a repo, whether lean-agents generated it or not, and fits in CI.

## Choose your tool

| | Claude Code | Codex |
|---|---|---|
| Project instructions | `CLAUDE.md` | `AGENTS.md` |
| Subagents | `.claude/agents/*.md` | `.codex/agents/*.toml` |
| Skills | `.claude/skills/<name>/SKILL.md` (run with `/<name>`) | `.agents/skills/<name>/SKILL.md` (run with `$<name>`) |
| Settings | `.claude/settings.json` (director model, no nested subagents) | `.codex/config.toml` (director model, `max_threads`, `max_depth = 1`) |
| Read-only roles | `tools: Read, Grep, Glob` | `sandbox_mode = "read-only"` |
| Default models (`strong` / `balanced` / `fast`) | `opus` / `sonnet` / `haiku` | `gpt-6.1-sol` / `gpt-6-sol` / `gpt-6-luna` |

With `--target both`, `AGENTS.md` holds the instructions and `CLAUDE.md` imports it (`@AGENTS.md`), so both tools follow the same rules. Each tool gets its own agents and skills folders.

If you omit `--target`, `init` asks. Its suggestion is based on what the repo already has: a `CLAUDE.md` or `.claude/` folder points to Claude Code, an `AGENTS.md` or `.codex/` folder points to Codex. You can change tools later: edit `targets` in `orchestration.toml` and run `sync`.

## Install

Requirements: Node.js 20+, plus Claude Code and/or Codex CLI.

```bash
# Run it once per project, no install needed
npx github:DaniCarnevale/lean-agents init

# Or keep it as a dev dependency, pinned to a version
npm i -D github:DaniCarnevale/lean-agents#v0.2.0
npx lean-agents init
```

The repository is private for now. Installing from GitHub needs Git access to it (SSH key or a credential manager).

## Quick start

1. In your project folder, run `npx github:DaniCarnevale/lean-agents init`.
2. Answer the questions: tool (`claude`, `codex` or `both`), project name, language of the instructions (`en` or `es`) and preset. It detects your test commands and contract folders on its own.
3. Open `orchestration.toml`. Add your project rules and specialists, and check the `verify` commands.
4. Run `npx lean-agents sync`, then `npx lean-agents doctor`.
5. Commit the generated files so everyone who clones the repo gets the same agents.

## Working with the agents

**In Claude Code**

- Start `claude` in the project. Run `/context` to confirm `CLAUDE.md` loaded.
- Claude delegates on its own, based on each subagent's description. With `delegation = "checkpoints"`, `reviewer` and `explorer` are marked "use proactively". With `explicit`, they run only when you ask.
- Ask for a role by name (*"use the reviewer subagent on this diff"*), or @-mention it (`@agent-reviewer`) to make sure it runs.
- Run skills with `/intake`, `/verify`, `/adr`.

**In Codex**

- Start `codex` in the project. Project agents load only when you trust the project.
- Codex starts subagents only when asked, so ask for them: *"spawn reviewer on the current diff"*.
- Run skills with `$intake`, `$verify`, `$adr`.

**In both tools**

- Subagents answer with a fixed `HANDOFF` block (status, summary, files, checks, risks, next) after a single pass.
- New behavior changes go through `intake` when they are ambiguous or large. Write `APPROVED` to approve a draft, or say "skip intake" to go straight to the work.
- Conversation keywords:
  - `ORCHESTRATION SOLO`: no delegation in this turn.
  - `ORCHESTRATION OFF` / `ON`: turns delegation off or on until further notice.
  - `ORCHESTRATION STATUS`: reports the current mode.

## Commands

```bash
lean-agents init [dir]     # ask tool + preset, write orchestration.toml, generate files
lean-agents sync [dir]     # regenerate after editing orchestration.toml
lean-agents doctor [dir]   # lint the setup; --json for CI, --strict to fail on warnings
lean-agents presets        # list presets and model aliases per tool
```

| Option | Applies to | Meaning |
|---|---|---|
| `--target claude\|codex\|both` | init | Tool(s) to generate for |
| `--preset minimal\|standard\|web-fullstack` | init | Starting set of roles and skills |
| `--lang en\|es` | init | Language of the generated instructions |
| `--name <name>` | init | Project name (default: folder name) |
| `-y`, `--yes` | init | Accept detected defaults without questions |
| `--dry-run` | init, sync | Show the plan, write nothing |
| `--force` | init, sync | Replace files lean-agents did not create or that you edited (keeps a `.bak`) |
| `--json`, `--strict` | doctor | Machine-readable output / exit 1 on warnings |

`sync` never overwrites a file it did not create, or one you edited by hand, unless you pass `--force`. Generated files are tracked in `.lean-agents.lock.json`.

## Configuration

```toml
schema = 1
targets = ["claude", "codex"]   # "claude", "codex" or both
language = "en"                 # en | es
preset = "standard"             # minimal | standard | web-fullstack

[project]
name = "my-app"
summary = "What this repo is, in one line."
sources_of_truth = ["contracts/", "docs/PLAN.md"]
rules = ["Never send customer data to third-party APIs without approval."]
verify = ["pnpm lint", "pnpm test"]

[project.docs]
status = "docs/STATUS.md"
adr = "docs/adr"

[models]
director = "strong"             # alias, or { claude = "claude-opus-5-5", codex = "gpt-6.1-sol" }
director_effort = "high"        # minimal | low | medium | high | xhigh | max (mapped per tool)

[models.aliases.claude]         # optional: remap an alias for one tool
# balanced = "sonnet"

[orchestration]
delegation = "checkpoints"      # explicit: only when asked | checkpoints: reviewer/explorer at checkpoints
max_threads = 2                 # parallel subagents
intake = "ask"                  # off | ask (ambiguous or large changes) | always
keywords = true                 # ORCHESTRATION SOLO / OFF / ON / STATUS

[roles.reviewer]
checklist = ["Public API stays backward compatible."]

[roles.explorer]
enabled = false                 # turn off a preset role

[roles.payments]                # add a specialist
description = "Payments specialist: provider adapters, idempotency, webhooks and reconciliation."
focus = ["idempotency keys", "webhook signature checks"]
model = "strong"
effort = "high"
sandbox = "workspace-write"     # or "read-only"
instructions = "Never log card data."
# claude_tools = ["Read", "Grep", "Glob", "Bash"]   # optional explicit tool list for Claude Code

[claude]                        # merged into .claude/settings.json
# [claude.permissions]
# deny = ["Read(./.env)"]

[codex]                         # merged into .codex/config.toml
# approval_policy = "on-request"
```

### Presets

| Preset | Roles | Skills | Delegation |
|---|---|---|---|
| `minimal` | reviewer | intake, verify | explicit, 1 thread |
| `standard` | reviewer, explorer | intake, adr, verify | checkpoints, 2 threads |
| `web-fullstack` | reviewer, explorer, ui_auditor | intake, adr, verify, contract-first | checkpoints, 2 threads |

## doctor

`doctor` reads the agent setup of any repo and reports problems with a rule id, the file and a fix. Some examples:

- **Claude Code:**
  - a `CLAUDE.md` that hides `AGENTS.md`;
  - subagents without `name` or `description`;
  - read-only roles that can still write;
  - subagents that can start their own subagents;
  - skills Claude Code cannot see.
- **Codex:**
  - an `AGENTS.override.md` that hides `AGENTS.md`;
  - skills in a folder Codex does not scan;
  - unknown `[agents]` keys;
  - read-only roles without a sandbox;
  - instructions over the size limit.
- **Both:**
  - a director protocol that subagents also read, with no line telling them to skip it;
  - a subagent on a stronger model than the director;
  - generated files that drifted from `orchestration.toml`.

```yaml
# CI
- run: npx github:DaniCarnevale/lean-agents doctor --strict
```

The full list is in [docs/RULES.md](docs/RULES.md). It exits with 1 on errors, or also on warnings with `--strict`.

## Example

[`examples/sts-to-tts`](examples/sts-to-tts) is a complete project configured for both tools: a speech-translation POC with a FastAPI + WebSocket backend and a React frontend. It shows a reviewer checklist, an audio specialist, project rules and the generated files.

## Good to know

- Model names change often. Aliases (`strong`, `balanced`, `fast`) keep your config stable; remap them in `[models.aliases.<tool>]`.
- The `ORCHESTRATION` keywords are a conversation convention, not a tool feature. The instructions tell the director to assume OFF when it is unsure.
- In Claude Code, read-only roles have no terminal, so the director runs the checks that need commands. Give a role `claude_tools` if you want it to run them, knowing that Bash can also write.
- More agents is not more quality. Measure before you scale: run a few real tasks with `ORCHESTRATION OFF` and with delegation, and compare time, tokens and review findings.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reasoning behind the design.

## License

MIT © Daniel Carnevale.
