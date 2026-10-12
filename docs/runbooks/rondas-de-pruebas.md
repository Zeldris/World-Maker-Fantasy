# Ronda de pruebas jugando — runbook

Para cuando la usuaria pide «probar», «jugar como una jugadora» o una ronda de pruebas (`QA-27`,
retro del 2026-10-09). Herramientas: [`tools/playwright-e2e/`](../../tools/playwright-e2e/README.md).

## Cómo se juega

1. Arranca con `bash tools/playwright-e2e/arrancar-juego.sh` (base `tarkor_juego`, aparte de la de
   los tests). Partida nueva desde el menú, como una jugadora.
2. Juega paso a paso y **mira la pantalla** en cada paso (captura): botones, textos, mapa, avisos.
   Un bucle automático (combate, caminar) solo para repetir algo ya visto; lo nuevo se juega a mano.
3. Apunta cada hallazgo en el registro de la ronda (`docs/registros/pruebas-<hito>-hallazgos.md`,
   tabla `| P<n> | Hallazgo | Estado |`): fallos, incoherencias de texto o de lore, y detalles de
   interfaz. Con la causa si se ve, y si no bloquea, «pendiente». Para cambiar el estado de una fila:
   `python3 tools/qa/marca-hallazgo.py P<n> "<texto viejo>" "<texto nuevo>"` (`QA-42`).
3b. Para decidir qué probar y cómo (p. ej. los encuentros salen al moverse por el mapa de zona, no
   escribiendo «salgo a cazar»), mira [`checklist-pruebas-juego.md`](../registros/checklist-pruebas-juego.md):
   qué está probado en vivo, qué solo con tests y qué falta.
4. **Arregla solo lo que bloquea** (no se puede seguir jugando, o el juego hace algo imposible): con
   su test y comprobado en vivo (si el MCP de Playwright no conecta, `driver.mjs` de
   `tools/playwright-e2e/`, `QA-41`). Lo demás se queda apuntado para repasarlo con la usuaria.
5. Commit y push tras cada tanda de hallazgos; la tarea de la ronda en su roadmap lleva qué está
   hecho y qué falta.
6. **`/code-review` cada 5-6 hallazgos arreglados** (`QA-40`, retro de `QA-27`), no solo al final: la
   de `QA-27` revisó 30 commits de golpe y sacó 10 fallos.

## Lo que engaña

- Las narraciones del Ollama simulado meten trozos del prompt («se narró como si…»): no es un fallo.
- `GET /saves` y «la última partida» de la base de los tests pueden ser de un test en marcha: juega
  en `tarkor_juego` y saca el id de la partida de la URL (`/solitario/partida/<id>`).
- Tras reiniciar el backend, el frontend conserva datos viejos hasta recargar la página.
