import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";
import { REASONING_EFFORTS, tierOf, TIER_NAMES } from "./models.js";
import { SANDBOX_MODES, CONFIG_FILE, readConfig } from "./config.js";
import { sync } from "./sync.js";

// Codex defaults this to 32 KiB; instructions beyond it are silently dropped.
export const PROJECT_DOC_MAX_BYTES = 32 * 1024;
const KNOWN_AGENTS_KEYS = new Set(["max_threads", "max_depth", "job_max_runtime_seconds"]);
const KEY_SUGGESTIONS = {
  max_concurrent_threads_per_session: "max_threads",
  max_concurrent_threads: "max_threads",
  max_parallel: "max_threads",
  threads: "max_threads",
  depth: "max_depth",
  default_subagent_model: "`model` in each .codex/agents/*.toml file",
  default_subagent_reasoning_effort: "`model_reasoning_effort` in each .codex/agents/*.toml file",
  enabled: null, // no replacement needed: subagents are available without a flag
};
const SKIP_DIRS = new Set(["node_modules", ".git", ".venv", "venv", "dist", "build", ".uv-cache", ".next", "target", "__pycache__", ".pytest_cache"]);
const READ_ONLY_HINT = /(no modifiques|no edites|no implementes|no escribas|solo lectura|do not modify|don't modify|do not edit|don't edit|do not implement|read[- ]only|must not (modify|edit|write))/i;
const GUARD_HINT = /(subagent|subagente)[^\n]{0,200}(skip|salte|ignor|no aplica|does not apply|doesn't apply)|(skip|salte|ignor|no aplica|does not apply)[^\n]{0,200}(subagent|subagente)/i;
const ORCHESTRATION_HINT = /(director|orchestrat|orquest|delega)/i;

export const RULES = {
  LA001: "config-parse-error",
  LA002: "orchestration-config-invalid",
  LA010: "override-shadows-agents-md",
  LA011: "instructions-too-large",
  LA012: "subagent-guard-missing",
  LA020: "unknown-agents-key",
  LA021: "max-depth-above-one",
  LA022: "many-threads",
  LA023: "no-thread-limit",
  LA030: "agent-missing-field",
  LA031: "duplicate-agent-name",
  LA032: "invalid-sandbox-mode",
  LA033: "full-access-agent",
  LA034: "invalid-reasoning-effort",
  LA035: "read-only-role-without-sandbox",
  LA036: "director-weaker-than-subagent",
  LA037: "unknown-model",
  LA040: "skills-in-unscanned-folder",
  LA041: "skill-missing-frontmatter",
  LA042: "skill-name-mismatch",
  LA043: "missing-skill-reference",
  LA044: "large-skill",
  LA045: "skills-list-budget",
  LA050: "instructions-not-versioned",
  LA060: "generated-files-out-of-sync",
};

function walk(root, depth = 0, out = []) {
  if (depth > 6) return out;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(root, e.name), depth + 1, out);
    } else if (e.isFile()) {
      out.push(path.join(root, e.name));
    }
  }
  return out;
}

function readToml(abs, rel, add) {
  try {
    return parse(fs.readFileSync(abs, "utf8"));
  } catch (err) {
    add("LA001", "error", rel, `TOML parse error: ${err.message.split("\n")[0]}`, "Fix the syntax; Codex will fail to load or ignore this file.");
    return null;
  }
}

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return fields;
}

