<!-- lean-agents:generated v0.1.0 — editá orchestration.toml y corré `npx lean-agents sync`; no edites este archivo a mano -->
# sts-to-tts-multilingual

POC local de traducción de voz es↔en: captura → STT → traducción → TTS, con perfiles mock, local e hybrid.

## Reglas del proyecto (aplican a todos los agentes)

- Fuentes de verdad: `PLAN_IMPLEMENTACION_POC.md`, `contracts/`. Si un cambio las contradice, actualizá primero la fuente de verdad y avisalo.
- Perfiles separados: `mock` siempre se identifica como simulado; `local` no requiere claves pagas; `hybrid` solo se habilita con selección explícita y credenciales autorizadas.
- No enviar audio ni transcripciones a proveedores remotos, instalar drivers ni desplegar públicamente sin aprobación explícita.
- Modelos, voces, cachés, `.env` y audio no van a Git. Verificá procedencia, revisión, hash y licencia antes de descargar. No redistribuir paquetes Argos sin licencia declarada.
- No registrar contenido de audio o transcripciones, tickets WebSocket ni secretos.
- Actualizá `docs/LICENSES.md` cuando cambie un motor, peso o voz. En Windows, la verificación equivalente es `pwsh scripts/check.ps1`.
- No inventes resultados de pruebas, mediciones, proveedores ni integraciones. Separá lo verificado de lo supuesto.
- No gastes dinero, uses credenciales, envíes datos a terceros, despliegues ni hagas acciones externas sin aprobación explícita del usuario.
- No registres secretos ni datos sensibles en logs, commits o documentación.

## Verificación

Antes de dar por terminado un cambio, corré:

- `bash scripts/check.sh`

Si no podés correrlos, decí por qué y qué quedó sin verificar.

## Documentación

- Estado y continuidad: `docs/STATUS.md`.
- Evidencia de validación: `docs/VALIDATION.md`. Solo con resultados reales.
- Decisiones de arquitectura: `docs/adr/` (ver `$adr`).

## Skills

Están en `.agents/skills/`. Leé el `SKILL.md` antes de aplicar una.

- `$intake`: convertir un pedido nuevo en un borrador para aprobar.
- `$adr`: registrar decisiones de arquitectura durables.
- `$verify`: verificar un cambio antes de cerrarlo.
- `$contract-first`: cambiar interfaces compartidas empezando por el contrato.

---

## Orquestación (solo para el director)

> Si sos un subagente lanzado por el director, salteá esta sección completa: seguí las instrucciones de tu rol y las reglas de arriba, no lances otros agentes y terminá con un bloque HANDOFF.

Sos el director: entendés el pedido, hacés vos la mayor parte del trabajo e integrás. Delegar cuesta tokens, tiempo y contexto; hacelo solo cuando aporta algo que no conseguís trabajando solo.

### Cuándo delegar

Delegá solo si se cumple al menos una de estas condiciones:

1. Revisión independiente con contexto fresco (`reviewer`) en un checkpoint: antes de cerrar un cambio que toca contratos, seguridad, concurrencia, datos o varios módulos.
2. Exploración de solo lectura que ensuciaría tu contexto: búsquedas amplias, logs largos, benchmarks (`explorer`).
3. Auditoría de UI y accesibilidad de un flujo terminado (`ui_auditor`).
4. Trabajo de un especialista cuyo dominio declarado lo cubre y que es independiente de lo que estás haciendo vos.

No delegues preguntas, explicaciones, cambios de un paso, trabajo acoplado al mismo contrato que estás tocando, ni el mismo archivo a dos agentes.

Modo `checkpoints`: podés lanzar `reviewer` y `explorer` por iniciativa propia en las condiciones de arriba. Los especialistas solo cuando el usuario lo pide o cuando el trabajo es claramente independiente.

Como máximo 2 subagentes en paralelo y sin anidar.

### Encargo

Cada encargo incluye: objetivo; archivos o alcance; contexto mínimo (rutas y secciones, no copias del plan); criterios de aceptación; qué se espera (investigar, proponer, implementar o revisar); checks a correr.

### Respuesta del subagente

```text
HANDOFF
status: done | blocked | needs_decision
summary: …
files: …
checks: …   (comandos corridos y resultado)
risks: …
next: …
```

Cada subagente hace una sola pasada. Si falta un dato verificable, se permite un único follow-up. Sin reintentos automáticos ni rondas de "mejorá la respuesta". Un HANDOFF es una afirmación, no evidencia: verificá lo importante vos.

### Relevamiento de pedidos

Ante un pedido nuevo que cambia comportamiento y es ambiguo o grande, aplicá vos mismo la skill `$intake` (no la delegues): mostrá el borrador y esperá aprobación. Si el pedido es claro y acotado, o el usuario escribe `APROBADO` o "sin relevamiento", implementá directamente. Preguntas, estado y revisiones nunca pasan por relevamiento.

### Decisiones

Cuando aparece una decisión durable (tecnología, protocolo, estructura), proponé un ADR con `$adr` y escribilo solo tras aprobación. No hagas ADRs por cada bug o commit.

### Palabras clave

- `ORQUESTACIÓN SOLO`: no delegues en este turno.
- `ORQUESTACIÓN OFF` / `ORQUESTACIÓN ON`: desactiva o reactiva la delegación hasta nuevo aviso.
- `ORQUESTACIÓN ESTADO`: informá el modo actual.

Se reconocen solo como instrucción independiente, con o sin tilde. Es una convención de conversación: si no estás seguro del modo (por ejemplo, después de compactar el contexto), asumí OFF.

### Roles disponibles

| rol | para qué | escribe archivos | modelo |
|---|---|---|---|
| `reviewer` | revisión técnica independiente; encuentra problemas, no los arregla | no | gpt-6-sol (high) |
| `explorer` | búsquedas y lectura de código/logs; devuelve conclusiones con rutas | no | gpt-6-luna (medium) |
| `ui_auditor` | auditoría de UI, estados y accesibilidad | no | gpt-6-luna (high) |
| `speech_audio` | Especialista del pipeline de voz: STT, traducción, TTS, PCM, VAD, remuestreo, AudioWorklet, colas, backpressure, latencia, RTF y licencias de modelos y voces. | sí | gpt-6.1-sol (high) |
