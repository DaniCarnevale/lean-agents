# Architecture

## The shape

```
              user
               │
               ▼
        ┌─────────────┐   inline skills: intake · adr · verify · contract-first
        │  director   │◄──────────────────────────────────────────────────────
        │ main session, strongest model, implements and integrates
        └──────┬──────┘
               │ only when a delegation condition holds · ≤ max_threads · no nesting
     ┌─────────┼──────────────┬──────────────────┐
     ▼         ▼              ▼                  ▼
 reviewer   explorer      ui_auditor        specialists
 read-only  read-only     read-only         can write, declared domain only,
 fresh ctx  cheap model   UI + a11y         never edit shared contracts alone
     └─────────┴──────────────┴──────────────────┘
          HANDOFF (status, summary, files, checks, risks, next)
```

The same shape is generated for Claude Code and Codex. Only the file formats and the enforcement mechanisms change.

| Concept | Claude Code | Codex |
|---|---|---|
| Instructions | `CLAUDE.md` (imports `AGENTS.md` when both tools are used) | `AGENTS.md` |
| Role definition | `.claude/agents/<role>.md`, YAML frontmatter + body | `.codex/agents/<role>.toml` |
| Read-only | `tools: Read, Grep, Glob` (no Bash, no Agent) | `sandbox_mode = "read-only"` |
| No nested subagents | `disallowedTools: Agent` + `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` | `max_depth = 1` |
| Parallelism | stated in the instructions | `[agents] max_threads` |
| When to delegate | the description (Claude delegates on its own) | the instructions (Codex spawns on request) |
| Skills | `.claude/skills/` | `.agents/skills/` |

## Why the director does the work

Every subagent starts cold and rereads instructions, code and brief. Token use grows with each one, and a brief always carries less than the director knows. When work is coupled, for example a contract change that touches the API, a pipeline and the UI, each handoff loses details.

Delegation pays for itself in three cases, and those are the only delegation conditions in the generated instructions:

- **Independence.** A reviewer with fresh context, ideally on a different model, is less likely to share the author's blind spots.
- **Context hygiene.** Broad searches, long logs and benchmark output are digested by a cheap explorer that returns a short conclusion.
- **True parallelism.** Two pieces of work that share no files and no contract.

## Why procedures are skills

Intake turns a request into an approvable draft, and it has to wait for the user's approval. A subagent cannot do that: it returns to its parent and stops. ADRs and verification are procedures, not perspectives. As skills, they run inside the director's context, load only when needed, and keep the conversation with the user in one place.

## Why enforcement and not just prompts

"Do not modify files" in a prompt is a request. A tool allowlist (Claude Code) or a read-only sandbox (Codex) is a guarantee. Roles whose job is to find problems or answer questions are read-only, so an over-eager reviewer cannot "just fix it" and leave the director integrating changes it never planned.

## Why the subagent guard

Both tools give subagents the project instructions too. If those instructions say "you are the director; route new requests through intake", a subagent may refuse to implement or try to orchestrate. The director protocol therefore lives in its own section that opens with an explicit skip line for subagents, and every role definition repeats it.

## Why one config file

Hand-maintained setups drift: two handoff formats, overlapping roles, keys that silently do nothing, skills in folders nobody scans. A single `orchestration.toml` produces every file for every tool. `doctor` checks both generated and hand-written setups against the same rules.

## Safety of generated files

- `sync` only rewrites files it created, and only while they still match the hash in `.lean-agents.lock.json`.
- Hand edits and pre-existing files are skipped unless `--force` is passed, and `--force` always keeps a `.bak`.
- Files for removed roles, skills or tools are deleted only if untouched.
- Line endings are normalized, so a Windows checkout is not mistaken for an edit.

## Non-goals

- A runtime or framework. lean-agents writes plain tool configuration and gets out of the way.
- Swarms, recursive delegation or autonomous loops.
- A large skill library. Four short, original skills cover the protocol; project-specific skills belong in the project.
