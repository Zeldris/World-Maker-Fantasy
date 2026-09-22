# IA de combate NPC y curvas dinámicas de mundo — diseño sin código todavía

[← Volver al índice](mundo-vivo-x4.md)

---

## 8. IA de combate NPC por tramos de Inteligencia — DISEÑO CERRADO (2026-09-21, sesión posterior),
sin código todavía

Grounding real hecho antes de diseñar (mismo criterio que el resto del documento): el motor actual
ya tiene un umbral BINARIO (`INTELIGENCIA_TACTICA_UMBRAL = 12`, `combateMultiple.ts`) que decide
`elegirObjetivo` (Inteligencia alta = remata al más herido; baja = aleatorio), pero **nada más**
depende de Inteligencia — `chooseNpcAbility` (`npcCombatAbilities.ts`) elige habilidad exactamente
igual sea el NPC listo o tonto, y NO EXISTE ningún mecanismo de retirada/huida de NPC en absoluto
(`Huir` solo existe como acción del jugador, `/combat/flee`+dentro de combate, `session.ts`).

Tres tramos confirmados (mismo principio que § 5-bis punto 5: la Inteligencia del `Npc` concreto
decide su propio comportamiento autónomo, igual que decide la autonomía de una `Faction` entera):

- **&lt;10 — solo Ataque Básico, sin coordinación**: ya es el comportamiento real de hoy para
  cualquier Inteligencia por debajo de 12 (`elegirObjetivo` aleatorio, `chooseNpcAbility` sin
  distinción) — **sin cambios de código**, el tramo bajo ya está cubierto tal cual.
- **10-20 — habilidades reactivas básicas**: ya cubierto por `INTELIGENCIA_TACTICA_UMBRAL = 12`
  (dentro de este tramo) — **sin cambios de código**, el umbral existente ya vive aquí.
- **20+ — pieza NUEVA real, sin código todavía**: decisiones que hoy NINGÚN NPC toma:
  - **Retirada**: un NPC con Inteligencia 20+ y condición física GRAVE/CONVALECIENTE puede intentar
    huir del combate en vez de seguir atacando — mismo mecanismo determinista que ya usa el
    jugador (`/combat/flee`, tirada real), aplicado por primera vez a un NPC. Requiere decidir:
    ¿el NPC que huye desaparece de la escena (mismo criterio que el jugador huyendo) o queda
    "fuera de combate" localmente (`CombatParticipant` marcado, sin desaparecer del mundo)?
  - **Cambio de objetivo coordinado**: en combate múltiple, dos o más NPC de Inteligencia 20+ del
    mismo bando podrían concentrar fuego en el mismo objetivo (el más débil, mismo criterio que
    `elegirObjetivo` pero COMPARTIDO entre varios atacantes del turno, no cada uno decidiendo en
    aislamiento) — requiere que `elegirObjetivo` conozca las elecciones ya hechas por otros NPC de
    su bando en el mismo turno (hoy cada NPC decide sin ver a los demás).
  - **Coordinación de grupo real**: candidato de diseño, sin cerrar del todo — ¿un NPC de
    Inteligencia 20+ podría ordenar a otros NPC de su bando con Inteligencia menor (mismo concepto
    "capitán decide, el resto obedece" del § 5-bis punto 5, aplicado a un encuentro de combate en
    vez de a una facción entera)?

**Pendiente real antes de escribir código** (a decidir en la sesión dedicada a esto): shape exacto
de "retirada de NPC" (¿nuevo estado de `CombatParticipant`, o reutilizar algo existente?), y si el
cambio de objetivo coordinado necesita una pasada previa por todo el bando antes de resolver cada
ataque individual (cambio de orden de evaluación en `combateMultipleOrquestacion.ts`) o puede
resolverse con una estructura de datos compartida sin reordenar nada.

## 9. Movimiento en Zona / Profesiones-talento-nivel-energía — señales dinámicas, DISEÑO PENDIENTE
DE GROUNDING (2026-09-21, sesión posterior)

A diferencia del resto de piezas de esta sesión, esta NO se cerró — mandato explícito del propio
documento (§ 5-bis punto 9: "sin diseño concreto todavía, pendiente de una pasada de grounding
dedicada antes de escribir nada, no se improvisa aquí"). Grounding real hecho hoy en `worldClock.ts`
(clima, § 5-bis punto 13) y en `worldTick.ts` (timeouts de fondo, punto 11) tocó terreno adyacente
pero no esta pieza en sí — sigue exactamente donde estaba, sin resolver:

- **Movimiento en Zona**: qué señal dinámica falta y qué variable de estado real la alimentaría —
  el propio § 2.7 del documento (auditoría original) ya señalaba esto como "curva hoy plana" sin
  concretar cuál. Requiere releer `zonaPosicion.ts`/`zonePoints.ts` a fondo antes de proponer nada,
  no se hizo en esta sesión.
- **Profesiones/talento/nivel/energía**: mismo problema — `professionProgress.ts`/`energy.ts` ya
  tienen curvas reales (`PROFESSION_LEVEL_THRESHOLDS`, `energiaMaxFor`), pero el § 2.8 original
  señalaba que faltan "señales dinámicas" sin especificar cuáles. Candidato sin verificar: ¿clima
  (ya real en las 8 regiones desde hoy) debería afectar el coste de energía o la dificultad de
  recolección? — pura especulación, no verificado contra el código real todavía.

**Sin diseño, sin código** — queda exactamente como estaba, pendiente de una sesión propia con
grounding dedicado antes de proponer nada, tal como el propio documento ya pedía.

---

