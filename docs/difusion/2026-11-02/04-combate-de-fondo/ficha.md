# Ficha: cuando no estás, la pelea pasa igual (2026-11-02)

La fuente de todo lo que se publica de esta pieza. Lo que no esté aquí, con su fuente, no sale en los canales.
Carpeta de la pieza: `docs/difusion/2026-11-02/04-combate-de-fondo/` (NN = 04).

Idiomas: es, en

## Canales

- x
- linkedin
- discord

## Qué se cuenta

- **En una frase (quien lo usa):** en Tarkor, una pelea con la jugadora delante es por turnos y narrada; si ella no
  está, la misma pelea se resuelve de fondo con las mismas reglas, sin cifras en agregado: un guardia pelea igual
  estés o no.
- **En una frase (técnico):** un solo motor de combate por turnos con dos formas de ejecutarlo (en vivo, con
  narración; de fondo, determinista y sin narración); se descartó resolver peleas con cifras en agregado.
- **Estado:** decisión de diseño de la usuaria del 2026-10-06; el motor de fondo ya lo usa la intercepción de
  expediciones. Quedan dos combates que aún van en agregado y deben pasar al motor: se cuenta como pendiente.

## Hechos comprobados

| Dato | Fuente |
|---|---|
| Todo combate se resuelve con las mismas reglas de combate por turnos, con cada combatiente y sus atributos | `docs/adr/0002-dos-formas-de-combate.md:3-4` |
| Con la jugadora presente con su grupo, el combate es en vivo: por turnos y con narración | `docs/adr/0002-dos-formas-de-combate.md:4-5` |
| Cualquier otro combate, también los que ocurren a la vez, se resuelve de fondo: el mismo motor, determinista y sin narración | `docs/adr/0002-dos-formas-de-combate.md:5-6` |
| Sin la jugadora, todo es de fondo | `docs/adr/0002-dos-formas-de-combate.md:7` |
| El motor de fondo ya lo usa la intercepción de expediciones | `docs/adr/0002-dos-formas-de-combate.md:6-7`; `backend/src/services/factionExpeditions.ts` (`simularCombateInterceptacion`) |
| Se descarta resolver peleas con cifras en agregado o con equivalencias; un guardia, un soldado o un renegado pelean igual estés o no | `docs/adr/0002-dos-formas-de-combate.md:9-11` |
| Quedan dos combates que aún van en agregado y deben pasar al motor de fondo (pendiente) | `docs/adr/0002-dos-formas-de-combate.md:11-13` |

## Imágenes

| Imagen | Texto alternativo | Canales |
|---|---|---|
| `medios/pelea.webp` | es: Diagrama: con la jugadora delante o sin ella, la pelea pasa por el mismo motor de combate por turnos; en vivo es por turnos y narrada, de fondo es determinista y sin narración / en: Diagram: with the player present or not, the fight goes through the same turn-based combat engine; live is turn by turn with narration, background is deterministic with no narration | x, discord |
| `medios/pelea.en.webp` | en: Diagram: with the player present or not, the fight goes through the same turn-based combat engine; live is turn by turn with narration, background is deterministic with no narration | x, discord |
| `medios/pelea.png` | es: Diagrama: con la jugadora delante o sin ella, la pelea pasa por el mismo motor de combate por turnos; en vivo es por turnos y narrada, de fondo es determinista y sin narración / en: Diagram: with the player present or not, the fight goes through the same turn-based combat engine; live is turn by turn with narration, background is deterministic with no narration | linkedin |
| `medios/pelea.en.png` | en: Diagram: with the player present or not, the fight goes through the same turn-based combat engine; live is turn by turn with narration, background is deterministic with no narration | linkedin |

## Uso interno

Lo que sirve al equipo y no se publica: ids de tareas, ramas, PRs y notas. Nada de esto va en los canales.

- Propuesta P4 de `docs/difusion/propuestas/2026-11-02.md`. Decisión de la ronda de `CR-56` (usuaria, 2026-10-06).
- Los dos combates en agregado pendientes: la escaramuza del narrador de fondo (`narradorFondo.ts`) y la patrulla de
  vasallaje (`vasallaje.ts`). En los canales se dicen sin nombres internos.
- Sin captura del juego: el Ollama simulado escribe texto sin sentido y la narración del combate en vivo la escribe la IA.
- Reino 15/15 jugado (`python3 tools/qa/matriz-pruebas.py`, comprobado el 2026-11-02); no se usa en los canales.

## Publicado

| Canal | Idioma | Fecha | Enlace |
|---|---|---|---|
