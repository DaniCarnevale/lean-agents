---
name: intake
description: "Convertir un pedido nuevo de cambio en un borrador breve para aprobación (objetivo, alcance, fuera de alcance, aceptación, preguntas) antes de implementar. Usar cuando un pedido cambia comportamiento, alcance o criterios y es ambiguo o grande. No usar para preguntas, estado o revisiones."
metadata:
  generator: lean-agents:generated v0.3.0
---

# Relevamiento de pedidos

Lo aplica el director, en el mismo turno; no es un subagente.

1. Extraé solo lo que el usuario dijo o autorizó. No agregues funcionalidades, tecnologías, fechas, prioridades ni supuestos.
2. Mirá el contexto del proyecto solo para detectar conflictos con las fuentes de verdad de las instrucciones del proyecto.
3. Mostrá el borrador, que tiene que entrar en una pantalla:

```text
OBJETIVO: …
ALCANCE: …
NO INCLUYE: …
ACEPTACIÓN: …
PENDIENTES/PREGUNTAS: …   (o "ninguno")
ESTADO: PENDIENTE DE APROBACIÓN
```

4. Esperá. Cuenta como aprobación `APROBADO`, `APROBAR` o un equivalente inequívoco. Un "ok" ambiguo no alcanza: preguntá en una línea.
5. Si el usuario corrige, reemplazá el borrador completo y volvé a pedir aprobación. No conserves partes rechazadas.
6. Con la aprobación, el borrador pasa a ser el criterio de aceptación del trabajo: citálo al cerrar y decí qué ítems se cumplieron y cuáles no.

Si falta información, escribí `pendiente` o hacé una pregunta corta. Nunca conviertas una posibilidad en requisito.
