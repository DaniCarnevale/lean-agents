import { GENERATED_MARK, VERSION } from "../version.js";
import { stringify } from "smol-toml";
import { str, multiline } from "./toml.js";
import { claudeSettingsEffort } from "../models.js";

const T = {
  es: {
    header: "editá orchestration.toml y corré `npx lean-agents sync`",
    preamble: (name) =>
      `Sos el subagente \`${name}\`, lanzado por el director. La sección "Orquestación" de las instrucciones del proyecto no aplica a vos: no lances otros agentes, no hagas relevamiento ni pidas aprobaciones al usuario. Si te falta algo para avanzar, devolvé \`status: blocked\` o \`status: needs_decision\` con la pregunta concreta.`,
    closing:
      "Respetá las reglas de las instrucciones del proyecto. Hacé una sola pasada y terminá con un bloque HANDOFF (status, summary, files, checks, risks, next).",
    readOnly: "No modificás archivos ni ejecutás acciones que alteren datos o servicios.",
    shellSentence: "Podés correr comandos de solo lectura y los checks del proyecto.",
    noShell: "No tenés terminal: si una verificación requiere correr comandos, anotala en `checks` como pendiente para el director.",
    hint: {
      proactive: "Usalo de forma proactiva en los checkpoints que definen las instrucciones del proyecto.",
      onRequest: "Usalo solo cuando el usuario lo pida explícitamente.",
      specialist: "Usalo solo cuando el usuario lo pida o cuando el trabajo sea claramente independiente.",
    },
    checklistTitle: "Checklist específica del proyecto:",
    focusTitle: "Foco:",
    reviewer: `Rol: revisor técnico independiente. Encontrás problemas; no los arreglás.

Leé el diff indicado en el encargo (o \`git diff\`) y solo el contexto necesario. Buscá: bugs y regresiones; incumplimientos de contrato; manejo de errores, cancelación y concurrencia; seguridad y datos sensibles; huecos de pruebas; y si el resultado cumple los criterios de aceptación del encargo.

Para cada hallazgo indicá: severidad P0–P3, archivo:línea, impacto, cómo se activa y un arreglo acotado. No reportes preferencias de estilo salvo que oculten un defecto real. Podés correr comandos de solo lectura y los checks del proyecto.

Si no encontrás problemas, decilo explícitamente y detallá qué verificaste y qué no pudiste comprobar. No pidas otra ronda: entregá todo en una vez.`,
    explorer: `Rol: explorador de solo lectura. Respondés una pregunta concreta sobre el código, logs, datos o documentación.

Devolvé conclusiones con rutas y números de línea, no volcados de archivos. Si la pregunta es ambigua, respondé la interpretación más útil y aclará cuál tomaste. Mantené la respuesta en lo que el director necesita para decidir: idealmente menos de 40 líneas.`,
    ui_auditor: `Rol: auditor de UI y accesibilidad. Revisás un flujo terminado; no lo reimplementás.

Comprobá: estados de carga, vacío, error, cancelación y permisos; teclado y foco; semántica y nombres accesibles; contraste; responsive; mensajes claros; ausencia de datos sensibles en el navegador. Si hay un navegador o herramienta de automatización disponible, usala; si no, revisá el código y decí qué no pudiste verificar en ejecución.

Reportá hallazgos con severidad P0–P3, ubicación, impacto y arreglo acotado.`,
    custom: (r) =>
      `Rol: ${r.description}

Primero inspeccioná el código, los contratos y las pruebas reales; no supongas frameworks, proveedores ni capacidades sin evidencia. No cambies una interfaz compartida (API, eventos, formatos) por tu cuenta: devolvé \`status: needs_decision\` con la propuesta, porque el director coordina los contratos. Agregá pruebas proporcionales al cambio y separá hechos medidos de objetivos.`,
  },
  en: {
    header: "edit orchestration.toml and run `npx lean-agents sync`",
    preamble: (name) =>
      `You are the \`${name}\` subagent, spawned by the director. The "Orchestration" section of the project instructions does not apply to you: do not spawn other agents, do not run intake, and do not ask the user for approvals. If something blocks you, return \`status: blocked\` or \`status: needs_decision\` with the concrete question.`,
    closing:
      "Follow the rules in the project instructions. Make a single pass and finish with a HANDOFF block (status, summary, files, checks, risks, next).",
    readOnly: "You do not modify files or take actions that alter data or services.",
    shellSentence: "You may run read-only commands and the project checks.",
    noShell: "You have no terminal: if a check needs a command, list it under `checks` as pending for the director.",
    hint: {
      proactive: "Use proactively at the checkpoints defined in the project instructions.",
      onRequest: "Use only when the user explicitly asks for it.",
      specialist: "Use only when the user asks for it or the work is clearly independent.",
    },
    checklistTitle: "Project-specific checklist:",
    focusTitle: "Focus:",
    reviewer: `Role: independent technical reviewer. You find problems; you do not fix them.

Read the diff named in the brief (or \`git diff\`) and only the context you need. Look for: bugs and regressions; contract violations; error handling, cancellation and concurrency; security and sensitive data; test gaps; and whether the result meets the brief's acceptance criteria.

For each finding give: severity P0–P3, file:line, impact, trigger condition and a scoped fix. Do not report style preferences unless they hide a real defect. You may run read-only commands and the project checks.

If you find nothing, say so explicitly and list what you verified and what you could not check. Do not ask for another round: deliver everything at once.`,
    explorer: `Role: read-only explorer. You answer one concrete question about the code, logs, data or docs.

Return conclusions with paths and line numbers, not file dumps. If the question is ambiguous, answer the most useful reading and say which one you took. Keep it to what the director needs to decide: ideally under 40 lines.`,
    ui_auditor: `Role: UI and accessibility auditor. You review a finished flow; you do not reimplement it.

Check: loading, empty, error, cancelled and permission states; keyboard and focus; semantics and accessible names; contrast; responsive layout; clear messages; no sensitive data exposed in the browser. Use a browser or automation tool if one is available; otherwise review the code and say what you could not verify at runtime.

Report findings with severity P0–P3, location, impact and a scoped fix.`,
    custom: (r) =>
      `Role: ${r.description}

First inspect the real code, contracts and tests; do not assume frameworks, providers or capabilities without evidence. Do not change a shared interface (API, events, formats) on your own: return \`status: needs_decision\` with the proposal, because the director owns contracts. Add tests proportional to the change and separate measured facts from targets.`,
  },
};

