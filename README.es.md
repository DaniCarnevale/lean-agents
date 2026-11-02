# lean-agents

**Un estándar liviano de orquestación para subagentes de Codex, centrado en un director.**
Con un solo archivo de configuración por proyecto se generan `AGENTS.md`, `.codex/config.toml`, los agentes y las skills en las rutas que Codex realmente lee. `doctor` valida cualquier configuración de agentes de Codex, la haya generado lean-agents o no.

[English](README.md)

```bash
npx github:DaniCarnevale/lean-agents init      # detecta el stack, crea orchestration.toml y genera los archivos
npx github:DaniCarnevale/lean-agents doctor    # valida la configuración (sirve en cualquier repo)
```

## Por qué

Las configuraciones multiagente fallan sin hacer ruido. Estos errores salen de un proyecto real y hoy son reglas de `doctor`:

| Error | Qué pasa en realidad | Regla |
|---|---|---|
| `AGENTS.override.md` al lado de `AGENTS.md` | Codex carga solo el override; las reglas base (privacidad, licencias, gasto) quedan ignoradas | `LA010` |
| Skills en `.codex/skills/` | Codex busca en `.agents/skills/`; nunca las descubre | `LA040` |
| `[agents] max_concurrent_threads_per_session = 2` | No es una clave de Codex; el límite real sigue en 6 | `LA020` |
| Revisor con "no modifiques archivos" | Sin `sandbox_mode = "read-only"`, nada lo impone | `LA035` |
| Protocolo del director en `AGENTS.md` | Los subagentes también lo leen y pueden querer actuar como director | `LA012` |
| Director en el modelo rápido y un agente documental en el más fuerte | El rol que planifica e integra recibe la menor capacidad | `LA036` |

Más agentes no es más calidad. Cada subagente arranca desde cero y vuelve a leer el contexto, así que el consumo de tokens crece con cada uno que sumás. Repartir trabajo acoplado (un contrato, tres capas) también pierde contexto en cada traspaso. Delegar rinde en tres casos: **revisión independiente con contexto fresco**, **exploración de solo lectura** que ensuciaría el contexto principal y **trabajo de especialista realmente independiente**. lean-agents está armado alrededor de eso.

## Principios

1. **El director hace el trabajo.** Implementa e integra; delegar es la excepción y necesita un motivo.
2. **Pocos roles, límites reales.** Revisor y explorador son `read-only` por sandbox, no por cortesía.
3. **Una pasada por subagente**, con formato `HANDOFF` fijo, como mucho un follow-up y sin loops de reintento.
4. **Los procedimientos son skills, no agentes.** Relevamiento, ADRs, verificación y contract-first corren dentro del contexto del director y se cargan cuando hacen falta.
5. **Evidencia antes que afirmaciones.** Prohibido inventar resultados; `verify` reporta qué se corrió y qué no.
6. **Instrucciones chicas.** El `AGENTS.md` generado queda muy por debajo de 8 KB, porque cada agente lo paga en cada turno.

El razonamiento completo está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Instalación

Node.js 20+ y Codex CLI con subagentes.

```bash
# Repo privado: necesitás acceso Git a github.com/DaniCarnevale/lean-agents (clave SSH o credential manager)
npx github:DaniCarnevale/lean-agents init

# O fijalo como dependencia de desarrollo
npm i -D github:DaniCarnevale/lean-agents#v0.1.0
npx lean-agents init
```

## Uso

```bash
lean-agents init [dir]     # crea orchestration.toml (pregunta nombre, idioma, preset) y genera
lean-agents sync [dir]     # regenera después de editar orchestration.toml
lean-agents doctor [dir]   # valida; --json para CI, --strict falla también con warnings
lean-agents presets        # lista presets y alias de modelos
```

`init` y `sync` nunca pisan un archivo que no crearon ni uno que editaste a mano. En esos casos muestran `skip`, y `--force` lo reemplaza dejando una copia `.bak`. Lo generado queda registrado en un lockfile (`.codex/lean-agents.lock.json`). Con `--dry-run` ves el plan sin escribir nada.

La configuración completa y los presets están documentados en el [README en inglés](README.md#configuration). Las claves son las mismas, y `language = "es"` genera todas las instrucciones en español.

## Ejemplo

[`examples/sts-to-tts`](examples/sts-to-tts) es una POC de traducción de voz (FastAPI + WebSocket + React + STT/TTS local). Pasó de 7 agentes y 13 skills, con 2 errores y 12 warnings en `doctor`, a un director con 3 ayudantes de solo lectura y 1 especialista, sin ningún hallazgo.

## Limitaciones

- Según la documentación de Codex, los subagentes se lanzan **cuando se piden explícitamente**. `delegation = "checkpoints"` le da al director un permiso permanente en `AGENTS.md`, pero que Codex lo tome como pedido puede depender de la versión. Si el director nunca delega, pedí el rol por nombre ("usá reviewer sobre este diff").
- Las palabras clave (`ORQUESTACIÓN OFF`) son una convención de conversación, no una función de Codex. Se pueden perder al compactar el contexto, por eso las instrucciones dicen que ante la duda se asuma OFF.
- La tabla de niveles de modelos es solo una heurística para `LA036`. Los modelos desconocidos se reportan como info, nunca como error.
- Medí antes de escalar: corré las mismas tareas reales con `ORQUESTACIÓN OFF` y con delegación, y compará tokens (`/status`), tiempo y hallazgos de revisión.

## Licencia

MIT © Daniel Carnevale. Las skills son originales y no incluyen contenido de terceros.
