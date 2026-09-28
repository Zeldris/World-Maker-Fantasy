# Plan — cierre de hallazgos de las pruebas en la nube (2026-09-28)

Origen: `pruebas-nube-2026-09-28-hallazgos.md` § B (B1–B32) y las fases 4–5 pendientes de
`plan-mecanicas-por-zona-2026-09-28.md`. Petición de Álvaro: "ya no más pruebas, implementar y cerrar
todos los hallazgos".

Reparto: plan escrito por Opus; 4 subagentes Sonnet en paralelo (worktree y BD de tests propios:
`tarkor_w1..w4`, clones de `tarkor`); Opus integra en `claude/wonderful-volta-662qt8`.

Hallazgos nuevos del último tramo de pruebas (se añaden al documento de hallazgos):
- **B30 🟡** Grupos de la misma especie que deambulan acaban en la MISMA celda (p. ej. ×4 y ×1 en
  625,475) → un pin tapa al otro.
- **B31 🟡** Tras toparse con un Ruptidar (el log lo nombra), su pin sigue "???" / "Todavía no lo has
  descubierto".
- **B32 🔴** Matar a un convaleciente en el 1v1 (`combat/matar/:slug`) devuelve 200 y marca
  `targetedForKill`, pero el NPC sigue CONVALECIENTE, `pendingCombatNpcSlugs` no se limpia y el panel
  queda con Actuar deshabilitado; tras recargar vuelve a ofrecer Combatir/Huir (= B10 reproducido).

## Decisiones por defecto (🔵 — revisables por Álvaro)

Si el canon (`docs/canon-opencode/`, `docs/rpgtarkor/`) ya define algo distinto, manda el canon.
- **B2** Cada paso real de `/zona/mover` avanza 1 minuto ficticio.
- **B7** Un RECURSO que el jugador aún no puede recolectar (tier/nivel) no genera oferta
  Interactuar: se registra como descubrimiento en el log ("Ves X — hace falta Minar nivel N").
- **B11** Ataque Básico siempre usable (coste 0 si no llega a la energía) y regeneración pasiva
  fuera de combate de 1 energía por cada 10 min ficticios.
- **B12** Las acciones del panel de combate no cuentan para el contador de capítulo.
- **B27** Los humanoides derrotados llevan Goirnos al saquearlos (escala con nivel); el botón
  Vender del Mercado del Reino se implementa (TODO de `DiplomaciaMercadoSection.tsx`).
- **B1** `ZonePoint` por partida: fuera de esta tanda (cambio de esquema grande que afecta a
  grupos, reconciliación y seed). Queda documentado como decisión pendiente.
- **B18** Lore: propuesta en `docs/borradores-opencode/propuestas-lore.md`, sin tocar código ni canon.

## Agente A — Fase 4 (retirar habilidades que cubre el mapa) + barra de habilidades
Fase 4 tal cual en el plan de mecánicas por zona. Además:
- **B20** partida nueva: barra 1 con Descansar, Comer/Beber, Curar, Volver al campamento (lo que
  quede tras retirar las de recolección).
- **B21** si la caza/recolección que queda (Desollar) muestra una tirada que no es la suya,
  etiquetarla ("Tirada de apertura del combate").

## Agente B — Fase 5 (cadáveres en el mapa) + UX de zona
Fase 5 tal cual en el plan de mecánicas por zona. Además: B2, B3 (botón "Ir hasta aquí" en el
detalle de un pin), B4 ("Cerrar"), B5 (salida no visitada: "Camino hacia el {rumbo}"), B6 (icono de
salida girado a su rumbo real), B7, B30 (el deambular no pisa celdas ocupadas por otro punto), B31
(toparse con fauna/NPC la marca como descubierta en la partida).

## Agente C — Combate y progresión
B9 (nombre oculto coherente: la ficha no revela nombre/historia que el encuentro oculta), B10/B32
(Matar convaleciente cierra el combate en una sola pulsación, 1v1 y múltiple), B11, B12, B19
(conceder habilidades de especialización al subir de nivel, todas las ramas), B22 (una sola etiqueta
de dificultad para el mismo rival), B23 (fauna inofensiva: el intercambio no se presenta como
ataque que conecta).

## Agente D — Técnico, economía y pulido
B13 (tests de integración sin interferencias entre archivos), B14 (`seed-catalog` borra/retira
filas de `ItemCatalog` que ya no están en el catálogo, sin romper inventarios que las referencien),
B15 (imports sin usar), B16 (horas del log monótonas), B24 (etiquetas laterales completas), B27,
B28 (cabecera de Estadísticas según la clase elegida).

## Integración (Opus)
Revisar cada diff, fusionar en la rama, resolver conflictos (GameView/LogPanel/zona.ts), tsc +
suite, actualizar el documento de hallazgos (B → A) y commit + push por agente.
