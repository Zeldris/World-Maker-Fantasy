# Ficha: ronda de pruebas del Mundo vivo (2026-10-23)

La fuente de todo lo que se publica de esta actualización. Lo que no esté aquí, con su fuente, no sale en los canales.

## Qué se cuenta

- **En una frase (jugador):** seis tandas jugando el Mundo vivo comprueban el combate en grupo, los viajes que se
  cortan, la energía que dan comer y beber, los maestros de oficio y la pausa entre asaltos al Reino.
- **En una frase (técnico):** agentes de IA juegan Tarkor en un navegador real, cada tanda arranca de una partida
  guardada con el estado exacto que hay que probar, y las herramientas que usan dicen ahora por qué falla algo.
- **Estado:** fusionado en `main` el 2026-10-23 · hito `0.3` «Reino profundo», puerta de pruebas. Es una ronda de
  pruebas, no una función nueva.

## Hechos comprobados

| Dato | Fuente |
|---|---|
| Tandas 22-27, 10 pasadas con las repeticiones, una detrás de otra | `docs/registros/pr/claude/pruebas-mundo-vivo.md` |
| Comprobados jugando: combate de grupo, corte de paso y viaje interrumpido, comer y beber dan energía, maestros de oficio, descripción del Pozo, enfriamiento de asaltos | Ídem, «Summary» |
| La pausa entre asaltos es de 7 días | `docs/registros/plan-comprobacion-mundo-vivo.md`, tanda 27; Portal, novedad del 2026-10-22 |
| 11 hallazgos nuevos y varios pendientes que siguen abiertos | Ídem (P320-P330; pendientes P51, P95, P163, P193…) |
| Matriz del Mundo vivo: 44 de 48 tareas jugadas | Ídem, «Evidence» |
| Antes, la orden que leía el combate atacaba al leerlo y se perdió una partida; ahora es de solo lectura y tiene test | Ídem, «Evidence» (`test_combate_leer_no_pulsa_nada`) |
| «Pulsar» decía «pulsado» sin haber pulsado nada; ahora da error con el motivo | Ídem |
| 6 escenarios (partidas guardadas, ~870 KB cada una) para arrancar cada tanda en el estado justo | Ídem, «Merge Danger» |
| 15 casos de navegador en Chromium para las ayudas de los agentes | Ídem (`ayudas_mcp_navegador.mjs`) |
| Más de 4.200 tests automáticos en el proyecto | Portal, `cifras` |
| La IA del juego corre en el equipo del jugador (Ollama) | Portal, `decisiones` |

## Lore que se cita

| Elemento | Qué se dice | Fuente del canon |
|---|---|---|
| El Pozo de Cauce Viejo | Agua permanente junto a Karot Veku | `docs/canon-opencode/` (Llanuras) |
| Karot Veku | El asentamiento del Clan Serhu, en las Llanuras del Viento Rojo | Portal, apartado «El mundo» |
| Guchapo | Escamado cauteloso que vive en grupos de 2 a 4 en el Pozo; caza insectos y lo atacan los lebudes | `docs/canon-opencode/` (fauna) |

## Imágenes

| Imagen | Texto alternativo (es / en) | Canales |
|---|---|---|
| `https://zeldris.github.io/Portal-Galivelop/proyectos/tarkor/juego-combate.webp` | Combate contra un guchapo: el diario narra cada golpe y el panel muestra el resultado / Fighting a guchapo: the journal narrates every blow and the panel shows the outcome | X, Reddit, Discord |
| `https://zeldris.github.io/Portal-Galivelop/proyectos/tarkor/juego-mapa-pozo.webp` | Mapa de zona de El Pozo de Cauce Viejo, con la fauna y los recursos del territorio / Zone map of the Old Riverbed Well, with the territory’s wildlife and resources | Reserva |
| `medios/tarjeta.es.webp` | Tarjeta: seis tandas jugando el Mundo vivo; 44 de 48 tareas jugadas, 11 fallos nuevos y más de 4.200 tests / Card in Spanish: six rounds playing the Living World; 44 of 48 tasks played, 11 new bugs and 4,200+ tests | X, Discord (es) |
| `medios/tarjeta.en.webp` | Tarjeta en inglés: seis tandas jugando el Mundo vivo, con las mismas cifras / Card: six rounds playing the Living World; 44 of 48 tasks played, 11 new bugs and 4,200+ tests | X, Discord (en) |
| `medios/flujo-pruebas.es.webp` | Diagrama: partida guardada, un agente juega en el navegador, ayudas que explican el fallo, y fallo, arreglo y test; la siguiente tanda carga la partida que dejó esta / Diagram in Spanish: saved game, an agent plays in the browser, tools that explain failures, and bug, fix and test; the next round loads the save this one left | LinkedIn, Reddit (es) |
| `medios/flujo-pruebas.en.webp` | Diagrama en inglés: el mismo flujo de pruebas con agentes / Diagram: saved game, an agent plays in the browser, tools that explain failures, and bug, fix and test; the next round loads the save this one left | LinkedIn, Reddit (en) |
| `medios/captura-mapa-pozo.webp` | Captura del juego: mapa de zona de El Pozo de Cauce Viejo, con el pozo de piedra en el centro, los caminos que salen de él y los iconos de fauna y recursos / Game screenshot: zone map of the Old Riverbed Well, with the stone well at the centre, the paths leading out and the wildlife and resource icons | Discord |

Fuentes de las imágenes propias en `medios/fuente/` (las tarjetas y el diagrama, en HTML; la captura, del escenario
`mv-pozo-guchapo-conv`, con `tools/playwright-e2e`); se renderizan con `node .claude/skills/gw-media-content/scripts/render.mjs`.

## Uso interno (no se publica)

Rama `claude/pruebas-mundo-vivo` (fusionada sin PR, CI local, `QA-215`); retro `QA-216`…`QA-221`; hallazgos
P320-P330; pendientes P51, P95, P163, P193, P290, P128, CR-43 y la cría de CR-55.

## Publicado

| Canal | Idioma | Fecha | Enlace |
|---|---|---|---|
