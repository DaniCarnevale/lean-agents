---
name: adr
description: "Proponer y mantener Architecture Decision Records (ADR) con contexto, decisión, alternativas y consecuencias, más su índice. Usar ante una decisión técnica durable (tecnología, protocolo, estructura) o cuando alguien pregunta por qué el sistema es así. No usar para bugs, tareas o cada commit."
metadata:
  generator: lean-agents:generated v0.2.0
---

# Architecture Decision Records

La carpeta de ADRs está indicada en las instrucciones del proyecto (por defecto `docs/adr/`), con un índice en `README.md` dentro de ella.

**Cuándo sí:** elegir o reemplazar una tecnología, un protocolo, un formato compartido, una estructura del sistema, o aceptar un trade-off que alguien va a querer entender dentro de meses.
**Cuándo no:** bugs, tareas, mediciones aisladas, cambios de copy, cada commit.

## Flujo

1. Antes de implementar, prepará un ADR con estado `proposed` y mostralo. No escribas el archivo hasta tener aprobación explícita. Si la carpeta no existe, pedí confirmación antes de crearla.
2. Después de implementar y probar, agregá evidencia y consecuencias reales; proponé `accepted` solo si la decisión está efectivamente adoptada.
3. Si una decisión cambia, marcá la anterior `superseded` con enlace a la nueva. No borres historia.

## Plantilla (`NNNN-titulo-en-kebab.md`)

```markdown
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
```

Actualizá el índice con número, título y estado. Una sola fuente: no dupliques decisiones en otros documentos; enlazá al ADR.
