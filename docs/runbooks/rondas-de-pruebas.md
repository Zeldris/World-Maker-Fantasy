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
   interfaz. Con la causa si se ve, y si no bloquea, «pendiente».
4. **Arregla solo lo que bloquea** (no se puede seguir jugando, o el juego hace algo imposible): con
   su test y comprobado en vivo. Lo demás se queda apuntado para repasarlo con la usuaria.
5. Commit y push tras cada tanda de hallazgos; la tarea de la ronda en su roadmap lleva qué está
   hecho y qué falta.

## Lo que engaña

- Las narraciones del Ollama simulado meten trozos del prompt («se narró como si…»): no es un fallo.
- `GET /saves` y «la última partida» de la base de los tests pueden ser de un test en marcha: juega
  en `tarkor_juego` y saca el id de la partida de la URL (`/solitario/partida/<id>`).
- Tras reiniciar el backend, el frontend conserva datos viejos hasta recargar la página.
