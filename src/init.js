import fs from "node:fs";
import path from "node:path";
import { PRESETS } from "./presets.js";
import { CONFIG_FILE } from "./config.js";
import { str } from "./templates/toml.js";

const exists = (root, rel) => fs.existsSync(path.join(root, rel));

const FRONTEND_DEPS = ["react", "vue", "svelte", "next", "@angular/core", "solid-js"];
const BACKEND_DEPS = ["express", "fastify", "@nestjs/core", "hono", "koa"];
const DEFAULT_PNPM_WORKSPACES = ["apps/*", "packages/*"];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

const dependenciesOf = (pkg) => ({ ...pkg?.dependencies, ...pkg?.devDependencies });
const usesAny = (names, deps) => names.some((d) => d in deps);

// Reads a block-style `packages:` list from pnpm-workspace.yaml without a YAML
// parser. Any other form returns nothing, so the caller uses its default folders.
function pnpmWorkspacePatterns(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^packages\s*:\s*(#.*)?$/.test(l));
  if (start === -1) return [];
  const patterns = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = line.match(/^\s*-\s+(.+)$/);
    if (!item) break;
    patterns.push(item[1].replace(/\s+#.*$/, "").trim().replace(/^['"]|['"]$/g, ""));
  }
  return patterns;
}

function workspacePatterns(root, pkg) {
  const field = pkg?.workspaces;
  const declared = Array.isArray(field) ? field : field?.packages;
  const patterns = Array.isArray(declared) ? declared.filter((p) => typeof p === "string") : [];
  if (exists(root, "pnpm-workspace.yaml")) {
    const pnpm = pnpmWorkspacePatterns(readText(path.join(root, "pnpm-workspace.yaml")));
    patterns.push(...(pnpm.length ? pnpm : DEFAULT_PNPM_WORKSPACES));
  }
  return patterns;
}

// Supports literal paths and `dir/*`. Other patterns, and anything pointing
// outside the repo, are ignored. Workspace patterns always use `/`, so a
// backslash is rejected on every platform instead of working only on Windows.
function expandWorkspace(root, pattern) {
  const clean = pattern.trim().replace(/^\.\//, "").replace(/\/+$/, "");
  if (!clean || clean.includes("\\") || path.isAbsolute(clean) || clean.split("/").includes("..")) return [];
  const isWildcard = clean.endsWith("/*");
  const base = isWildcard ? clean.slice(0, -2) : clean;
  if (/[*?!{}[\]()]/.test(base)) return [];
  if (!isWildcard) return [base];
  try {
    return fs.readdirSync(path.join(root, base)).map((sub) => path.join(base, sub));
  } catch {
    return [];
  }
}

// Best-effort detection. Everything it guesses is written to orchestration.toml
// where the user can see and fix it; nothing is hidden.
export function detectProject(root) {
  const verify = [];
  const sources = [];
  const docs = {};
  let frontend = false;
  let backend = false;

  // A repo-level check script usually covers every ecosystem, so it wins.
  let hasCheckScript = false;
  for (const script of ["scripts/check.sh", "scripts/check.ps1", "Makefile"]) {
    if (!exists(root, script)) continue;
    if (script === "Makefile" && !/^check\s*:/m.test(readText(path.join(root, script)))) continue;
    hasCheckScript = true;
    verify.push(script === "Makefile" ? "make check" : script.endsWith(".sh") ? `bash ${script}` : `pwsh ${script}`);
    break;
  }

  const pkg = readJson(path.join(root, "package.json"));
  if (pkg) {
    const runner = exists(root, "pnpm-lock.yaml") ? "pnpm" : exists(root, "yarn.lock") ? "yarn" : "npm run";
    const scripts = pkg.scripts ?? {};
    if (!hasCheckScript) {
      for (const s of ["typecheck", "lint", "test"]) {
        if (scripts[s]) verify.push(s === "test" && runner === "npm run" ? "npm test" : `${runner} ${s}`);
      }
    }
    const deps = dependenciesOf(pkg);
    frontend = usesAny(FRONTEND_DEPS, deps);
    backend = usesAny(BACKEND_DEPS, deps);
  }
  // Monorepos often keep the frontend and backend in workspace packages.
  for (const pattern of workspacePatterns(root, pkg)) {
    for (const dir of expandWorkspace(root, pattern)) {
      const deps = dependenciesOf(readJson(path.join(root, dir, "package.json")));
      if (usesAny(FRONTEND_DEPS, deps)) frontend = true;
      if (usesAny(BACKEND_DEPS, deps)) backend = true;
    }
  }
  const addEco = (cmd) => {
    if (!hasCheckScript && !verify.includes(cmd)) verify.push(cmd);
  };
  if (exists(root, "pyproject.toml")) {
    backend = true;
    addEco(exists(root, "uv.lock") ? "uv run pytest" : "pytest");
  }
  if (exists(root, "go.mod")) {
    backend = true;
    addEco("go test ./...");
  }
  if (exists(root, "Cargo.toml")) {
    backend = true;
    addEco("cargo test");
  }

  for (const s of ["contracts", "schemas", "openapi.yaml", "openapi.yml", "openapi.json", "proto"]) {
    if (exists(root, s)) sources.push(fs.statSync(path.join(root, s)).isDirectory() ? `${s}/` : s);
  }
  if (exists(root, "docs/STATUS.md")) docs.status = "docs/STATUS.md";
  if (exists(root, "docs/VALIDATION.md")) docs.validation = "docs/VALIDATION.md";
  if (exists(root, "docs/adr")) docs.adr = "docs/adr";

  // Which coding tool the repo already uses, if any.
  const usesClaude = exists(root, "CLAUDE.md") || exists(root, ".claude");
  const usesCodex = exists(root, ".codex") || exists(root, "AGENTS.md");
  const targets = usesClaude && !usesCodex ? ["claude"] : usesCodex && !usesClaude ? ["codex"] : ["claude", "codex"];

  return {
    targets,
    name: path.basename(path.resolve(root)),
    verify,
    sources,
    docs,
    preset: frontend && backend ? "web-fullstack" : "standard",
  };
}

const COMMENTS = {
  es: {
    head: "# Configuración de lean-agents. Editá este archivo y corré `npx lean-agents sync`.",
    rules: "# Reglas que todo agente debe respetar en este proyecto (una por línea).",
    verify: "# Comandos que prueban que un cambio funciona.",
    targets: "# Herramientas para las que se generan archivos: \"claude\" (Claude Code), \"codex\" o ambas.",
    models: "# Alias: strong | balanced | fast. Se traducen al modelo de cada herramienta (ver `lean-agents presets`).\n# Para un modelo concreto con varias herramientas: director = { claude = \"opus\", codex = \"gpt-6.1-sol\" }",
    roles: "# Roles extra. Ejemplo de especialista (descomentá y adaptá):",
  },
  en: {
    head: "# lean-agents configuration. Edit this file and run `npx lean-agents sync`.",
    rules: "# Rules every agent must follow in this project (one per line).",
    verify: "# Commands that prove a change works.",
    targets: "# Tools to generate files for: \"claude\" (Claude Code), \"codex\" or both.",
    models: "# Aliases: strong | balanced | fast. Each one maps to a model per tool (see `lean-agents presets`).\n# For a concrete model with several tools: director = { claude = \"opus\", codex = \"gpt-6.1-sol\" }",
    roles: "# Extra roles. Specialist example (uncomment and adapt):",
  },
};

const tomlList = (items) => (items.length ? `[\n${items.map((i) => `  ${str(i)},`).join("\n")}\n]` : "[]");

export function renderOrchestrationToml({ name, language, preset, verify, sources, docs, targets = ["claude", "codex"], summary = "" }) {
  const c = COMMENTS[language];
  const p = PRESETS[preset];
  const docLines = Object.entries(docs).map(([k, v]) => `${k} = ${str(v)}`);
  return `${c.head}
schema = 1
${c.targets}
targets = [${targets.map(str).join(", ")}]
language = ${str(language)}   # es | en
preset = ${str(preset)}   # ${Object.keys(PRESETS).join(" | ")}

[project]
name = ${str(name)}
summary = ${str(summary)}
sources_of_truth = ${tomlList(sources)}
${c.rules}
rules = []
${c.verify}
verify = ${tomlList(verify)}

[project.docs]
${docLines.join("\n")}

[models]
${c.models}
director = "strong"
director_effort = "high"

[orchestration]
delegation = ${str(p.orchestration.delegation)}   # explicit | checkpoints
max_threads = ${p.orchestration.max_threads}
intake = ${str(p.orchestration.intake)}   # off | ask | always
keywords = true

[roles.reviewer]
checklist = []

${c.roles}
# [roles.payments]
# description = "Payments specialist: provider adapters, idempotency, webhooks and reconciliation."
# focus = ["idempotency keys", "webhook signature checks"]
# model = "strong"
# effort = "high"
# sandbox = "workspace-write"
`;
}

export function writeInitialConfig(root, answers) {
  const file = path.join(root, CONFIG_FILE);
  fs.writeFileSync(file, renderOrchestrationToml(answers));
  return file;
}
