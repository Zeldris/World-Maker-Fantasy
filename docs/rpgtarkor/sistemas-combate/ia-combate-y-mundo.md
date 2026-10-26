# IA de combate NPC y curvas dinámicas de mundo

[← Volver al índice](../sistemas-reino/mundo-vivo-x4.md)

**Estado (2026-10-25, `QA-243`):** § 8 APLICADO al motor el 2026-10-05 (`CR-44` moral y retirada, `CR-45`
capitán; ver «Cómo quedó en el motor» al final del § 8). § 9 sigue sin diseñar.

---

## 8. IA de combate NPC por tramos de Inteligencia — DISEÑO CERRADO (2026-09-21), APLICADO (2026-10-05, `CR-44`, `CR-45`)

*El texto de abajo es el diseño de 2026-09-21, tal como se cerró; lo que cambió al construirlo está en
«Cómo quedó en el motor».*

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

### Cómo quedó en el motor (2026-10-05, `CR-44`, `CR-45`; anotado el 2026-10-25, `QA-243`)

La retirada no quedó reservada a Inteligencia 20+: se construyó como **moral**, la regla opcional
de D&D 5e (DMG pág. 273), para todo NPC con mente.

- **Quién tiene moral** (`moralCombate.ts`, `tieneMoral`): toda persona con raza. La fauna sigue con su
  temperamento y las invocaciones no huyen. Un líder cuya muerte acabaría con su facción (`sinSucesor`)
  tampoco huye, para no partir historias.
- **Cuándo tira:** la primera vez que cae a GRAVE, la primera vez que su bando queda a la mitad y al caer o
  huir su capitán. La tirada es de Voluntad contra CD 10 (`MORAL_DIFICULTAD`). Va con desventaja si la
  jugadora va claramente ganando o si acaba de perder a su capitán. En un grupo con líder, tira el líder
  por todos.
- **Si falla:** intenta escapar con la misma tirada de Destreza que la huida del personaje, con los papeles
  cambiados; si no escapa, pierde el turno. La Inteligencia decide cómo se va: por debajo de 12, en
  desbandada (cada uno por su lado); de 12 en adelante, en orden (`INTELIGENCIA_RETIRADA_ORDENADA`).
- **Quién huye:** el NPC que huye sale del combate (`huido` del participante). Combate 1v1, en
  `huidaNpc.ts`; combate de varios, en `moralGrupo.ts`. No huye el objetivo de una misión activa.
- **Capitán** (`combateMultiple.ts`, `INTELIGENCIA_CAPITAN = 20`): el NPC de más Inteligencia del
  bando, si llega a 20.
  - Él y los suyos concentran los ataques en el rival más vulnerable (`objetivoConcentrado`: peor
    condición y, a igualdad, menos Constitución; entre empatados, al azar). El registro lo cuenta al
    empezar cada ronda («X ordena caer sobre Y»).
  - Manda desde la ronda de apertura.
  - Su caída hace tirar moral con desventaja a su bando.
- **Sin cambios:** el umbral táctico `INTELIGENCIA_TACTICA_UMBRAL = 12`. Por debajo de 12, cada NPC elige
  objetivo al azar; desde 12, va a por el más herido.

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

