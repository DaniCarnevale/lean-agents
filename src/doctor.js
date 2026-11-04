import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";
import { TARGET_EFFORTS, CLAUDE_SETTINGS_EFFORTS, tierOf, TIER_NAMES } from "./models.js";
import { SANDBOX_MODES, CONFIG_FILE, readConfig } from "./config.js";
import { sync } from "./sync.js";

const CODEX_EFFORTS = TARGET_EFFORTS.codex;
const CLAUDE_EFFORTS = TARGET_EFFORTS.claude;
const CLAUDE_MODEL_ALIASES = ["sonnet", "opus", "haiku", "fable", "inherit"];
const CLAUDE_PERMISSION_MODES = ["default", "acceptEdits", "auto", "dontAsk", "bypassPermissions", "plan", "manual"];
const CLAUDE_WRITE_TOOLS = ["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"];

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
  LA003: "orchestration-unknown-key",
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
  LA101: "claude-frontmatter-invalid",
  LA110: "claude-md-hides-agents-md",
  LA111: "claude-md-long",
  LA120: "claude-settings-invalid",
  LA121: "claude-nested-subagents",
  LA122: "claude-invalid-effort-level",
  LA123: "claude-effort-env-override",
  LA130: "claude-agent-missing-field",
  LA131: "claude-duplicate-agent-name",
  LA132: "claude-agent-invalid-name",
  LA133: "claude-unknown-model",
  LA134: "claude-invalid-effort",
  LA135: "claude-invalid-permission-mode",
  LA136: "claude-read-only-role-without-tool-limits",
  LA137: "claude-director-weaker-than-subagent",
  LA138: "claude-agent-descriptions-budget",
  LA140: "claude-skills-not-shared",
  LA141: "claude-skill-missing-description",
  LA142: "claude-skill-description-truncated",
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

export function runDoctor(rootArg) {
  const root = path.resolve(rootArg);
  const findings = [];
  const add = (id, severity, file, message, fix) => findings.push({ id, rule: RULES[id], severity, file, message, fix });
  const rel = (abs) => path.relative(root, abs).split(path.sep).join("/") || ".";
  const ctx = { root, files: walk(root), rel, add };

  const { loaded, rootInstr, rootText } = checkInstructions(ctx);
  const codexConfig = checkCodexConfig(ctx);
  const agents = checkCodexAgents(ctx, codexConfig);
  const claude = checkClaude(ctx, rootText);
  checkSubagentGuard(ctx, { agents, claude, rootInstr, rootText });
  checkSkills(ctx, { loaded, agents, claude });
  checkVersioning(ctx);
  checkManagedProject(ctx);

  const order = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id));
  return { root, findings };
}

// AGENTS.md / AGENTS.override.md
function checkInstructions({ root, files, rel, add }) {
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
  return { loaded, rootInstr, rootText };
}

// .codex/config.toml
function checkCodexConfig({ root, add }) {
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
    if (codexConfig?.model_reasoning_effort && !CODEX_EFFORTS.includes(codexConfig.model_reasoning_effort)) {
      add("LA034", "warn", ".codex/config.toml", `model_reasoning_effort = "${codexConfig.model_reasoning_effort}" is not a known level.`, `Use one of ${CODEX_EFFORTS.join(", ")}.`);
    }
  }

  return codexConfig;
}

// .codex/agents/*.toml
function checkCodexAgents({ root, rel, add }, codexConfig) {
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
      if (data.model_reasoning_effort && !CODEX_EFFORTS.includes(data.model_reasoning_effort)) {
        add("LA034", "warn", r, `model_reasoning_effort = "${data.model_reasoning_effort}" is not a known level.`, `Use one of ${CODEX_EFFORTS.join(", ")}.`);
      }
      const instr = String(data.developer_instructions ?? "");
      if (READ_ONLY_HINT.test(instr) && data.sandbox_mode !== "read-only") {
        add("LA035", "warn", r, `"${data.name ?? f}" is told not to modify files, but nothing enforces it.`, 'Add sandbox_mode = "read-only".');
      }
      if (data.model && tierOf("codex", data.model) === undefined) {
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
    const dTier = tierOf("codex", director);
    if (dTier) {
      for (const a of agents) {
        const t = tierOf("codex", a.data.model);
        if (t && t > dTier) {
          add("LA036", "info", a.file, `"${a.data.name}" uses ${a.data.model} (${TIER_NAMES[t]}) while the director uses ${director} (${TIER_NAMES[dTier]}).`, "The director plans and integrates; it usually deserves the strongest model.");
        }
      }
    }
  }

  return agents;
}

