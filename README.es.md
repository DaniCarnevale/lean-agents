# lean-agents

**Configuración de agentes centrada en un director, para Claude Code y Codex.**

[Read in English](README.md)

lean-agents arma en cualquier repositorio un equipo chico y disciplinado de agentes de IA para programar. Respondés unas preguntas y genera todo lo que tu herramienta necesita: instrucciones del proyecto, subagentes, skills y configuración, en las rutas que Claude Code y Codex leen de verdad. Después `doctor` comprueba que la configuración funcione.

```bash
npx github:DaniCarnevale/lean-agents init --target claude   # Claude Code
npx github:DaniCarnevale/lean-agents init --target codex    # Codex
npx github:DaniCarnevale/lean-agents init --target both     # las dos, con una sola fuente compartida
```

## Qué obtenés

- **Un director.** Tu sesión principal planifica, implementa e integra el trabajo. Delega solo cuando eso aporta algo: una revisión independiente, una búsqueda de solo lectura que le ensuciaría el contexto, o trabajo de especialista realmente separado.
- **Pocos ayudantes, con límites reales.**
  - `reviewer`: revisa diffs con contexto fresco.
  - `explorer`: búsquedas baratas de solo lectura en código y logs.
  - `ui_auditor`: auditoría de UI y accesibilidad.
  - Los especialistas que declares vos.

  En Claude Code, los roles de solo lectura se aplican con los permisos de la herramienta. Codex no tiene límites por rol, así que ahí dependen de sus instrucciones.
- **Skills para los procedimientos que se repiten.**
  - `intake`: convierte un pedido en un borrador breve para aprobar.
  - `adr`: registra decisiones de arquitectura.
  - `verify`: verifica un cambio antes de cerrarlo.
  - `contract-first`: cambia APIs compartidas empezando por el contrato.
- **Un solo archivo de configuración**, `orchestration.toml`. Lo editás, corrés `sync` y todos los archivos generados quedan coherentes.
- **Un validador.** `doctor` revisa la configuración de agentes de Claude Code o Codex de cualquier repo, la haya generado lean-agents o no, y sirve en CI.

## Elegí tu herramienta

| | Claude Code | Codex |
|---|---|---|
| Instrucciones del proyecto | `CLAUDE.md` | `AGENTS.md` |
| Subagentes | `.claude/agents/*.md` | `.codex/agents/*.toml` |
| Skills | `.claude/skills/<nombre>/SKILL.md` (se usan con `/<nombre>`) | `.agents/skills/<nombre>/SKILL.md` (se usan con `$<nombre>`) |
| Configuración | `.claude/settings.json` (modelo y effort del director, sin subagentes anidados) | `.codex/config.toml` (modelo y effort del director, `max_concurrent_threads_per_session`) |
| Roles de solo lectura | `tools: Read, Grep, Glob` | Solo instrucciones (los subagentes heredan el sandbox de la sesión) |
| Modelos por defecto (`strong` / `balanced` / `fast`) | `opus` / `sonnet` / `haiku` | `gpt-6.1-sol` / `gpt-6-sol` / `gpt-6-luna` |

Con `--target both`, las instrucciones viven en `AGENTS.md` y `CLAUDE.md` lo importa (`@AGENTS.md`), así las dos herramientas siguen las mismas reglas. Cada herramienta tiene sus propias carpetas de agentes y skills.

Si no pasás `--target`, `init` te pregunta. Te sugiere según lo que ya tenga el repo: un `CLAUDE.md` o una carpeta `.claude/` apuntan a Claude Code, y un `AGENTS.md` o una carpeta `.codex/` apuntan a Codex. Podés cambiar de herramienta más adelante: editás `targets` en `orchestration.toml` y corrés `sync`.

## Instalación

Requisitos: Node.js 20 o superior, y Claude Code o Codex CLI (o los dos).

```bash
# Usarlo una vez por proyecto, sin instalar nada
npx github:DaniCarnevale/lean-agents init

# O dejarlo como dependencia de desarrollo, fijado a una versión
npm i -D github:DaniCarnevale/lean-agents#v0.2.0
npx lean-agents init
```

## Primeros pasos

1. En la carpeta de tu proyecto, corré `npx github:DaniCarnevale/lean-agents init`.
2. Respondé las preguntas: herramienta (`claude`, `codex` o `both`), nombre del proyecto, idioma de las instrucciones (`es` o `en`) y preset. Los comandos de test y las carpetas de contratos los detecta solo.
3. Abrí `orchestration.toml`. Agregá las reglas del proyecto y los especialistas, y revisá los comandos de `verify`.
4. Corré `npx lean-agents sync` y después `npx lean-agents doctor`.
5. Commiteá los archivos generados, así todos los que clonen el repo tienen los mismos agentes.

