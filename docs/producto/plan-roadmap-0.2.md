# Plan del hito `0.2` — Facciones vivas

Qué entra: fila `0.2` de [«Qué entra en cada hito»](21-roadmap.md#qué-entra-en-cada-hito) y
§ `0.2` de [21-roadmap.md](21-roadmap.md#02--facciones-vivas). Este plan solo fija **el orden** y el
estado; el detalle de cada tarea está en su roadmap.

**Forma de trabajo** (decisión de la usuaria, 2026-10-02): implementación continua. Cada tarea lleva
sus tests y se sube con `tsc` + `vitest` + `oxlint` en verde. Sin pasadas de juego por tarea; las
pruebas de juego van en la fase única antes de la beta (fila `0.8`). Al cerrar una tarea: tachada
aquí y en su roadmap con `✅ fecha` y lo que quede, bitácora al día, commit + push.

## Fases (en orden)

El orden sale de las dependencias: el motor de eventos necesita el mundo por partida, y este
necesita el Libro de Sucesos. La interfaz base va pronto porque lo nuevo se apoya en ella.

| Fase | Tareas | Depende de | Estado |
|---|---|---|---|
| **A — Libro de Sucesos** | `CR-1`…`CR-4` ([Cronista § 17, Fase 1](roadmap-cronista.md#fase-1--libro-de-sucesos-sin-ia--m-l)). Pasan del `0.1` al `0.2`: son la base de todo el Cronista de este hito | — | ✅ 2026-10-02: ~~`CR-1`~~, ~~`CR-2`~~, ~~`CR-3`~~, ~~`CR-4`~~. Queda para la fase única de pruebas: jugar 1 hora y revisar el Libro en `/admin/partida/:id/libro` |
| **B — Interfaz base** | **UX-B** estado único (`UX-1`, `UX-2`, `UX-5`, `UX-7`, `UX-8`) y **UX-C** orden (`UX-9`…`UX-12`), `UX-6`, `UX-14` ([roadmap-front-ux.md](roadmap-front-ux.md)) · `BAS-3`, `BAS-5`, `BAS-7`, `BAS-8`, `BAS-9` · `MOD-1`…`MOD-6` · `HUD-6`, `HUD-12` · configuración básica `CFG-1`…`CFG-6`, `CFG-9`, `CFG-13`, `CFG-14`, `CFG-20`, `CFG-26`, `CFG-28` ([roadmap-front.md](roadmap-front.md)) | — | 🚧 ~~`UX-1`~~ ✅, ~~`UX-2`~~ ✅; ~~`UX-5`~~ ✅, ~~`UX-7`~~ ✅, ~~`UX-37`~~ ✅ (responder escribiendo), ~~`UX-8`~~ ✅ → **UX-B cerrada**; UX-C: ~~`UX-9`~~ ✅ (gestor de capas), ~~`UX-10`~~ ✅ (decisiones en cola), ~~`UX-11`~~ ✅, ~~`UX-12`~~ ✅ → **UX-C cerrada**; ~~`UX-6`~~ ✅ (opción B), ~~`BAS-3`~~ ✅, ~~`BAS-5`~~ ✅ 2026-10-06 (`GameHeader`, `GameFooter`, `GameModals`, `GameLayout`, `GamePanelCajon` con `GameViewContext`), ~~`MOD-1`~~ ✅ (`ModalShell`), ~~`MOD-2`~~ ✅ (estados), ~~`MOD-3`~~ ✅ (teclado), ~~`MOD-4`~~ ✅ (ceremonia), ~~`MOD-5`~~ ✅ (`QuantityStepper`), ~~`MOD-6`~~ ✅ (miniaturas) → **MOD-1…6 cerrados**, ~~`HUD-6`~~ ✅ (notificaciones), ~~`HUD-12`~~ ✅; configuración básica: ~~`CFG-1`~~, ~~`CFG-4`~~, ~~`CFG-5`~~, ~~`CFG-6`~~, ~~`CFG-9`~~, ~~`CFG-13`~~, ~~`CFG-14`~~, ~~`CFG-28`~~ ✅, 🚧 `CFG-20` (falta dónde se muestran y saltar); ~~`CFG-2`~~ ✅ (Esc), ~~`CFG-3`~~ ✅ (pausa), ~~`CFG-26`~~ ✅ (atajos) → **configuración básica hecha** (salvo parte de `CFG-20`); ~~`BAS-8`~~ ✅ (componentes base), ~~`BAS-9`~~ ✅ (`/admin/ui`); ~~`BAS-7`~~ ✅ 2026-10-06 (opción A: `usePresence` y `Presencia` para cajón, notificaciones y modales; View Transitions al plegar y en pestañas). **Fase B cerrada con pendientes apuntados** (2026-10-02): ~~resto de `BAS-5`, salida de `ModalShell` y View Transitions (`BAS-7`)~~ ✅ 2026-10-06; ~~saltar tiradas (`CFG-20`)~~ ✅ 2026-10-06; quedan `UX-14` (espera `ZON-1` 🧭) y de `CFG-20` dónde se muestran las tiradas (con `DAD-7`, `0.3`) |
| **C — Mundo por partida** | `CR-5`…`CR-8` ([Cronista Fase 2](roadmap-cronista.md#fase-2--mundo-por-partida--l)) | A | ✅ 2026-10-04: ~~`CR-5`~~ (esquema), ~~`CR-6`~~ (clonado por partida), ~~`CR-7`~~ (avance diario por partida), ~~`CR-8`~~ (migración; falta ejecutarla con `--aplicar` en la base real) |
| **D — Motor de eventos y facciones** | `CR-9`…`CR-13` ([Cronista Fase 3](roadmap-cronista.md#fase-3--motor-sin-ia--l)) = el motor de eventos de mundo unificado · economía de supervivencia de facción 🧭 · IA de decisión de facción · misiones secundarias por motor ([21-roadmap § 0.2](21-roadmap.md#02--facciones-vivas)) | C | 🚧 ~~`CR-9`~~ ✅ (efectos), ~~`CR-10`~~ ✅ (reacciones en cola), ~~`CR-11`~~ ✅ (consecuencias aplazadas: sucesión, refugiados, deuda de vida, venganza) 2026-10-04; ~~`CR-12`~~ ✅ (narrador de fondo, 12a-12d: motor y «Ritmo del mundo», cadenas, tormentas y hambruna, rumores, rastros, resumen, «Ayudar» y oportunidades) 2026-10-04; ~~`UX-38`~~ ✅ (noticias con icono, oportunidad y resumen plegado); ~~`CR-13`~~ ✅ (quien destaca, nombres, herencia, edad, madurez, vejez y nacimientos) → **Cronista Fase 3 cerrada**; ~~**IA de decisión de facción = `CR-34`**~~ ✅ 2026-10-05 (carencias, expediciones dirigidas, diplomacia, propuestas al Reino, simulación de 60 días; ~~`CR-35`~~ ✅; la expansión pasa a `CR-39` en el `0.3`); queda: economía de supervivencia 🧭 (pregunta 5 a Álvaro). ~~Misiones por motor = `CR-40`~~ ✅ 2026-10-05 (PR #16) |
| **E — Rumores y Leyendas** | ~~`CR-18`~~ ✅, ~~`CR-19`~~ ✅, ~~`CR-20`~~ ✅ ([Cronista Fase 5](roadmap-cronista.md#fase-5--conocimiento-y-lo-que-ve-el-jugador--m)) · ~~`PAN-9b`~~ ✅ · ~~`INT-1`…`INT-4`, `INT-9`, `NAR-9`~~ ✅, ~~`CFG-34`~~ ✅, ~~`CFG-35`~~ ✅ | D | ✅ 2026-10-05 (todas sus tareas; falta su `/code-review` y su `/retro`) |
| **F — Mapa de zona** | ~~Z-B~~ ✅, Z-C (🧭 `ZON-1`: dónde vive el mapa), ~~Z-D~~ ✅ ([roadmap-front-zona.md](roadmap-front-zona.md)) | B | 🚧 Z-B ✅ y Z-D ✅ 2026-10-05 (ruta, coste, parar, velocidad, tarjeta y menú, radio, parcelas; amenaza, ruta con riesgo, patrullas y estados de las fichas); de Z-C, `ZON-5` ✅ (el encuentro no cierra el mapa) y el resto bloqueado por `ZON-1` (Álvaro) |
| **G — Resto del juego** | IA de combate NPC (`CR-44`, `CR-45`) · comercio de volumen Reino↔facción (`CR-47`) (incluye comerciar con las caravanas del narrador de fondo, Q14 de `CR-12`; el comercio en persona pasa a `CR-51`, `0.3`) · expediciones en el mapa de mundo (`CR-46`) · pasada de rendimiento del avance diario (`CR-48`) · ~~**UX-F** `UX-29`…`UX-31`, `UX-35`, `UX-36`~~ ✅ 2026-10-05 | D | ✅ 2026-10-06 (`CR-44`…`CR-48` y `CR-49` salvo 49c, que espera a Álvaro; PR #21) |

## Decisiones que bloquean algo (de Álvaro)

| Bloquea | Pregunta |
|---|---|
| Fase D (economía) | Números de la economía de supervivencia de facción (`propuestas-lore.md`) |
| Fase F (Z-C) | ¿Dónde vive el mapa de zona? (`ZON-1`) |
| ~~Fase G (comercio)~~ | ~~Fórmula del comercio de volumen~~ ✅ decidida por la usuaria el 2026-10-05 (`CR-47`); Álvaro la revisa después |

Mientras no estén, se avanza por las fases y tareas que no dependen de ellas.

## Cierre

Todas las fases hechas (o lo bloqueado apuntado como pendiente con su motivo), CI en verde →
etiqueta `v0.2.0-alpha` (la sube Álvaro). Las pruebas de juego de este hito, en la fase única.
