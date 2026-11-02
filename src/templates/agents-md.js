import { GENERATED_MARK, VERSION } from "../version.js";

const T = {
  es: {
    header: "editá orchestration.toml y corré `npx lean-agents sync`; no edites este archivo a mano",
    rulesTitle: "Reglas del proyecto (aplican a todos los agentes)",
    sources: (list) => `Fuentes de verdad: ${list}. Si un cambio las contradice, actualizá primero la fuente de verdad y avisalo.`,
    baseRules: [
      "No inventes resultados de pruebas, mediciones, proveedores ni integraciones. Separá lo verificado de lo supuesto.",
      "No gastes dinero, uses credenciales, envíes datos a terceros, despliegues ni hagas acciones externas sin aprobación explícita del usuario.",
      "No registres secretos ni datos sensibles en logs, commits o documentación.",
    ],
    verifyTitle: "Verificación",
    verifyIntro: "Antes de dar por terminado un cambio, corré:",
    verifyNone: "Todavía no hay comandos de verificación definidos en `orchestration.toml` (`project.verify`). Usá los tests existentes y decí qué corriste.",
    verifyOutro: "Si no podés correrlos, decí por qué y qué quedó sin verificar.",
    docsTitle: "Documentación",
    docsStatus: (p) => `Estado y continuidad: \`${p}\`.`,
    docsValidation: (p) => `Evidencia de validación: \`${p}\`. Solo con resultados reales.`,
    docsAdr: (p) => `Decisiones de arquitectura: \`${p}/\` (ver \`$adr\`).`,
    skillsTitle: "Skills",
    skillsIntro: "Están en `.agents/skills/`. Leé el `SKILL.md` antes de aplicar una.",
    skillDesc: {
      intake: "convertir un pedido nuevo en un borrador para aprobar",
      adr: "registrar decisiones de arquitectura durables",
      verify: "verificar un cambio antes de cerrarlo",
      "contract-first": "cambiar interfaces compartidas empezando por el contrato",
    },
    orchTitle: "Orquestación (solo para el director)",
    guard: "Si sos un subagente lanzado por el director, salteá esta sección completa: seguí las instrucciones de tu rol y las reglas de arriba, no lances otros agentes y terminá con un bloque HANDOFF.",
    director:
      "Sos el director: entendés el pedido, hacés vos la mayor parte del trabajo e integrás. Delegar cuesta tokens, tiempo y contexto; hacelo solo cuando aporta algo que no conseguís trabajando solo.",
    whenTitle: "Cuándo delegar",
    whenIntro: "Delegá solo si se cumple al menos una de estas condiciones:",
    when: {
      reviewer: "Revisión independiente con contexto fresco (`reviewer`) en un checkpoint: antes de cerrar un cambio que toca contratos, seguridad, concurrencia, datos o varios módulos.",
      explorer: "Exploración de solo lectura que ensuciaría tu contexto: búsquedas amplias, logs largos, benchmarks (`explorer`).",
      ui_auditor: "Auditoría de UI y accesibilidad de un flujo terminado (`ui_auditor`).",
      custom: "Trabajo de un especialista cuyo dominio declarado lo cubre y que es independiente de lo que estás haciendo vos.",
    },
    whenNot:
      "No delegues preguntas, explicaciones, cambios de un paso, trabajo acoplado al mismo contrato que estás tocando, ni el mismo archivo a dos agentes.",
    modeExplicit:
      "Modo `explicit`: lanzás subagentes solo cuando el usuario lo pide (por ejemplo, \"usá reviewer\"). Podés sugerirlo en una línea cuando aplique una condición de arriba.",
    modeCheckpoints:
      "Modo `checkpoints`: podés lanzar `reviewer` y `explorer` por iniciativa propia en las condiciones de arriba. Los especialistas solo cuando el usuario lo pide o cuando el trabajo es claramente independiente.",
    limits: (n) => `Como máximo ${n} subagente${n === 1 ? "" : "s"} en paralelo y sin anidar.`,
    briefTitle: "Encargo",
    brief:
      "Cada encargo incluye: objetivo; archivos o alcance; contexto mínimo (rutas y secciones, no copias del plan); criterios de aceptación; qué se espera (investigar, proponer, implementar o revisar); checks a correr.",
    handoffTitle: "Respuesta del subagente",
    handoffRules:
      "Cada subagente hace una sola pasada. Si falta un dato verificable, se permite un único follow-up. Sin reintentos automáticos ni rondas de \"mejorá la respuesta\". Un HANDOFF es una afirmación, no evidencia: verificá lo importante vos.",
    intakeTitle: "Relevamiento de pedidos",
    intakeAsk:
      "Ante un pedido nuevo que cambia comportamiento y es ambiguo o grande, aplicá vos mismo la skill `$intake` (no la delegues): mostrá el borrador y esperá aprobación. Si el pedido es claro y acotado, o el usuario escribe `APROBADO` o \"sin relevamiento\", implementá directamente. Preguntas, estado y revisiones nunca pasan por relevamiento.",
    intakeAlways:
      "Ante todo pedido nuevo que cambie comportamiento, alcance o criterios, aplicá vos mismo la skill `$intake` y esperá aprobación explícita antes de implementar. Preguntas, estado y revisiones no pasan por relevamiento.",
    adrTitle: "Decisiones",
    adr: "Cuando aparece una decisión durable (tecnología, protocolo, estructura), proponé un ADR con `$adr` y escribilo solo tras aprobación. No hagas ADRs por cada bug o commit.",
    kwTitle: "Palabras clave",
    kw: [
      "`ORQUESTACIÓN SOLO`: no delegues en este turno.",
      "`ORQUESTACIÓN OFF` / `ORQUESTACIÓN ON`: desactiva o reactiva la delegación hasta nuevo aviso.",
      "`ORQUESTACIÓN ESTADO`: informá el modo actual.",
    ],
    kwNote:
      "Se reconocen solo como instrucción independiente, con o sin tilde. Es una convención de conversación: si no estás seguro del modo (por ejemplo, después de compactar el contexto), asumí OFF.",
    rolesTitle: "Roles disponibles",
    rolesHead: "| rol | para qué | escribe archivos | modelo |",
    yes: "sí",
    no: "no",
    roleDesc: {
      reviewer: "revisión técnica independiente; encuentra problemas, no los arregla",
      explorer: "búsquedas y lectura de código/logs; devuelve conclusiones con rutas",
      ui_auditor: "auditoría de UI, estados y accesibilidad",
    },
  },
  en: {
    header: "edit orchestration.toml and run `npx lean-agents sync`; do not edit this file by hand",
    rulesTitle: "Project rules (apply to every agent)",
    sources: (list) => `Sources of truth: ${list}. If a change contradicts them, update the source of truth first and say so.`,
    baseRules: [
      "Never invent test results, measurements, providers or integrations. Separate what was verified from what is assumed.",
      "Do not spend money, use credentials, send data to third parties, deploy or take external actions without explicit user approval.",
      "Do not write secrets or sensitive data to logs, commits or docs.",
    ],
    verifyTitle: "Verification",
    verifyIntro: "Before calling a change done, run:",
    verifyNone: "No verification commands are defined in `orchestration.toml` (`project.verify`) yet. Use the existing tests and say what you ran.",
    verifyOutro: "If you cannot run them, say why and what remains unverified.",
    docsTitle: "Documentation",
    docsStatus: (p) => `Status and continuity: \`${p}\`.`,
    docsValidation: (p) => `Validation evidence: \`${p}\`. Real results only.`,
    docsAdr: (p) => `Architecture decisions: \`${p}/\` (see \`$adr\`).`,
    skillsTitle: "Skills",
    skillsIntro: "They live in `.agents/skills/`. Read the `SKILL.md` before applying one.",
    skillDesc: {
      intake: "turn a new request into a draft for approval",
      adr: "record durable architecture decisions",
      verify: "verify a change before closing it",
      "contract-first": "change shared interfaces starting from the contract",
    },
    orchTitle: "Orchestration (director only)",
    guard: "If you are a subagent spawned by the director, skip this whole section: follow your role instructions and the rules above, do not spawn other agents, and finish with a HANDOFF block.",
    director:
      "You are the director: you understand the request, do most of the work yourself and integrate. Delegation costs tokens, time and context; use it only when it adds something you cannot get working alone.",
    whenTitle: "When to delegate",
    whenIntro: "Delegate only when at least one of these holds:",
    when: {
      reviewer: "Independent review with fresh context (`reviewer`) at a checkpoint: before closing a change that touches contracts, security, concurrency, data or several modules.",
      explorer: "Read-only exploration that would pollute your context: broad searches, long logs, benchmarks (`explorer`).",
      ui_auditor: "UI and accessibility audit of a finished flow (`ui_auditor`).",
      custom: "Specialist work clearly inside a specialist's declared domain and independent from what you are doing.",
    },
    whenNot:
      "Do not delegate questions, explanations, one-step changes, work coupled to the contract you are editing, or the same file to two agents.",
    modeExplicit:
      "Mode `explicit`: spawn subagents only when the user asks (e.g. \"use reviewer\"). You may suggest it in one line when a condition above applies.",
    modeCheckpoints:
      "Mode `checkpoints`: you may spawn `reviewer` and `explorer` on your own under the conditions above. Specialists only when the user asks or the work is clearly independent.",
    limits: (n) => `At most ${n} subagent${n === 1 ? "" : "s"} in parallel, no nesting.`,
    briefTitle: "Brief",
    brief:
      "Every brief states: goal; files or scope; minimal context (paths and sections, not copies of the plan); acceptance criteria; what is expected (investigate, propose, implement or review); checks to run.",
    handoffTitle: "Subagent response",
    handoffRules:
      "Each subagent gets one pass. One follow-up is allowed only if a verifiable fact is missing. No automatic retries or \"improve your answer\" rounds. A HANDOFF is a claim, not evidence: verify what matters yourself.",
    intakeTitle: "Request intake",
    intakeAsk:
      "For a new request that changes behavior and is ambiguous or large, apply the `$intake` skill yourself (do not delegate it): show the draft and wait for approval. If the request is clear and small, or the user writes `APPROVED` or \"skip intake\", implement directly. Questions, status and reviews never go through intake.",
    intakeAlways:
      "For every new request that changes behavior, scope or criteria, apply the `$intake` skill yourself and wait for explicit approval before implementing. Questions, status and reviews skip intake.",
    adrTitle: "Decisions",
    adr: "When a durable decision appears (technology, protocol, structure), propose an ADR with `$adr` and write it only after approval. No ADRs per bug or commit.",
    kwTitle: "Keywords",
    kw: [
      "`ORCHESTRATION SOLO`: do not delegate this turn.",
      "`ORCHESTRATION OFF` / `ORCHESTRATION ON`: disable or re-enable delegation until further notice.",
      "`ORCHESTRATION STATUS`: report the current mode.",
    ],
    kwNote:
      "Recognized only as a standalone instruction. This is a conversation convention: if you are unsure of the mode (e.g. after context compaction), assume OFF.",
    rolesTitle: "Available roles",
    rolesHead: "| role | purpose | writes files | model |",
    yes: "yes",
    no: "no",
    roleDesc: {
      reviewer: "independent technical review; finds problems, does not fix them",
      explorer: "searches and reads code/logs; returns conclusions with paths",
      ui_auditor: "UI, states and accessibility audit",
    },
  },
};

