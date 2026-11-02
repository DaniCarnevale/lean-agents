---
name: verify
description: "Verificar un cambio antes de darlo por terminado: correr los comandos de verificación del proyecto, revisar el diff y reportar qué se comprobó y qué no. Usar al cerrar una feature, un fix o antes de un commit o PR."
metadata:
  generator: lean-agents:generated v0.1.0
---

# Verificación

1. Corré los comandos de la sección "Verificación" de AGENTS.md, en ese orden. Si no hay, usá los tests existentes más cercanos al cambio.
2. Si un comando falla, no sigas acumulando cambios: diagnosticá, arreglá y volvé a correr.
3. Revisá el diff completo (`git diff`, incluidos archivos nuevos): código muerto, debug olvidado, secretos, cambios fuera de alcance, archivos generados o binarios que no deberían estar.
4. Comprobá que los criterios de aceptación (del encargo o del relevamiento aprobado) se cumplen uno por uno.
5. Reportá:

```text
VERIFICACIÓN
corrido:      comando → resultado (pasó / falló, cantidad de tests)
no corrido:   comando → motivo
criterios:    ítem → cumplido / no cumplido / sin evidencia
riesgos:      …
```

Nunca digas que algo pasa sin haberlo corrido en esta sesión. Si una prueba depende de hardware, red o credenciales que no tenés, marcala "no corrido" y explicá qué haría falta.
