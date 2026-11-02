import fs from "node:fs";
import path from "node:path";
import { PRESETS } from "./presets.js";
import { CONFIG_FILE } from "./config.js";
import { str } from "./templates/toml.js";

const exists = (root, rel) => fs.existsSync(path.join(root, rel));

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
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
    if (exists(root, script)) {
      hasCheckScript = true;
      verify.push(script === "Makefile" ? "make check" : script.endsWith(".sh") ? `bash ${script}` : `pwsh ${script}`);
      break;
    }
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
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    frontend = ["react", "vue", "svelte", "next", "@angular/core", "solid-js"].some((d) => d in deps);
    backend = ["express", "fastify", "@nestjs/core", "hono", "koa"].some((d) => d in deps);
  }
  if (exists(root, "pnpm-workspace.yaml")) {
    // Monorepos often hide the frontend in a workspace package.
    for (const dir of ["apps", "packages"]) {
      if (!exists(root, dir)) continue;
      for (const sub of fs.readdirSync(path.join(root, dir))) {
        const p = readJson(path.join(root, dir, sub, "package.json"));
        const deps = { ...p?.dependencies, ...p?.devDependencies };
        if (["react", "vue", "svelte", "next"].some((d) => d in deps)) frontend = true;
      }
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

  return {
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
    models: "# Alias: strong | balanced | fast, o un id concreto de modelo.",
    roles: "# Roles extra. Ejemplo de especialista (descomentá y adaptá):",
  },
  en: {
    head: "# lean-agents configuration. Edit this file and run `npx lean-agents sync`.",
    rules: "# Rules every agent must follow in this project (one per line).",
    verify: "# Commands that prove a change works.",
    models: "# Aliases: strong | balanced | fast, or a concrete model id.",
    roles: "# Extra roles. Specialist example (uncomment and adapt):",
  },
};

const tomlList = (items) => (items.length ? `[\n${items.map((i) => `  ${str(i)},`).join("\n")}\n]` : "[]");

export function renderOrchestrationToml({ name, language, preset, verify, sources, docs, summary = "" }) {
  const c = COMMENTS[language];
  const p = PRESETS[preset];
  const docLines = Object.entries(docs).map(([k, v]) => `${k} = ${str(v)}`);
  return `${c.head}
schema = 1
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
