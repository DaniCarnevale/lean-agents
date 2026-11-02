---
name: contract-first
description: "Cambiar interfaces compartidas (OpenAPI, JSON Schema, eventos, formatos binarios) empezando por un contrato único y verificable, y después proveedor y consumidores. Usar cuando un cambio cruza frontend/backend o servicios."
metadata:
  generator: lean-agents:generated v0.2.0
---

# Contract-first

1. Identificá el contrato que gobierna la frontera (las fuentes de verdad de las instrucciones del proyecto). Si no hay uno, proponé crearlo antes de tocar código.
2. Cambiá primero el contrato. Preferí cambios compatibles: campos nuevos opcionales, valores de enum nuevos tolerados. Si es incompatible, decilo explícitamente y versioná.
3. Regenerá o actualizá tipos, validadores y mocks **desde** el contrato, no a mano en cada lado.
4. Actualizá proveedor y consumidores en el mismo cambio, o dejá documentado cuál queda pendiente.
5. Agregá o actualizá pruebas de contrato: el proveedor emite lo que el contrato dice, y el consumidor tolera lo que el contrato permite.
6. Los mocks deben respetar el mismo contrato que la ruta real; un mock que acepta lo que el real rechaza es un bug.

Un solo dueño por contrato: el director. Si sos un subagente y el cambio requiere tocar el contrato, devolvé `needs_decision` con la propuesta.