## Cómo se trabaja con los agentes

**En Claude Code**

- Abrí `claude` en el proyecto. Con `/context` confirmás que cargó `CLAUDE.md`.
- Claude delega por su cuenta según la descripción de cada subagente. Con `delegation = "checkpoints"`, `reviewer` y `explorer` están marcados como "usar de forma proactiva". Con `explicit`, solo se usan cuando los pedís.
- Podés pedir un rol por nombre (*"usá el subagente reviewer sobre este diff"*) o mencionarlo con @ (`@agent-reviewer`) para asegurarte de que se use.
- Las skills se usan con `/intake`, `/verify` y `/adr`.

**En Codex**

- Abrí `codex` en el proyecto. Los agentes del proyecto se cargan solo si marcás el proyecto como confiable.
- Codex lanza subagentes cuando se lo pedís o cuando `AGENTS.md` lo indica. Para asegurarte de que se use uno, pedilo: *"lanzá reviewer sobre el diff actual"*.
- Para forzar solo lectura, configurá el sandbox de la sesión (por ejemplo `sandbox_mode` en `[codex]`). Aplica al director y a todos los subagentes.
- Las skills se usan con `$intake`, `$verify` y `$adr`.

**En las dos herramientas**

- Los subagentes hacen una sola pasada y responden con un bloque `HANDOFF` fijo (status, summary, files, checks, risks, next).
- Los cambios de comportamiento nuevos pasan por `intake` cuando son ambiguos o grandes. Para aprobar el borrador escribís `APROBADO`; para ir directo al trabajo, "sin relevamiento".
- Palabras clave en la conversación:
  - `ORQUESTACIÓN SOLO`: no delega en ese turno.
  - `ORQUESTACIÓN OFF` / `ON`: apaga o prende la delegación hasta nuevo aviso.
  - `ORQUESTACIÓN ESTADO`: informa el modo actual.

## Comandos

```bash
lean-agents init [dir]     # pregunta herramienta y preset, crea orchestration.toml y genera
lean-agents sync [dir]     # regenera después de editar orchestration.toml
lean-agents doctor [dir]   # valida; --json para CI, --strict falla también con warnings
lean-agents presets        # lista presets y alias de modelos por herramienta
```

| Opción | Comando | Qué hace |
|---|---|---|
| `--target claude\|codex\|both` | init | Herramienta(s) para las que genera |
| `--preset minimal\|standard\|web-fullstack` | init | Conjunto inicial de roles y skills |
| `--lang es\|en` | init | Idioma de las instrucciones generadas |
| `--name <nombre>` | init | Nombre del proyecto (por defecto, el de la carpeta) |
| `-y`, `--yes` | init | Acepta lo detectado sin preguntar |
| `--dry-run` | init, sync | Muestra el plan sin escribir nada |
| `--force` | init, sync | Reemplaza archivos que lean-agents no creó o que editaste (deja un `.bak`) |
| `--json`, `--strict` | doctor | Salida para máquinas / falla también con warnings |

Las opciones con valor también aceptan `--opción=valor`. Las opciones desconocidas y los flags booleanos con valor (`--force=true`) terminan con código 2.

`init` busca dependencias en los paquetes de workspace declarados en `pnpm-workspace.yaml` o en el campo `workspaces` de `package.json`. Soporta `dir/*` y rutas literales, e ignora los patrones más complejos. Solo sugiere `make check` si el Makefile tiene un target `check`.

`sync` nunca pisa un archivo que no creó ni uno que editaste a mano, salvo que pases `--force`. Lo generado queda registrado en `.lean-agents.lock.json`.

## Configuración

