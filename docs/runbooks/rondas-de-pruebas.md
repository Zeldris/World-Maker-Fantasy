# Ronda de pruebas jugando — runbook

Para cuando la usuaria pide «probar», «jugar como una jugadora» o una ronda de pruebas (`QA-27`,
retro del 2026-10-09). Herramientas: [`tools/playwright-e2e/`](../../tools/playwright-e2e/README.md).

## Qué se prueba, en este orden

`QA-44` (retro de `QA-27`, 2026-10-12):

1. **Lo arreglado en la ronda que solo tiene tests**: verlo funcionar jugando y apuntarlo como
   comprobado en el registro.
2. **Todo lo implementado, del `0.1` al hito en curso** (usuaria, 2026-10-13: hasta probarlo todo no
   se vuelve al roadmap). Las filas de
   [«Qué entra en cada hito»](../producto/21-roadmap.md#qué-entra-en-cada-hito) dicen qué entra en cada
   uno; lo que ya está probado en vivo, en
   [`checklist-pruebas-juego.md`](../registros/checklist-pruebas-juego.md).
3. Lo que el roadmap no tiene (p. ej. «Crear desde cero» en la creación de personaje) no se prueba.

**Con qué se juega** (`QA-56`, usuaria, 2026-10-12): Gorhorn, el personaje preseleccionado, con la
clase **Cazador** (la especialización, Domador, se elige a nivel 10). «Crear desde cero» es del final del
roadmap: no se abre.

Cómo provocar cada cosa (los encuentros salen al moverse por el mapa de zona, no escribiendo
«salgo a cazar») y qué está ya probado en vivo:
[`checklist-pruebas-juego.md`](../registros/checklist-pruebas-juego.md).

## Cómo se juega

1. Arranca con `bash tools/playwright-e2e/arrancar-juego.sh` (base `tarkor_juego`, aparte de la de
   los tests). Partida nueva desde el menú, como una jugadora. Para manejar el navegador con el MCP
   de Playwright, carga antes las ayudas de `tools/playwright-e2e/mcp/` (`QA-46`, su README).
2. Juega paso a paso y **mira la pantalla** en cada paso (captura): botones, textos, mapa, avisos.
   Un bucle automático (combate, caminar) solo para repetir algo ya visto; lo nuevo se juega a mano.
3. Apunta cada hallazgo en el registro de la ronda (`docs/registros/pruebas-<hito>-hallazgos.md`,
   tabla `| P<n> | Hallazgo | Estado |`): fallos, incoherencias de texto o de lore, y detalles de
   interfaz, con la causa si se ve. Con `tools/qa/marca-hallazgo.py` (`QA-42`, `QA-47`):
   `--nuevo "<hallazgo>" "<estado>"` añade la fila con el siguiente número, y
   `P<n> "<texto viejo>" "<texto nuevo>"` cambia su estado.
4. **La ronda no escribe código** (`QA-45`, petición de la usuaria del 2026-10-12): la prioridad es
   probar. Solo se arregla un fallo **bloqueante** (no se puede seguir jugando, o el juego hace algo
   imposible), con su test y comprobado en vivo; que el test falle sin el arreglo se comprueba con
   `tools/qa/rojo-sin-arreglo.sh` (`QA-58`). Lo demás va al registro como «pendiente»; las
   mejoras y el diseño, al roadmap como tarea con hito. Las retros y los arreglos de lo apuntado se
   hacen antes o después de la ronda, no en medio. Si el MCP de Playwright no conecta,
   `driver.mjs` de `tools/playwright-e2e/` (`QA-41`), con las mismas ayudas: `orden.sh --ayuda
   <archivo> '<tk>'` (`QA-57`).
5. Antes de pasar la suite con base real, `bash tools/playwright-e2e/arrancar-juego.sh --parar`: con el
   juego y el driver en marcha, la carga suma fallos por tiempo límite (`QA-65`).
6. Commit y push tras cada tanda de hallazgos; la tarea de la ronda en su roadmap lleva qué está
   hecho y qué falta.
7. **Al final, no por tanda:** `/code-review` **antes de crear** el PR a `main` y `/retro` **después de
   fusionarlo** (usuaria, 2026-10-13; sustituye al `/code-review` cada 5-6 hallazgos de `QA-40`; `QA-77`).

## Lo que engaña

- Las narraciones del Ollama simulado meten trozos del prompt («se narró como si…») o frases fijas
  («El personaje observa con atención a su alrededor…»): no es un fallo. `estado.js` las marca
  «[simulado]» (`QA-60`).
- `GET /saves` y «la última partida» de la base de los tests pueden ser de un test en marcha: juega
  en `tarkor_juego` y saca el id de la partida de la URL (`/solitario/partida/<id>`).
- Tras reiniciar el backend, el frontend conserva datos viejos hasta recargar la página.
