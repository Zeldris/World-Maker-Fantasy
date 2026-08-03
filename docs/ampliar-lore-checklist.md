# Ampliar lore — checklist persistente

Registro cronológico (más antiguo arriba, añadir SIEMPRE al final) de qué se ha añadido en cada
sesión de "ampliamos lore" (ver `docs/ampliar-lore.md` para el runbook) y qué queda pendiente de
llevar a código. La sección "Pendiente de código" es la que importa entre sesiones — la lista de
tareas de una conversación no sobrevive al cierre de la sesión, este archivo sí.

---

## Pendiente de código (acumulado, revisar antes de cerrar cada pasada)

*(vacío — todo lo de la sesión 2026-08-03 se llevó a código el mismo día, ver más abajo)*

---

## Sesión 2026-08-03 — historia orca profunda + cronología del mundo

Primera sesión con este formato. Resumen de lo escrito (detalle completo en los propios `.md`, no
repetido aquí):

- **Historia orca profunda** (`areas.md` § Los clanes orcos): los 4 primeros orcos (Kekta, Tevya,
  Megug, Kegoht) → fundación de Tarkurok/Maktor → guerra Goirnte → golpe de Ketg (nace Clan Serhu)
  → migración → fundación de Helsig (Helsa+Bregnor) y Goshg (Gosha+Dulgar) → generación del padre
  de Gorhorn → caída del Clan Maktor. Incluye la etimología Makt'orik→Maktor (el Canizor, nueva
  fauna) y el emblema del clan.
- **Historia de Gorhorn reescrita** (`personajes.md`): descartada la versión anterior (padre muerto
  al nacer Gorhorn en duelo contra Serhu, exploración a los 7, entrenamiento a los 14, Concordia a
  los 18). Nueva: padre vivo hasta los 10 años de Gorhorn, lidera revuelta, muere en la cruzada
  Goirnte que aniquila el clan; años 10-20 de Gorhorn como ayudante de comerciantes → 4 años
  esclavo Goirnte → 1 año con los Faerus → resto con Goshg/Helsig (incluye lo ya establecido de
  Hagar). Tótem Maktor redefinido como fragmento tallado por Gorhorn, cosmético, no el artefacto
  ancestral completo.
- **Torgash desvinculado** del duelo del padre de Gorhorn (`npcs.md`, `areas.md`) — pendiente en
  código, ver arriba.
- **Dos documentos nuevos de cronología**: `cronologia-mitica.md` (antes del año 0, Semillas/Tarkor/
  Formación) y `cronologia.md` (desde el año 0, con años concretos hasta el presente de Gorhorn).
  Enlazados desde el pie de página de todo el lore.
- **Escala temporal ajustada dos veces** tras revisión de plausibilidad:
  - Población Tarkurok/Maktor: 200→800 años para llegar a 5.000 (la tasa a 200 años era ~3,6%/año,
    absurda; a 800 años, ~0,9%/año).
  - Adaptación física Helsig/Goshg: 500→1.000 años (28→56 generaciones orcas; se sostiene con que
    la magia salvaje acelera la biología orca, ya sugerido por el propio canon de piel-por-región).
  - Año de arranque de la partida de Gorhorn, resultado final: **4.010** (no 2.910 ni 3.510 —
    versiones intermedias durante la misma sesión).
- **Escala de creación del mundo** (`cronologia-mitica.md`, `genesis.md` § Madre): el ancla "Madre
  crea las Semillas" subió de −10.000 a −500.000.000 (escala planetaria real) y luego bajó a
  **−200.000.000** (el poder de las Semillas acelera la formación activa del mundo, no hace falta
  el tiempo "natural" completo). Tema nuevo explícito: Madre lleva presente solo una fracción
  mínima de la vida real del planeta y no sabe qué hay más allá de su propia creación — conecta con
  la Entidad Desconocida ya existente.
- **Ritmo de crecimiento del Clan Serhu explicado narrativamente** (`areas.md`): el número ya
  sembrado en `worldPopulation.ts` (800, no inventado en esta sesión) ya cuadraba con una tasa ~3x
  más lenta que Goshg/Helsig — se escribió el porqué (cerco social Goirnte, sin alianzas ni
  contacto exterior) en vez de tocar la cifra. De paso, nueva relación histórica Faerus↔Maktor (no
  Faerus↔Serhu) que explica por qué Gorhorn conectó con los Faerus en su juventud.

Ver memoria `tarkor_auditoria_lore_mapa_2026-08-03` y siguientes del mismo hilo para más contexto
de sesión (aunque esa memoria es de la auditoría de mapa previa, no de esta ampliación de lore).

---

## Pasada de código de la sesión 2026-08-03 (mismo día)

Los 5 pendientes de arriba, llevados a código el mismo día en vez de quedar para otra sesión:

- **Torgash** (`worldCatalog.ts`): bio reescrita sin el duelo, con la culpa por la inacción Serhu.
  Mismo ajuste en un comentario suelto de `orco-enfurecido-hondonada` que citaba el viejo ejemplo.
- **`loreChunks.ts`**: 3 chunks reescritos (cultura/liderazgo orco, Clan Maktor, Clan Serhu, Torgash
  — 4 en total) + `npm run reindex-lore` (50/50 chunks, sin errores).
- **Canizor**: entrada completa en `worldCatalog.ts` (PLANTILLA, nivel 1-4, `domesticablePct` 45/
  `capturablePct` 20, `temperamento: CAUTELOSO` — no `AGRESIVO`, para no bloquear la doma con
  combate forzado), item nuevo `piel-canizor`, 3 harvest yields, y fila en `worldPopulation.ts`
  (200/320, población baja a propósito por ser solitario/territorial). Confirmado que se integra
  solo en encuentros ambientales (`turnResolution.ts` ya consulta `Npc` PLANTILLA + `WorldPopulation`
  por región de forma genérica, sin lista fija que tocar).
- **Tótem Maktor**: verificado en DB (`ItemCatalog.statBonusAttribute`/`statBonusAmount` ambos
  null) — ya era puramente cosmético, no hizo falta ningún cambio.
- **`worldPopulation.ts`, `orcos-llanuras`**: label corregido de "Maktor/Serhu" a "Clan Serhu"
  (el número 800/1.000 no cambia, ya era correcto).

Verificado: `tsc --noEmit` limpio, `npm run seed-catalog` (103 objetos, 25 NPCs, 53 recursos, 19
poblaciones), `vitest run` → **518/518 tests, 51 archivos**, incluidos los 2 que llevaban semanas
fallando de forma intermitente en `turn.integration.test.ts` (ahora también en verde).