const DESCRIPTIONS = {
  es: {
    reviewer: "Revisor técnico independiente de solo lectura: bugs, regresiones, contratos, seguridad, concurrencia y huecos de pruebas.",
    explorer: "Explorador barato de solo lectura para búsquedas amplias, logs y benchmarks; devuelve conclusiones con rutas.",
    ui_auditor: "Auditor de solo lectura de UI, estados y accesibilidad para flujos terminados.",
  },
  en: {
    reviewer: "Read-only independent technical reviewer: bugs, regressions, contracts, security, concurrency and test gaps.",
    explorer: "Cheap read-only explorer for broad searches, logs and benchmarks; returns conclusions with paths.",
    ui_auditor: "Read-only auditor of UI, states and accessibility for finished flows.",
  },
};

export function roleFileName(role) {
  return `${role.name.replace(/_/g, "-")}.toml`;
}

function roleBody(cfg, role, target) {
  const t = T[cfg.language];
  const parts = [t.preamble(role.name), ""];
  let body = role.builtin ? t[role.name] : t.custom(role);
  // Claude Code read-only roles get no shell at all (strict allowlist).
  const claudeReadOnly = target === "claude" && role.sandbox === "read-only" && !(role.claudeTools ?? []).includes("Bash");
  if (claudeReadOnly) body = body.replace(t.shellSentence, t.noShell);
  parts.push(body);
  if (role.focus.length) parts.push("", t.focusTitle, ...role.focus.map((f) => `- ${f}`));
  if (role.checklist.length) parts.push("", t.checklistTitle, ...role.checklist.map((c) => `- ${c}`));
  if (role.instructions) parts.push("", role.instructions);
  if (role.sandbox === "read-only") parts.push("", t.readOnly);
  parts.push("", t.closing);
  return parts.join("\n");
}

