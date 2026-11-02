import { GENERATED_MARK, VERSION } from "../version.js";

// Original, short skills. They are deliberately generic: project specifics come
// from the project instructions, AGENTS.md or CLAUDE.md (verify commands, docs paths, sources of truth).

const SKILLS = {
  intake: {
    es: {
      description:
        "Convertir un pedido nuevo de cambio en un borrador breve para aprobación (objetivo, alcance, fuera de alcance, aceptación, preguntas) antes de implementar. Usar cuando un pedido cambia comportamiento, alcance o criterios y es ambiguo o grande. No usar para preguntas, estado o revisiones.",
      body: `# Relevamiento de pedidos

Lo aplica el director, en el mismo turno; no es un subagente.

1. Extraé solo lo que el usuario dijo o autorizó. No agregues funcionalidades, tecnologías, fechas, prioridades ni supuestos.
2. Mirá el contexto del proyecto solo para detectar conflictos con las fuentes de verdad de las instrucciones del proyecto.
3. Mostrá el borrador, que tiene que entrar en una pantalla:

\`\`\`text
OBJETIVO: …
ALCANCE: …
NO INCLUYE: …
ACEPTACIÓN: …
PENDIENTES/PREGUNTAS: …   (o "ninguno")
ESTADO: PENDIENTE DE APROBACIÓN
\`\`\`

4. Esperá. Cuenta como aprobación \`APROBADO\`, \`APROBAR\` o un equivalente inequívoco. Un "ok" ambiguo no alcanza: preguntá en una línea.
5. Si el usuario corrige, reemplazá el borrador completo y volvé a pedir aprobación. No conserves partes rechazadas.
6. Con la aprobación, el borrador pasa a ser el criterio de aceptación del trabajo: citálo al cerrar y decí qué ítems se cumplieron y cuáles no.

Si falta información, escribí \`pendiente\` o hacé una pregunta corta. Nunca conviertas una posibilidad en requisito.
`,
    },
    en: {
      description:
        "Turn a new change request into a short draft for approval (goal, scope, out of scope, acceptance, questions) before implementing. Use when a request changes behavior, scope or criteria and is ambiguous or large. Do not use for questions, status or reviews.",
      body: `# Request intake

Applied by the director in the same turn; this is not a subagent.

1. Extract only what the user said or authorized. Do not add features, technologies, dates, priorities or assumptions.
2. Look at project context only to detect conflicts with the sources of truth in the project instructions.
3. Show the draft; it must fit on one screen:

\`\`\`text
GOAL: …
SCOPE: …
OUT OF SCOPE: …
ACCEPTANCE: …
OPEN QUESTIONS: …   (or "none")
STATUS: PENDING APPROVAL
\`\`\`

4. Wait. \`APPROVED\`, \`APPROVE\` or an unambiguous equivalent counts as approval. A vague "ok" does not: ask in one line.
5. If the user corrects it, replace the whole draft and ask again. Do not keep rejected parts.
6. Once approved, the draft becomes the acceptance criteria for the work: quote it when closing and state which items were met and which were not.

If information is missing, write \`pending\` or ask a short question. Never turn a possibility into a requirement.
`,
    },
  },

  adr: {
    es: {
      description:
        "Proponer y mantener Architecture Decision Records (ADR) con contexto, decisión, alternativas y consecuencias, más su índice. Usar ante una decisión técnica durable (tecnología, protocolo, estructura) o cuando alguien pregunta por qué el sistema es así. No usar para bugs, tareas o cada commit.",
      body: `# Architecture Decision Records

La carpeta de ADRs está indicada en las instrucciones del proyecto (por defecto \`docs/adr/\`), con un índice en \`README.md\` dentro de ella.

**Cuándo sí:** elegir o reemplazar una tecnología, un protocolo, un formato compartido, una estructura del sistema, o aceptar un trade-off que alguien va a querer entender dentro de meses.
**Cuándo no:** bugs, tareas, mediciones aisladas, cambios de copy, cada commit.

## Flujo

1. Antes de implementar, prepará un ADR con estado \`proposed\` y mostralo. No escribas el archivo hasta tener aprobación explícita. Si la carpeta no existe, pedí confirmación antes de crearla.
2. Después de implementar y probar, agregá evidencia y consecuencias reales; proponé \`accepted\` solo si la decisión está efectivamente adoptada.
3. Si una decisión cambia, marcá la anterior \`superseded\` con enlace a la nueva. No borres historia.

## Plantilla (\`NNNN-titulo-en-kebab.md\`)

\`\`\`markdown
# NNNN. Título

- Estado: proposed | accepted | superseded por NNNN | deprecated
- Fecha: AAAA-MM-DD

## Contexto
Qué problema o fuerza obliga a decidir. Hechos, no opiniones.

## Decisión
Qué se decidió, en una o dos frases.

## Alternativas consideradas
- Opción: por qué no.

## Consecuencias
Qué mejora, qué empeora, qué riesgos quedan y cómo se verifica.
\`\`\`

Actualizá el índice con número, título y estado. Una sola fuente: no dupliques decisiones en otros documentos; enlazá al ADR.
`,
    },
    en: {
      description:
        "Propose and maintain Architecture Decision Records (ADRs) with context, decision, alternatives and consequences, plus their index. Use for a durable technical decision (technology, protocol, structure) or when someone asks why the system is shaped this way. Not for bugs, tasks or every commit.",
      body: `# Architecture Decision Records

The ADR folder is named in the project instructions (default \`docs/adr/\`), with an index in its \`README.md\`.

**Use it for:** choosing or replacing a technology, a protocol, a shared format, a system structure, or accepting a trade-off someone will want to understand months from now.
**Not for:** bugs, tasks, one-off measurements, copy changes, every commit.

## Flow

1. Before implementing, draft an ADR with status \`proposed\` and show it. Do not write the file until explicitly approved. If the folder does not exist, ask before creating it.
2. After implementing and testing, add evidence and real consequences; propose \`accepted\` only if the decision is actually adopted.
3. If a decision changes, mark the old one \`superseded\` and link the new one. Never delete history.

## Template (\`NNNN-kebab-title.md\`)

\`\`\`markdown
# NNNN. Title

- Status: proposed | accepted | superseded by NNNN | deprecated
- Date: YYYY-MM-DD

## Context
What problem or force requires a decision. Facts, not opinions.

## Decision
What was decided, in one or two sentences.

## Alternatives considered
- Option: why not.

## Consequences
What gets better, what gets worse, remaining risks and how to verify.
\`\`\`

Update the index with number, title and status. One source of truth: do not duplicate decisions elsewhere; link to the ADR.
`,
    },
  },

  verify: {
    es: {
      description:
        "Verificar un cambio antes de darlo por terminado: correr los comandos de verificación del proyecto, revisar el diff y reportar qué se comprobó y qué no. Usar al cerrar una feature, un fix o antes de un commit o PR.",
      body: `# Verificación

1. Corré los comandos de la sección "Verificación" de las instrucciones del proyecto, en ese orden. Si no hay, usá los tests existentes más cercanos al cambio.
2. Si un comando falla, no sigas acumulando cambios: diagnosticá, arreglá y volvé a correr.
3. Revisá el diff completo (\`git diff\`, incluidos archivos nuevos): código muerto, debug olvidado, secretos, cambios fuera de alcance, archivos generados o binarios que no deberían estar.
4. Comprobá que los criterios de aceptación (del encargo o del relevamiento aprobado) se cumplen uno por uno.
5. Reportá:

\`\`\`text
VERIFICACIÓN
corrido:      comando → resultado (pasó / falló, cantidad de tests)
no corrido:   comando → motivo
criterios:    ítem → cumplido / no cumplido / sin evidencia
riesgos:      …
\`\`\`

Nunca digas que algo pasa sin haberlo corrido en esta sesión. Si una prueba depende de hardware, red o credenciales que no tenés, marcala "no corrido" y explicá qué haría falta.
`,
    },
    en: {
      description:
        "Verify a change before calling it done: run the project's verification commands, review the diff and report what was and was not checked. Use when closing a feature or fix, or before a commit or PR.",
      body: `# Verification

1. Run the commands in the "Verification" section of the project instructions, in order. If there are none, run the existing tests closest to the change.
2. If a command fails, stop piling up changes: diagnose, fix and rerun.
3. Review the full diff (\`git diff\`, new files included): dead code, leftover debugging, secrets, out-of-scope changes, generated or binary files that should not be there.
4. Check the acceptance criteria (from the brief or the approved intake) one by one.
5. Report:

\`\`\`text
VERIFICATION
ran:         command → result (pass / fail, number of tests)
not run:     command → reason
criteria:    item → met / not met / no evidence
risks:       …
\`\`\`

Never claim something passes unless you ran it in this session. If a check needs hardware, network or credentials you do not have, mark it "not run" and say what it would need.
`,
    },
  },

  "contract-first": {
    es: {
      description:
        "Cambiar interfaces compartidas (OpenAPI, JSON Schema, eventos, formatos binarios) empezando por un contrato único y verificable, y después proveedor y consumidores. Usar cuando un cambio cruza frontend/backend o servicios.",
      body: `# Contract-first

1. Identificá el contrato que gobierna la frontera (las fuentes de verdad de las instrucciones del proyecto). Si no hay uno, proponé crearlo antes de tocar código.
2. Cambiá primero el contrato. Preferí cambios compatibles: campos nuevos opcionales, valores de enum nuevos tolerados. Si es incompatible, decilo explícitamente y versioná.
3. Regenerá o actualizá tipos, validadores y mocks **desde** el contrato, no a mano en cada lado.
4. Actualizá proveedor y consumidores en el mismo cambio, o dejá documentado cuál queda pendiente.
5. Agregá o actualizá pruebas de contrato: el proveedor emite lo que el contrato dice, y el consumidor tolera lo que el contrato permite.
6. Los mocks deben respetar el mismo contrato que la ruta real; un mock que acepta lo que el real rechaza es un bug.

Un solo dueño por contrato: el director. Si sos un subagente y el cambio requiere tocar el contrato, devolvé \`needs_decision\` con la propuesta.
`,
    },
    en: {
      description:
        "Change shared interfaces (OpenAPI, JSON Schema, events, binary formats) starting from one authoritative, checkable contract, then provider and consumers. Use when a change crosses frontend/backend or service boundaries.",
      body: `# Contract-first

1. Identify the contract that governs the boundary (the sources of truth in the project instructions). If there is none, propose one before touching code.
2. Change the contract first. Prefer compatible changes: new optional fields, tolerated new enum values. If it is breaking, say so explicitly and version it.
3. Regenerate or update types, validators and mocks **from** the contract, not by hand on each side.
4. Update provider and consumers in the same change, or document which one is pending.
5. Add or update contract tests: the provider emits what the contract says, and the consumer tolerates what the contract allows.
6. Mocks must follow the same contract as the real path; a mock that accepts what the real one rejects is a bug.

One owner per contract: the director. If you are a subagent and the change needs a contract edit, return \`needs_decision\` with the proposal.
`,
    },
  },
};

export function renderSkill(cfg, name) {
  const s = SKILLS[name][cfg.language];
  return [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(s.description)}`,
    "metadata:",
    `  generator: ${GENERATED_MARK} v${VERSION}`,
    "---",
    "",
    s.body,
  ].join("\n");
}
