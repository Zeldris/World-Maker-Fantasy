# Plan del hito `0.3` — Reino profundo

Qué entra: fila `0.3` de [«Qué entra en cada hito»](21-roadmap.md#qué-entra-en-cada-hito) y
§ `0.3` de [21-roadmap.md](21-roadmap.md#03--reino-profundo). Este plan solo fija **el orden** y el
estado; el detalle de cada tarea está en su roadmap.

**Forma de trabajo** (la del `0.2`, decisión de la usuaria del 2026-10-02): implementación continua.
Cada tarea lleva sus tests y se sube con `tsc` + `vitest` + `oxlint` en verde. Sin pasadas de juego
por tarea; las pruebas de juego van en la fase única antes de la beta (fila `0.8`). Al cerrar una
tarea: tachada aquí y en su roadmap con `✅ fecha` y lo que quede, bitácora al día, commit + push.
Cada fase con diseño abierto empieza con su ronda de preguntas (`grilling` + `domain-modeling`,
contrastada con D&D, BG3, X4, Bellwright y Medieval Dynasty).

## Fases (en orden)

Orden aprobado por la usuaria el 2026-10-06. El orden sale de las dependencias: los recuerdos y la aprobación de los NPC son la base de la
memoria del narrador y de «Charlar con NPC»; la población del Reino necesita la vivienda (ya hecha
en el `0.1`) y es la base de la defensa y de la guerra contra el Reino. La interfaz no depende de lo
nuevo del motor y se intercala entre fases.

| Fase | Tareas | Depende de | Estado |
|---|---|---|---|
| **A — Personas que recuerdan** | `CR-14` etiquetas, `CR-15` aprobación con valores, `CR-16` recuerdos de NPC, `CR-17` buscadores de historias e hilos, `CR-42` compañeros que cuentan lo de su tierra, `CR-32` reclutamiento pacífico e informantes ([Cronista Fase 4](roadmap-cronista.md#fase-4--personas-que-recuerdan--m)) | — | 🚧 diseño cerrado (2026-10-06); ~~`CR-14`~~ ✅, ~~`CR-15`~~ ✅, ~~`CR-16`~~ ✅, ~~`CR-17`~~ ✅ |
| **B — Memoria del narrador** | `CR-21` verdad obligatoria, `CR-22` callbacks por entidad, `CR-23` puntuación de recuerdos ([Cronista Fase 6](roadmap-cronista.md#fase-6--memoria-del-narrador--m)) | A | Pendiente |
| **C — Población del Reino** | Llegada de pobladores, vivienda que limita, parejas y crías, crecer y envejecer, salidas ([propuesta aprobada](../borradores-opencode/propuestas-aprobadas.md), «Ciclo vital de los pueblos») · súbditos en el panel (`REI-53`, `REI-54`) | — (vivienda del `0.1`, `CR-13`) | Pendiente |
| **D — Economía, ganadería y obras** | Economía de supervivencia de las facciones y del Reino (almacén, agua, comida, Goirnos, declive) · ganadería (oficio de ganadero y corrales por especie) · estaciones sin oficio (Leñera, Cantera, Fibrería) si hacen falta · edificios de defensa · `CR-36` las facciones construyen | C | Pendiente (números en su ronda de diseño, los decide la usuaria) |
| **E — Conflicto** | `CR-39` territorios y expansión · `CR-37` guerra contra el Reino · `CR-50` campamentos de bandidos · postura de compañero en combate · `CMB-1`…`CMB-8` | C, D (defensa) | Pendiente |
| **F — Hablar y comerciar con NPC** | «Charlar con NPC» enriquecido (Franja 4: lore, reclutar, interrogar tras Clemente) · `CR-51` comercio en persona con NPC y caravanas | A | 🧭 falta la especificación (ronda de diseño) |
| **G — Interfaz** (se intercala) | Reino R-B, R-C, R-D, R-E y `PAN-7` · `DiceTray` `DAD-7`…`DAD-12` (con el resto de `CFG-20`) · `HUD-1`…`HUD-5`, `HUD-7`…`HUD-11`, `HUD-13` · `NAR-1`…`NAR-8`, `NAR-10`, `NAR-11` · `PAN-1`…`PAN-6`, `PAN-11`…`PAN-14` · `UX-18` (epílogo con plantillas), `UX-19`, `UX-20` · `INT-5`…`INT-8`, `INT-10`, `INT-11` · `CFG-36` · UX-F `UX-32`…`UX-34`, `UX-39` | — | Pendiente |

## Decisiones que bloquean algo

| Bloquea | Pregunta |
|---|---|
| ~~Fase D~~ | ~~Números de la economía de supervivencia y de la ganadería~~ → los propone Claude en la ronda de la Fase D y los decide la usuaria (2026-10-06, como el comercio de volumen); Álvaro los revisa después |
| Fase F | Especificación de «Charlar con NPC» |

Mientras no estén, se avanza por las fases y tareas que no dependen de ellas.

## Cierre

Todas las fases hechas (o lo bloqueado apuntado como pendiente con su motivo), CI en verde →
etiqueta `v0.3.0-alpha` (la sube Álvaro). Las pruebas de juego de este hito, en la fase única.