export function runDoctor(rootArg) {
  const root = path.resolve(rootArg);
  const findings = [];
  const add = (id, severity, file, message, fix) => findings.push({ id, rule: RULES[id], severity, file, message, fix });
  const rel = (abs) => path.relative(root, abs).split(path.sep).join("/") || ".";
  const files = walk(root);

  // ---- AGENTS.md / AGENTS.override.md -------------------------------------
  const byDir = new Map();
  for (const f of files) {
    const base = path.basename(f);
    if (base !== "AGENTS.md" && base !== "AGENTS.override.md") continue;
    const dir = path.dirname(f);
    if (!byDir.has(dir)) byDir.set(dir, {});
    byDir.get(dir)[base] = f;
  }
  const loaded = new Map(); // dir -> file Codex actually loads
  for (const [dir, pair] of byDir) {
    if (pair["AGENTS.override.md"] && pair["AGENTS.md"]) {
      add(
        "LA010",
        "error",
        rel(pair["AGENTS.override.md"]),
        `AGENTS.override.md and AGENTS.md live in the same folder (${rel(dir)}). Codex loads only the override, so ${rel(pair["AGENTS.md"])} is ignored, including any safety rules in it.`,
        "Merge both into one file. Keep AGENTS.override.md only for temporary personal overrides that repeat everything they need."
      );
    }
    loaded.set(dir, pair["AGENTS.override.md"] ?? pair["AGENTS.md"]);
  }
  for (const [dir] of loaded) {
    let total = 0;
    for (let d = dir; ; d = path.dirname(d)) {
      if (loaded.has(d)) total += fs.statSync(loaded.get(d)).size;
      if (d === root || !d.startsWith(root)) break;
    }
    if (total > PROJECT_DOC_MAX_BYTES) {
      add("LA011", "warn", rel(loaded.get(dir)), `Instructions loaded for ${rel(dir)} total ${total} bytes, above Codex's default project_doc_max_bytes (${PROJECT_DOC_MAX_BYTES}). The rest is dropped.`, "Move detail into skills (loaded on demand) or raise project_doc_max_bytes knowingly.");
    } else if (total > 16 * 1024) {
      add("LA011", "info", rel(loaded.get(dir)), `Instructions loaded for ${rel(dir)} total ${total} bytes; this is paid on every turn of every agent.`, "Consider moving procedures into skills.");
    }
  }
  const rootInstr = loaded.get(root);
  const rootText = rootInstr ? fs.readFileSync(rootInstr, "utf8") : "";

  // ---- .codex/config.toml ---------------------------------------------------
  const configAbs = path.join(root, ".codex/config.toml");
  let codexConfig = null;
  if (fs.existsSync(configAbs)) {
    codexConfig = readToml(configAbs, ".codex/config.toml", add);
    const agents = codexConfig?.agents;
    if (agents && typeof agents === "object") {
      for (const [key, value] of Object.entries(agents)) {
        if (value && typeof value === "object" && !Array.isArray(value)) continue; // [agents.<name>] tables
        if (KNOWN_AGENTS_KEYS.has(key)) continue;
        const hint =
          key in KEY_SUGGESTIONS
            ? KEY_SUGGESTIONS[key]
              ? ` Use ${KEY_SUGGESTIONS[key]} instead.`
              : " Remove it: subagents need no enable flag."
            : "";
        add("LA020", "warn", ".codex/config.toml", `[agents].${key} is not a documented Codex setting and is most likely ignored.${hint}`, `Known keys: ${[...KNOWN_AGENTS_KEYS].join(", ")}.`);
      }
      if (typeof agents.max_depth === "number" && agents.max_depth > 1) {
        add("LA021", "warn", ".codex/config.toml", `max_depth = ${agents.max_depth} lets subagents spawn subagents; token use and latency grow quickly.`, "Keep max_depth = 1 unless you have measured a benefit.");
      }
      if (typeof agents.max_threads === "number" && agents.max_threads > 4) {
        add("LA022", "info", ".codex/config.toml", `max_threads = ${agents.max_threads}. Token use grows roughly linearly with concurrent agents.`, "2 is usually enough for review + exploration.");
      }
    }
    if (codexConfig?.model_reasoning_effort && !REASONING_EFFORTS.includes(codexConfig.model_reasoning_effort)) {
      add("LA034", "warn", ".codex/config.toml", `model_reasoning_effort = "${codexConfig.model_reasoning_effort}" is not a known level.`, `Use one of ${REASONING_EFFORTS.join(", ")}.`);
    }
  }

  // ---- .codex/agents/*.toml ------------------------------------------------
  const agentDir = path.join(root, ".codex/agents");
  const agents = [];
  if (fs.existsSync(agentDir)) {
    for (const f of fs.readdirSync(agentDir).filter((n) => n.endsWith(".toml")).sort()) {
      const abs = path.join(agentDir, f);
      const r = rel(abs);
      const data = readToml(abs, r, add);
      if (!data) continue;
      agents.push({ file: r, data });
      for (const field of ["name", "description", "developer_instructions"]) {
        if (!data[field]) add("LA030", "error", r, `Missing required field "${field}".`, "Codex needs name, description and developer_instructions for a custom agent.");
      }
      if (data.sandbox_mode && !SANDBOX_MODES.includes(data.sandbox_mode)) {
        add("LA032", "error", r, `sandbox_mode = "${data.sandbox_mode}" is not valid.`, `Use one of ${SANDBOX_MODES.join(", ")}.`);
      }
      if (data.sandbox_mode === "danger-full-access") {
        add("LA033", "warn", r, "This agent runs with danger-full-access.", "Prefer workspace-write; subagents rarely need full access.");
      }
      if (data.model_reasoning_effort && !REASONING_EFFORTS.includes(data.model_reasoning_effort)) {
        add("LA034", "warn", r, `model_reasoning_effort = "${data.model_reasoning_effort}" is not a known level.`, `Use one of ${REASONING_EFFORTS.join(", ")}.`);
      }
      const instr = String(data.developer_instructions ?? "");
      if (READ_ONLY_HINT.test(instr) && data.sandbox_mode !== "read-only") {
        add("LA035", "warn", r, `"${data.name ?? f}" is told not to modify files, but nothing enforces it.`, 'Add sandbox_mode = "read-only".');
      }
      if (data.model && tierOf(data.model) === undefined) {
        add("LA037", "info", r, `Model "${data.model}" is not in lean-agents' tier table, so tier checks were skipped.`, "Fine if the id is valid for your Codex account.");
      }
    }
    const seen = new Map();
    for (const a of agents) {
      const n = a.data.name;
      if (!n) continue;
      if (seen.has(n)) add("LA031", "error", a.file, `Agent name "${n}" is also used by ${seen.get(n)}.`, "Names must be unique.");
      else seen.set(n, a.file);
    }
    if (agents.length && !(codexConfig?.agents && "max_threads" in codexConfig.agents)) {
      add("LA023", "info", ".codex/config.toml", "Custom agents exist but [agents].max_threads is not set (Codex default: 6).", "Set max_threads to the parallelism you actually want, e.g. 2.");
    }
    const director = codexConfig?.model;
    const dTier = tierOf(director);
    if (dTier) {
      for (const a of agents) {
        const t = tierOf(a.data.model);
        if (t && t > dTier) {
          add("LA036", "info", a.file, `"${a.data.name}" uses ${a.data.model} (${TIER_NAMES[t]}) while the director uses ${director} (${TIER_NAMES[dTier]}).`, "The director plans and integrates; it usually deserves the strongest model.");
        }
      }
    }
    if (agents.length && ORCHESTRATION_HINT.test(rootText)) {
      const guarded = GUARD_HINT.test(rootText) || agents.every((a) => GUARD_HINT.test(String(a.data.developer_instructions ?? "")));
      if (!guarded) {
        add("LA012", "warn", rootInstr ? rel(rootInstr) : "AGENTS.md", "Root instructions contain a director/orchestration protocol, but nothing tells subagents to skip it. Subagents may try to act as director, route to intake or refuse to implement.", "Add a line such as: \"If you are a subagent, skip the Orchestration section\", or say it in each agent's developer_instructions.");
      }
    }
  }

  // ---- Skills ---------------------------------------------------------------
  const skills = new Map(); // name -> file (only scanned locations)
  let descriptionChars = 0;
  const misplaced = [];
  for (const f of files) {
    if (path.basename(f) !== "SKILL.md") continue;
    const r = rel(f);
    if (/(^|\/)\.codex\/skills\//.test(r)) {
      misplaced.push(r);
      continue;
    }
    if (!/(^|\/)\.agents\/skills\//.test(r)) continue;
    const text = fs.readFileSync(f, "utf8");
    const fm = frontmatter(text);
    if (!fm?.name || !fm?.description) {
      add("LA041", "error", r, "SKILL.md needs YAML frontmatter with name and description.", "Add ---\\nname: ...\\ndescription: ...\\n--- at the top.");
      continue;
    }
    const dirName = path.basename(path.dirname(f));
    if (fm.name !== dirName) add("LA042", "warn", r, `Skill name "${fm.name}" differs from its folder "${dirName}".`, "Keep them equal to avoid confusing references.");
    skills.set(fm.name, r);
    descriptionChars += fm.description.length + fm.name.length;
    const size = Buffer.byteLength(text);
    if (size > 20 * 1024) add("LA044", "info", r, `Skill is ${size} bytes; all of it enters context when used.`, "Split rarely needed parts into referenced files.");
  }
  if (misplaced.length) {
    const folders = [...new Set(misplaced.map((m) => m.replace(/\/skills\/.*$/, "/skills")))];
    add("LA040", "error", folders.join(", "), `${misplaced.length} skill(s) live under .codex/skills, which Codex does not scan: it never sees their names or descriptions.`, "Move each folder to .agents/skills/<name>/SKILL.md.");
  }
  if (descriptionChars > 8000) {
    add("LA045", "info", ".agents/skills", `Skill names+descriptions total ~${descriptionChars} chars; Codex's initial skill list budget is about 8,000 chars by default, so some may be shortened or omitted.`, "Remove unused skills or tighten descriptions.");
  }
  const allSkillDirs = new Set(
    files.filter((f) => path.basename(f) === "SKILL.md").map((f) => path.basename(path.dirname(f)))
  );
  const texts = [...loaded.values()].map((f) => ({ file: rel(f), text: fs.readFileSync(f, "utf8") }));
  for (const a of agents) texts.push({ file: a.file, text: String(a.data.developer_instructions ?? "") });
  for (const { file, text } of texts) {
    const refs = new Set();
    for (const m of text.matchAll(/\.(?:codex|agents)\/skills\/([A-Za-z0-9_-]+)/g)) refs.add(m[1]);
    for (const m of text.matchAll(/`\$([a-z][a-z0-9-]+)`/g)) refs.add(m[1]);
    for (const m of text.matchAll(/skill\s+`([a-z][a-z0-9-]+)`/gi)) refs.add(m[1]);
    for (const ref of refs) {
      if (skills.has(ref)) continue;
      const where = allSkillDirs.has(ref) ? " It exists, but outside .agents/skills, so Codex cannot discover it." : "";
      add("LA043", "warn", file, `References skill "${ref}", which Codex cannot find.${where}`, "Create it under .agents/skills/ or remove the reference.");
    }
  }

  // ---- Versioning -----------------------------------------------------------
  const ignoreSources = [".gitignore", ".git/info/exclude"].filter((f) => fs.existsSync(path.join(root, f)));
  for (const src of ignoreSources) {
    const lines = fs.readFileSync(path.join(root, src), "utf8").split(/\r?\n/).map((l) => l.trim());
    const hits = lines.filter((l) => /^\/?(AGENTS(\.override)?\.md|\.codex\/?|\.codex\/agents|\.agents\/?)/.test(l));
    if (hits.length) {
      add("LA050", "info", src, `Agent instructions are excluded from Git (${hits.join(", ")}). Fresh clones, worktrees and teammates get no instructions.`, "Version shared rules; keep only personal tweaks out of Git.");
    }
  }

  // ---- lean-agents managed projects ---------------------------------------
  if (fs.existsSync(path.join(root, CONFIG_FILE))) {
    try {
      const cfg = readConfig(root);
      const plan = sync(root, cfg, { dryRun: true });
      const pending = plan.filter((a) => ["create", "update", "delete"].includes(a.type));
      const edited = plan.filter((a) => a.type === "skip" || a.type === "orphan");
      if (pending.length) {
        add("LA060", "warn", CONFIG_FILE, `${pending.length} generated file(s) are out of date: ${pending.map((a) => a.rel).join(", ")}.`, "Run `npx lean-agents sync`.");
      }
      for (const a of edited) {
        add("LA060", "info", a.rel, `Not managed by sync: ${a.reason}.`, "Move the change into orchestration.toml, or run `sync --force` (a .bak copy is kept).");
      }
    } catch (err) {
      add("LA002", "error", CONFIG_FILE, err.message, "Fix orchestration.toml.");
    }
  }

  const order = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id));
  return { root, findings };
}