```toml
schema = 1
targets = ["claude", "codex"]   # "claude", "codex" o las dos
language = "es"                 # es | en
preset = "standard"             # minimal | standard | web-fullstack

[project]
name = "mi-app"
summary = "Qué es este repo, en una línea."
sources_of_truth = ["contracts/", "docs/PLAN.md"]
rules = ["No enviar datos de clientes a APIs de terceros sin aprobación."]
verify = ["pnpm lint", "pnpm test"]

[project.docs]
status = "docs/STATUS.md"
adr = "docs/adr"

[models]
director = "strong"             # alias, o { claude = "claude-opus-5-5", codex = "gpt-6.1-sol" }
director_effort = "high"        # low | medium | high | xhigh | max | ultra (se adapta a cada herramienta, ver abajo)

[models.aliases.claude]         # opcional: cambiar un alias para una herramienta
# balanced = "sonnet"

[orchestration]
delegation = "checkpoints"      # explicit: solo si se pide | checkpoints: reviewer/explorer en checkpoints
max_threads = 2                 # subagentes en paralelo
intake = "ask"                  # off | ask (cambios ambiguos o grandes) | always
keywords = true                 # ORQUESTACIÓN SOLO / OFF / ON / ESTADO

[roles.reviewer]
checklist = ["La API pública sigue siendo compatible."]

[roles.explorer]
enabled = false                 # apagar un rol del preset

[roles.pagos]                   # agregar un especialista
description = "Especialista en pagos: adaptadores de proveedores, idempotencia, webhooks y conciliación."
focus = ["claves de idempotencia", "firma de webhooks"]
model = "strong"
effort = "high"
sandbox = "workspace-write"     # o "read-only" (límites de herramientas en Claude Code, instrucciones en Codex)
instructions = "Nunca registrar datos de tarjetas."
# claude_tools = ["Read", "Grep", "Glob", "Bash"]   # opcional: herramientas explícitas en Claude Code

[claude]                        # se agrega a .claude/settings.json (salvo model y effortLevel: usá [models])
# [claude.permissions]
# deny = ["Read(./.env)"]

[codex]                         # se agrega a .codex/config.toml
# approval_policy = "on-request"
```

Los niveles de effort dependen de la herramienta y del modelo. Codex recibe el nivel tal como lo escribís. Claude Code recibe `max` en lugar de `ultra`, y su ajuste `effortLevel`, que se usa para el director, recibe `xhigh` en lugar de `max` o `ultra`. `minimal` se sigue aceptando y pasa a `low` en las dos.

Las claves desconocidas son warnings, con una sugerencia cuando hay una parecida: `` `delegaton` does not exist, did you mean `delegation`? ``. `sync` e `init` las muestran, y `doctor` las reporta como LA003, así que fallan con `--strict`. `[claude]` y `[codex]` no se validan, porque pasan tal cual a cada herramienta.

### Presets

| Preset | Roles | Skills | Delegación |
|---|---|---|---|
| `minimal` | reviewer | intake, verify | explicit, 1 en paralelo |
| `standard` | reviewer, explorer | intake, adr, verify | checkpoints, 2 en paralelo |
| `web-fullstack` | reviewer, explorer, ui_auditor | intake, adr, verify, contract-first | checkpoints, 2 en paralelo |

## doctor

`doctor` lee la configuración de agentes de cualquier repo y reporta cada problema con un id de regla, el archivo y cómo arreglarlo. Algunos ejemplos:

- **Claude Code:**
  - un `CLAUDE.md` que tapa al `AGENTS.md`;
  - subagentes sin `name` o `description`;
  - roles de solo lectura que igual pueden escribir;
  - subagentes que pueden lanzar otros subagentes;
  - skills que Claude Code no ve.
- **Codex:**
  - un `AGENTS.override.md` que tapa al `AGENTS.md`;
  - skills en una carpeta que Codex no lee;
  - claves de `[agents]` que no existen;
  - ajustes de agente que Codex ignora, como `sandbox_mode`;
  - instrucciones que superan el límite de tamaño.
- **Las dos:**
  - un protocolo de director que los subagentes también leen, sin ninguna línea que les diga que lo salteen;
  - un subagente con un modelo más fuerte que el director;
  - archivos generados que ya no coinciden con `orchestration.toml`.

```yaml
# CI
- run: npx github:DaniCarnevale/lean-agents doctor --strict
```

La lista completa de reglas está en [docs/RULES.md](docs/RULES.md). Termina con código 1 si hay errores, o también con warnings si usás `--strict`.

## Ejemplo

[`examples/sts-to-tts`](examples/sts-to-tts) es un proyecto completo configurado para las dos herramientas: una POC de traducción de voz con backend FastAPI + WebSocket y frontend React. Muestra un checklist de revisión, un especialista de audio, reglas del proyecto y los archivos generados.

## Para tener en cuenta

- Los nombres de los modelos cambian seguido. Los alias (`strong`, `balanced`, `fast`) mantienen estable tu configuración; los podés cambiar en `[models.aliases.<herramienta>]`.
- Las palabras clave de `ORQUESTACIÓN` son una convención de conversación, no una función de la herramienta. Por eso las instrucciones le indican al director que, ante la duda, asuma OFF.
- En Claude Code, los roles de solo lectura no tienen terminal, así que las verificaciones que requieren comandos las corre el director. Si querés que un rol las corra, dale `claude_tools`, sabiendo que Bash también puede escribir.
- Más agentes no es más calidad. Medí antes de escalar: corré algunas tareas reales con `ORQUESTACIÓN OFF` y con delegación, y compará tiempo, tokens y hallazgos de revisión.

El razonamiento detrás del diseño está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Licencia

MIT © Daniel Carnevale.