// Both tools give subagents the project instructions too.
function checkSubagentGuard({ rel, add }, { agents, claude, rootInstr, rootText }) {
  const guardChecks = [
    { agents: agents.map((a) => String(a.data.developer_instructions ?? "")), text: rootText, file: rootInstr ? rel(rootInstr) : "AGENTS.md" },
    { agents: claude.agents.map((a) => a.body), text: claude.instructions, file: claude.instructionsFile },
  ];
  for (const g of guardChecks) {
    if (!g.agents.length || !ORCHESTRATION_HINT.test(g.text)) continue;
    const guarded = GUARD_HINT.test(g.text) || g.agents.every((b) => GUARD_HINT.test(b));
    if (!guarded) {
      add("LA012", "warn", g.file, "Project instructions contain a director/orchestration protocol, but nothing tells subagents to skip it. Subagents also read these instructions and may try to act as director, route to intake or refuse to implement.", "Add a line such as: \"If you are a subagent, skip the Orchestration section\", or say it in each agent's own instructions.");
    }
  }

}

function checkSkills({ files, rel, add }, { loaded, agents, claude }) {
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
    if (/(^|\/)\.claude\/skills\//.test(r)) {
      const fm = parseFrontmatter(fs.readFileSync(f, "utf8"))?.fields;
      const name = fm?.name || path.basename(path.dirname(f));
      if (fm) skills.set(name, r);
      continue; // validated in checkClaude
    }
    if (!/(^|\/)\.agents\/skills\//.test(r)) continue;
    const text = fs.readFileSync(f, "utf8");
    const fm = parseFrontmatter(text)?.fields;
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
  if (claude.instructionsFile && claude.instructions) texts.push({ file: claude.instructionsFile, text: claude.instructions });
  for (const a of claude.agents) texts.push({ file: a.file, text: a.body });
  for (const { file, text } of texts) {
    const refs = new Set();
    for (const m of text.matchAll(/\.(?:codex|agents)\/skills\/([A-Za-z0-9_-]+)/g)) refs.add(m[1]);
    for (const m of text.matchAll(/`\$([a-z][a-z0-9-]+)`/g)) refs.add(m[1]);
    for (const m of text.matchAll(/skill\s+`([a-z][a-z0-9-]+)`/gi)) refs.add(m[1]);
    for (const ref of refs) {
      if (skills.has(ref)) continue;
      const where = allSkillDirs.has(ref) ? " It exists, but outside .agents/skills (Codex) and .claude/skills (Claude Code), so neither tool discovers it." : "";
      add("LA043", "warn", file, `References skill "${ref}", which neither Codex nor Claude Code can find.${where}`, "Create it under .agents/skills/ (Codex) or .claude/skills/ (Claude Code), or remove the reference.");
    }
  }

}

function checkVersioning({ root, add }) {
  const ignoreSources = [".gitignore", ".git/info/exclude"].filter((f) => fs.existsSync(path.join(root, f)));
  for (const src of ignoreSources) {
    const lines = fs.readFileSync(path.join(root, src), "utf8").split(/\r?\n/).map((l) => l.trim());
    const hits = lines.filter(
      (l) =>
        /^\/?(AGENTS(\.override)?\.md|CLAUDE\.md|\.codex(\/|$)|\.agents(\/|$)|\.claude(\/|$))/.test(l) &&
        !/settings\.local\.json|worktrees|\.local\.md/.test(l)
    );
    if (hits.length) {
      add("LA050", "info", src, `Agent instructions are excluded from Git (${hits.join(", ")}). Fresh clones, worktrees and teammates get no instructions.`, "Version shared rules; keep only personal tweaks out of Git.");
    }
  }

}

// Only for projects that lean-agents manages.
function checkManagedProject({ root, add }) {
  if (fs.existsSync(path.join(root, CONFIG_FILE))) {
    const addUnknownKeys = (warnings = []) => {
      for (const w of warnings) add("LA003", "warn", CONFIG_FILE, w, "Fix the key name, or remove it if it belongs to another lean-agents version.");
    };
    try {
      const cfg = readConfig(root);
      addUnknownKeys(cfg.warnings);
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
      addUnknownKeys(err.warnings);
      add("LA002", "error", CONFIG_FILE, err.message, "Fix orchestration.toml.");
    }
  }
}

// ---- Claude Code ---------------------------------------------------------------

// Minimal YAML frontmatter reader: `key: value`, quoted strings, inline lists
// ([a, b]) and block lists (- a). Enough for agent and skill headers.
export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== "---") return null;
  const end = lines.indexOf("---", 1) === -1 ? lines.findIndex((l, i) => i > 0 && l.trim() === "---") : lines.indexOf("---", 1);
  if (end === -1) return null;
  const fields = {};
  let lastKey = null;
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && lastKey) {
      if (!Array.isArray(fields[lastKey])) fields[lastKey] = [];
      fields[lastKey].push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    lastKey = kv[1];
    const v = kv[2].trim();
    if (v.startsWith("[") && v.endsWith("]")) fields[lastKey] = v.slice(1, -1).split(",").map((x) => unquote(x.trim())).filter(Boolean);
    else fields[lastKey] = v === "" ? "" : unquote(v);
  }
  return { fields, body: lines.slice(end + 1).join("\n") };
}