function roleDescription(cfg, role) {
  return role.builtin ? DESCRIPTIONS[cfg.language][role.name] : role.description;
}

// Codex only spawns subagents on request, so the description just says when.
function codexDescription(cfg, role) {
  const base = roleDescription(cfg, role);
  if (role.name !== "reviewer" || !role.builtin) return base;
  return `${base} ${cfg.language === "es" ? "Usar en checkpoints, no en cada edición." : "Use at checkpoints, not on every edit."}`;
}

export function renderRole(cfg, role) {
  const t = T[cfg.language];
  return [
    `# ${GENERATED_MARK} v${VERSION} — ${t.header}`,
    `name = ${str(role.name)}`,
    `description = ${str(codexDescription(cfg, role))}`,
    `model = ${str(role.model.codex)}`,
    `model_reasoning_effort = ${str(role.effort.codex)}`,
    `sandbox_mode = ${str(role.sandbox)}`,
    `developer_instructions = ${multiline(roleBody(cfg, role, "codex"))}`,
    "",
  ].join("\n");
}

export const CLAUDE_READ_ONLY_TOOLS = ["Read", "Grep", "Glob"];

// Claude Code delegates on its own based on the description, so the hint in
// the description is what implements `delegation`.
function claudeHint(cfg, role) {
  const h = T[cfg.language].hint;
  if (!role.builtin) return h.specialist;
  if (cfg.orchestration.delegation === "checkpoints" && (role.name === "reviewer" || role.name === "explorer")) return h.proactive;
  return h.onRequest;
}

export function renderClaudeAgent(cfg, role) {
  const t = T[cfg.language];
  const lines = [
    "---",
    `# ${GENERATED_MARK} v${VERSION} — ${t.header}`,
    `name: ${role.name}`,
    `description: ${JSON.stringify(`${roleDescription(cfg, role)} ${claudeHint(cfg, role)}`)}`,
  ];
  if (role.sandbox === "read-only") {
    const tools = (role.claudeTools ?? CLAUDE_READ_ONLY_TOOLS).filter((x) => x !== "Agent");
    lines.push(`tools: ${tools.join(", ")}`);
  } else if (role.claudeTools) {
    lines.push(`tools: ${role.claudeTools.filter((x) => x !== "Agent").join(", ")}`);
  } else {
    lines.push("disallowedTools: Agent"); // no nested subagents
  }
  lines.push(`model: ${role.model.claude}`, `effort: ${role.effort.claude}`, "---", "", roleBody(cfg, role, "claude"), "");
  return lines.join("\n");
}

export function renderClaudeSettings(cfg) {
  const extra = cfg.claude ?? {};
  const settings = {
    $schema: "https://json.schemastore.org/claude-code-settings.json",
    model: cfg.director.model.claude,
    effortLevel: claudeSettingsEffort(cfg.director.effort.claude),
    ...extra,
    env: { CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "1", ...(extra.env ?? {}) },
  };
  return JSON.stringify(settings, null, 2) + "\n";
}

export function renderCodexConfig(cfg) {
  const t = T[cfg.language];
  const lines = [
    `# ${GENERATED_MARK} v${VERSION} — ${t.header}`,
    `# Director (root session).`,
    `model = ${str(cfg.director.model.codex)}`,
    `model_reasoning_effort = ${str(cfg.director.effort.codex)}`,
  ];
  // Pass-through settings from [codex] in orchestration.toml (MCP servers, sandbox, ...).
  // Top-level scalars must come before any table, so they go first.
  const extra = cfg.codex ?? {};
  const isTable = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
  const scalars = Object.fromEntries(Object.entries(extra).filter(([, v]) => !isTable(v)));
  const tables = Object.fromEntries(Object.entries(extra).filter(([, v]) => isTable(v)));
  if (Object.keys(scalars).length) lines.push(stringify(scalars).trim());
  lines.push("", "[agents]", `max_threads = ${cfg.orchestration.max_threads}`, "max_depth = 1");
  if (Object.keys(tables).length) lines.push("", stringify(tables).trim());
  lines.push("");
  return lines.join("\n");
}