// Keys stay in English in every language so handoffs are easy to scan and parse.
const HANDOFF_BLOCK = (lang) =>
  [
    "```text",
    "HANDOFF",
    "status: done | blocked | needs_decision",
    "summary: …",
    "files: …",
    lang === "es" ? "checks: …   (comandos corridos y resultado)" : "checks: …   (commands run and result)",
    "risks: …",
    "next: …",
    "```",
  ].join("\n");

export function renderAgentsMd(cfg) {
  const t = T[cfg.language];
  const { project, orchestration: o, roles, skills } = cfg;
  const out = [];
  out.push(`<!-- ${GENERATED_MARK} v${VERSION} — ${t.header} -->`);
  out.push(`# ${project.name}`, "");
  if (project.summary) out.push(project.summary, "");

  out.push(`## ${t.rulesTitle}`, "");
  if (project.sourcesOfTruth.length) out.push(`- ${t.sources(project.sourcesOfTruth.map((s) => `\`${s}\``).join(", "))}`);
  for (const r of project.rules) out.push(`- ${r}`);
  for (const r of t.baseRules) out.push(`- ${r}`);
  out.push("");

  out.push(`## ${t.verifyTitle}`, "");
  if (project.verify.length) {
    out.push(t.verifyIntro, "");
    for (const v of project.verify) out.push(`- \`${v}\``);
    out.push("", t.verifyOutro);
  } else {
    out.push(t.verifyNone);
  }
  out.push("");

  const d = project.docs;
  const docLines = [];
  if (d.status) docLines.push(t.docsStatus(d.status));
  if (d.validation) docLines.push(t.docsValidation(d.validation));
  if (skills.includes("adr")) docLines.push(t.docsAdr(d.adr));
  if (docLines.length) {
    out.push(`## ${t.docsTitle}`, "");
    for (const l of docLines) out.push(`- ${l}`);
    out.push("");
  }

  out.push(`## ${t.skillsTitle}`, "", t.skillsIntro, "");
  for (const s of skills) out.push(`- \`$${s}\`: ${t.skillDesc[s]}.`);
  out.push("");

  out.push("---", "", `## ${t.orchTitle}`, "", `> ${t.guard}`, "", t.director, "");

  out.push(`### ${t.whenTitle}`, "", t.whenIntro, "");
  let n = 1;
  for (const key of ["reviewer", "explorer", "ui_auditor"]) {
    if (roles.some((r) => r.name === key)) out.push(`${n++}. ${t.when[key]}`);
  }
  if (roles.some((r) => !r.builtin)) out.push(`${n++}. ${t.when.custom}`);
  out.push("", t.whenNot, "");
  out.push(o.delegation === "explicit" ? t.modeExplicit : t.modeCheckpoints, "");
  out.push(t.limits(o.max_threads), "");

  out.push(`### ${t.briefTitle}`, "", t.brief, "");
  out.push(`### ${t.handoffTitle}`, "", HANDOFF_BLOCK(cfg.language), "", t.handoffRules, "");

  if (o.intake !== "off") {
    out.push(`### ${t.intakeTitle}`, "", o.intake === "always" ? t.intakeAlways : t.intakeAsk, "");
  }
  if (skills.includes("adr")) out.push(`### ${t.adrTitle}`, "", t.adr, "");

  if (o.keywords) {
    out.push(`### ${t.kwTitle}`, "");
    for (const k of t.kw) out.push(`- ${k}`);
    out.push("", t.kwNote, "");
  }

  out.push(`### ${t.rolesTitle}`, "", t.rolesHead, "|---|---|---|---|");
  for (const r of roles) {
    const desc = r.builtin ? t.roleDesc[r.name] : r.description;
    const writes = r.sandbox === "read-only" ? t.no : t.yes;
    out.push(`| \`${r.name}\` | ${desc.replace(/\|/g, "\\|")} | ${writes} | ${r.model} (${r.effort}) |`);
  }
  out.push("");
  return out.join("\n");
}