function unquote(v) {
  if (v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

const toolList = (v) => (v === undefined || v === "" ? null : Array.isArray(v) ? v : String(v).split(/[\s,]+/).filter(Boolean));
const toolName = (t) => t.replace(/\(.*$/, "");

function checkClaude({ root, files, rel, add }, agentsMdText) {
  const result = { agents: [], instructions: "", instructionsFile: null };
  const claudeMd = ["CLAUDE.md", ".claude/CLAUDE.md"].map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
  const agentsMd = path.join(root, "AGENTS.md");
  const usesClaude = Boolean(claudeMd) || fs.existsSync(path.join(root, ".claude"));
  if (!usesClaude) return result;

  // Instructions: CLAUDE.md wins over AGENTS.md unless it imports it.
  if (claudeMd) {
    const text = fs.readFileSync(claudeMd, "utf8");
    const outsideCode = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
    const importsAgents = /(^|\s)@(\.\/)?AGENTS\.md\b/m.test(outsideCode);
    result.instructionsFile = rel(claudeMd);
    result.instructions = importsAgents ? `${agentsMdText}\n${text}` : text;
    if (fs.existsSync(agentsMd) && !importsAgents) {
      add("LA110", "warn", rel(claudeMd), "CLAUDE.md and AGENTS.md both exist and CLAUDE.md does not import AGENTS.md. Claude Code reads only CLAUDE.md here, so the rules in AGENTS.md never reach Claude.", "Add a line `@AGENTS.md` at the top of CLAUDE.md (outside code blocks) so both tools share one source.");
    }
    const lines = result.instructions.split(/\r?\n/).length;
    if (lines > 200) {
      add("LA111", "info", rel(claudeMd), `Claude Code loads ~${lines} lines of instructions every session (imports included); its docs recommend under 200 per CLAUDE.md.`, "Move procedures into skills and part-specific rules into .claude/rules/.");
    }
  } else if (fs.existsSync(agentsMd)) {
    result.instructionsFile = "AGENTS.md";
    result.instructions = agentsMdText;
  }

  // Settings.
  let settings = null;
  const settingsAbs = path.join(root, ".claude/settings.json");
  if (fs.existsSync(settingsAbs)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsAbs, "utf8"));
    } catch (err) {
      add("LA120", "error", ".claude/settings.json", `Invalid JSON: ${err.message}`, "Claude Code reports a Settings Error and may skip the whole file. Fix the syntax (no comments, no trailing commas).");
    }
  }
  const effortLevel = settings?.effortLevel;
  if (effortLevel !== undefined && !CLAUDE_SETTINGS_EFFORTS.includes(effortLevel)) {
    add("LA122", "warn", ".claude/settings.json", `effortLevel = ${JSON.stringify(effortLevel)} is not a level Claude Code accepts in settings.`, `Use one of ${CLAUDE_SETTINGS_EFFORTS.join(", ")}. \`max\` only persists through env.CLAUDE_CODE_EFFORT_LEVEL.`);
  }
  const effortEnv = settings?.env?.CLAUDE_CODE_EFFORT_LEVEL;
  if (effortEnv !== undefined) {
    add("LA123", "info", ".claude/settings.json", `env.CLAUDE_CODE_EFFORT_LEVEL = ${JSON.stringify(effortEnv)} takes priority over effortLevel.`, "Remove it if effortLevel (models.director_effort in lean-agents projects) should decide the director's effort.");
  }

  // Agents.
  const agentRoot = path.join(root, ".claude/agents");
  const agentFiles = files.filter((f) => f.startsWith(agentRoot + path.sep) && f.endsWith(".md"));
  const seen = new Map();
  let descriptionChars = 0;
  for (const abs of agentFiles.sort()) {
    const r = rel(abs);
    const parsed = parseFrontmatter(fs.readFileSync(abs, "utf8"));
    if (!parsed) {
      add("LA101", "error", r, "No YAML frontmatter: the file must start with a line containing only ---.", "Add ---\\nname: ...\\ndescription: ...\\n--- at the top.");
      continue;
    }
    const { fields: fm, body } = parsed;
    result.agents.push({ file: r, fm, body });
    for (const field of ["name", "description"]) {
      if (!fm[field]) add("LA130", "error", r, `Missing required field "${field}".`, "Claude Code needs name and description for a subagent.");
    }
    if (fm.name && (String(fm.name).includes(":") || String(fm.name).startsWith("-"))) {
      add("LA132", "error", r, `Agent name "${fm.name}" cannot contain ":" or start with "-".`, "Use a plain kebab-case name.");
    }
    if (fm.name) {
      if (seen.has(fm.name)) add("LA131", "error", r, `Agent name "${fm.name}" is also used by ${seen.get(fm.name)}.`, "Names must be unique.");
      else seen.set(fm.name, r);
    }
    descriptionChars += String(fm.description ?? "").length;
    if (fm.model && !CLAUDE_MODEL_ALIASES.includes(fm.model) && !/^claude-/.test(fm.model)) {
      add("LA133", "warn", r, `model: "${fm.model}" is neither a Claude Code alias (${CLAUDE_MODEL_ALIASES.join(", ")}) nor a full claude-* id.`, "Use an alias such as sonnet or opus.");
    }
    if (fm.effort && !CLAUDE_EFFORTS.includes(fm.effort)) {
      add("LA134", "warn", r, `effort: "${fm.effort}" is not a known level.`, `Use one of ${CLAUDE_EFFORTS.join(", ")}.`);
    }
    if (fm.permissionMode && !CLAUDE_PERMISSION_MODES.includes(fm.permissionMode)) {
      add("LA135", "warn", r, `permissionMode: "${fm.permissionMode}" is not valid.`, `Use one of ${CLAUDE_PERMISSION_MODES.join(", ")}.`);
    }
    const tools = toolList(fm.tools);
    const denied = toolList(fm.disallowedTools) ?? [];
    if (READ_ONLY_HINT.test(body)) {
      const canWrite = tools === null ? !CLAUDE_WRITE_TOOLS.every((t) => denied.includes(t)) : tools.some((t) => CLAUDE_WRITE_TOOLS.includes(toolName(t)));
      if (canWrite) {
        add("LA136", "warn", r, `"${fm.name ?? r}" is told not to modify files, but its tools still allow writing (Write, Edit or Bash).`, "Set tools: Read, Grep, Glob (leave Bash out for strict read-only).");
      }
    }
    result.agents[result.agents.length - 1].canSpawn = tools === null ? !denied.includes("Agent") : tools.some((t) => toolName(t) === "Agent");
  }
  if (descriptionChars > 60000) {
    add("LA138", "info", ".claude/agents", `Subagent descriptions total ~${descriptionChars} chars; Claude Code warns above ~15,000 tokens and they are paid every session.`, "Shorten descriptions or remove unused agents.");
  }
  const depth = settings?.env?.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH;
  const spawners = result.agents.filter((a) => a.canSpawn);
  if (spawners.length && String(depth) !== "1") {
    add("LA121", "info", spawners.map((a) => a.file).join(", "), "These subagents can launch subagents of their own (Claude Code allows up to three levels by default), which multiplies token use.", 'Add disallowedTools: Agent to them, or set env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH = "1" in .claude/settings.json.');
  }
  const directorTier = tierOf("claude", settings?.model);
  if (directorTier) {
    for (const a of result.agents) {
      const t = tierOf("claude", a.fm.model);
      if (t && t > directorTier) {
        add("LA137", "info", a.file, `"${a.fm.name}" uses ${a.fm.model} (${TIER_NAMES[t]}) while the project default model is ${settings.model} (${TIER_NAMES[directorTier]}).`, "The main session plans and integrates; it usually deserves the strongest model.");
      }
    }
  }

  // Skills.
  const claudeSkills = files.filter((f) => /(^|[\\/])\.claude[\\/]skills[\\/][^\\/]+[\\/]SKILL\.md$/.test(f));
  for (const abs of claudeSkills) {
    const r = rel(abs);
    const parsed = parseFrontmatter(fs.readFileSync(abs, "utf8"));
    if (!parsed) {
      add("LA101", "error", r, "No YAML frontmatter: Claude Code reads it only when the first line is ---.", "Start the file with ---, then name and description.");
      continue;
    }
    const desc = String(parsed.fields.description ?? "") + String(parsed.fields.when_to_use ?? "");
    if (!parsed.fields.description) {
      add("LA141", "warn", r, "Skill has no description, so Claude decides when to use it from the first line of the body.", "Add a description that starts with the main use case.");
    } else if (desc.length > 1536) {
      add("LA142", "info", r, `description + when_to_use is ${desc.length} chars; Claude Code truncates it at 1,536 in the skill list.`, "Put the key use case first and shorten it.");
    }
  }
  const otherSkills = files.filter((f) => /(^|[\\/])\.(agents|codex)[\\/]skills[\\/].+SKILL\.md$/.test(f));
  if (otherSkills.length && !claudeSkills.length) {
    add("LA140", "info", ".agents/skills", `${otherSkills.length} skill(s) exist for Codex, but Claude Code only reads .claude/skills/, so it does not see them.`, "Copy or generate them under .claude/skills/<name>/SKILL.md (lean-agents does this when targets include claude).");
  }
  return result;
}
