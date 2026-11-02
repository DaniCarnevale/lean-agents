# Architecture

## The shape

```
              user
               │
               ▼
        ┌─────────────┐   inline skills: $intake  $adr  $verify  $contract-first
        │  director   │◄─────────────────────────────────────────────────────
        │ (root, strong model, implements and integrates)                    
        └──────┬──────┘
   checkpoints │ only when a delegation condition holds, ≤ max_threads, depth 1
     ┌─────────┼──────────────┬──────────────────┐
     ▼         ▼              ▼                  ▼
 reviewer   explorer      ui_auditor        specialists
 read-only  read-only     read-only         workspace-write, declared domain only
 fresh ctx  cheap model   UI + a11y         never edits shared contracts
     └─────────┴──────────────┴──────────────────┘
                    HANDOFF (status, summary, files, checks, risks, next)
```

## Why a director that works, not a manager that delegates

Delegating has three costs that grow with every agent you add:

1. **Tokens.** Each subagent starts cold and rereads `AGENTS.md`, the relevant code and the brief, so the bill grows roughly linearly with the number of agents.
2. **Context loss.** A brief is a lossy compression of what the director knows. When the work is coupled (a contract change that touches the API, the audio pipeline and the UI), every handoff drops details the next agent needs.
3. **Latency and coordination.** Waiting, integrating and resolving conflicts all take turns.

Delegation pays for itself when it buys something the director cannot get alone:

- **Independence.** A reviewer with fresh context and a different model is less likely to share the author's blind spots.
- **Context hygiene.** Broad searches, long logs and benchmark output can be digested by a cheap explorer that returns a 30-line conclusion.
- **True parallelism.** Two pieces of work that share no files and no contract.

Those are the only delegation conditions in the generated `AGENTS.md`.

## Why procedures are skills

Intake (turning a request into an approvable draft) and ADRs used to be separate agents in many setups. As subagents they cost a cold start each, and intake cannot work as a subagent anyway. A subagent returns to its parent and stops; it cannot wait for the user's `APPROVED`. As skills, they run inside the director's context, load only when needed and keep the conversation with the user in one place.

## Why the sandbox, and not just the prompt

"Do not modify files" in a prompt is a request. `sandbox_mode = "read-only"` is a guarantee. Every role whose job is to find problems or answer questions runs read-only, so an over-eager reviewer cannot "just fix it" and leave the director integrating changes it never planned.

## Why the subagent guard

Codex gives subagents the same project instructions as the root session. If `AGENTS.md` says "you are the director; route new requests through intake", a subagent that reads it may refuse to implement, or try to orchestrate. The generated `AGENTS.md` puts the director protocol in its own section that starts with an explicit skip instruction for subagents, and every agent file repeats it.

## Why one config file

Hand-maintained agent setups drift. Two handoff formats, roles that overlap, keys that silently do nothing, skills in a folder nobody scans. A single `orchestration.toml` produces every file, and `doctor` checks both generated and hand-written setups against the same rules.

## Safety of generated files

- `sync` writes only files it created, and only while they match the lockfile hash.
- Hand edits and pre-existing files are skipped unless `--force` is passed, and `--force` always keeps a `.bak` copy.
- Files for removed roles or skills are deleted only if untouched.

## Non-goals

- A runtime or framework. lean-agents writes plain Codex configuration and gets out of the way.
- Swarms, recursive delegation or autonomous loops. `max_depth` is always 1.
- Shipping a large skill library. Four short, original skills cover the protocol; project-specific skills belong in the project.
