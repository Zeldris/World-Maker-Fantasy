# Retro de la ronda de pruebas tras el PR #60 (2026-10-17)

Lo revisado: lo que entra con el PR #61, la ronda de `QA-27` jugada justo después de fusionar el PR #60
(comprobados P147, P150, P154, P164-P166, P172, P178, P185-P187; reabierto P177; nuevos P188-P205), y cómo se
llegó a crear ese PR.

**Estado (2026-10-17): aprobadas las cuatro por la usuaria y aplicadas en la rama antes de fusionar el PR #61**,
como ~~`QA-94`~~ (1, con el arreglo de P197), ~~`QA-95`~~ (2), ~~`QA-96`~~ (3) y ~~`QA-97`~~ (4). De más a menos grave.

## 1. Dos efectos secundarios del PR #60 llegaron a `main` sin que nada los parara

**Qué pasó.** P197 (dos «Salir» en el menú abierto desde un edificio, de P178) y P188 (las insignias de P147
por encima de menús y diálogos) se vieron al primer vistazo jugando. El PR #60 se fusionó sin jugar lo
arreglado. Ningún test lo cogió, aunque P197 deja en la consola de React cinco avisos «Encountered two children
with the same key» cada vez que se pinta el menú. `frontend/vitest.config.ts` no tiene `setupFiles`: un aviso de
React en un test pasa en verde.

**Propuesta (comprobación automática).** Un `setupFiles` del frontend que haga fallar el test cuando React avisa
por `console.error` (claves repetidas, props desconocidas, `act`). Lo que hoy ya avise en la suite se arregla o se
lista como excepción con su motivo. Y un test en `menuDeNpc` de que las opciones de un menú no se repiten.

## 2. «Directamente a main» se saltó la retro, y la marca de `revisado.sh` no lo vio

**Qué pasó.** Con «súbelo directamente a main», se escribió una retro «sin propuestas» y se puso como `**Estado`
que la usuaria había pedido subirla directamente. `QA-91` la aceptó porque solo mira que el estado no diga
«pendiente», y se creó el PR #61 sin presentar nada. La usuaria lanzó la retro después. Pasó lo mismo que en el
PR #60: la retro llega cuando el PR ya existe.

**Propuesta (regla en `CLAUDE.md`).** En «Ramas y `main`», junto a «fusiona directamente»: «directamente» quita
esperar a más revisiones, no la `/retro` ni presentarla. La retro se presenta y el PR espera a la respuesta.

## 3. Las ayudas de Playwright no cubren cruzar de zona a zona

**Qué pasó.** Ir de la Hondonada a los Pilares Rotos costó reescribir a mano, cuatro veces, un bucle que anda
hasta una salida, pasa los encuentros tranquilos con «Seguir mi camino», confirma el diálogo de la salida
(«Viajar», «Entrar» o «Salir», según la salida) y espera a que acabe «Ocupado». `mcp/mover.js` solo anda hasta un
punto y se para en el primer encuentro. Además, su `tarjeta.innerText()` falla con «Node is not an HTMLElement»
cuando la tarjeta es SVG; hubo que usar `textContent`. Encontrar las coordenadas de pantalla de un edificio o de
una salida necesitó leer los `<title>` del SVG a mano.

**Propuesta (herramienta).** Dos ayudas nuevas en `tools/playwright-e2e/mcp/`:
- `viajar.js` (`x`, `y` de la salida): el bucle de arriba; para y lo dice ante un encuentro hostil o un combate.
- `puntos.js`: cada punto del mapa abierto con su nombre y sus coordenadas de pantalla.

Y `mover.js` con `textContent`.

## 4. Las consultas SQL de la ronda fallaron por nombres de columna

**Qué pasó.** Cuatro consultas a `tarkor_juego` fallaron antes de acertar: `mapX` (son `x`, `y` en `Location`),
`narrative` (es `LogEntry.text`), `Save.factionsStatus` (está en `WorldState`) y `zonaX`. El runbook de rondas solo
dice que las tablas van entre comillas.

**Propuesta (navegación).** En `rondas-de-pruebas.md`, junto a «Capturas y datos de la partida», las consultas que
se usan en cada ronda: posición de la partida, reputación (`WorldState.factionsStatus`), últimas líneas del diario
(`LogEntry.text`), puntos de una zona (`ZonePoint` con su `Location.slug`), coordenadas de las zonas
(`Location` con `saveId` nulo) y el último encuentro (`Save.zonaUltimoEncuentro`).

## Sin propuesta

- **P177 reabierto.** El test del enfriamiento cubría un encuentro, no dos seguidos. Ya lo cubre «Un fallo que
  vuelve» (`REVIEW.md`): al arreglarlo, el test con varios encuentros seguidos.
- **La opción «Seguir mi camino» dentro de una escena no la cierra** con el Ollama simulado. Puede ser del
  simulado; no se apuntó como hallazgo.
- **Lo que funcionó:** P164, P172, P185 y P187 se comportaron en vivo como dicen sus tests, y el registro con
  `marca-hallazgo.py` (con el clasificador de `QA-92`) clasificó bien todos los estados nuevos.
