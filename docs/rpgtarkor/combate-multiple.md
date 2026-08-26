# Helek Sirik — Combate múltiple (varios aliados vs. varios enemigos) — APLICADO al motor

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-24, sesión conjunta autora/Claude) — **APLICADO al motor el
2026-08-25** (auditoría de lore 2026-08-25: este banner seguía diciendo "nada implementado" pese a
estar construido e integrado en producción desde el día siguiente al diseño). Real:
`CombatEncounter`/`CombatParticipant` (`schema.prisma`), iniciativa N-way y emparejamiento por
Inteligencia (`combateMultiple.ts`), orquestación con estado real incluida la jugadora
(`combateMultipleOrquestacion.ts`), disparo real desde `cazar.ts` (caza en grupo) y desde un ataque
directo, saqueo/desuello al resolverse, y narración ligera propia (`combateMultipleNarracion.ts`).
Esta fue la pieza de infraestructura más grande de la sesión: desbloquea
`MULTIPLE`/`INVOCACION`/`COMPANERO`/`CONTROL`/`EXPULSAR` en las 34 especializaciones de
`clases.md`, y es lo que permite que un compañero (`companeros-y-supervivencia.md`) luche a tu lado
en combate — aunque el compañero en sí necesitó su propio arreglo aparte (ver nota de
`Companion.attributes` más abajo). Huecos reales que siguen sin construir: XP de la propia tirada de
combate, y elegir objetivo individual entre miembros de un mismo grupo (mecánicamente
intercambiables hoy).*

---

## Qué existe hoy en el motor (grounding — por qué esto NO es "ampliar" algo semi-hecho)

- **`resolveExchange(atacante, defensor)`** (`combatExchange.ts`) — función pura que compara
  **exactamente 2** participantes: un d20 opuesto cada lado, quien saca más gana. Es el corazón de
  todo el combate hoy, y **se queda como la pieza atómica del sistema nuevo** — lo que cambia es
  CUÁNTAS veces y en qué orden se llama por ronda, no la propia tirada.
- El "combate en grupo" que existía antes de esto (cazar en manada, `NpcState.groupSize`/
  `groupDefeated`) **no era multi-combate de verdad** — era un truco: la misma fila de NPC
  "resucitaba" a `ILESO` cada vez que caía un individuo, para simular 3 lobos como 3 combates 1v1
  SEGUIDOS, nunca simultáneos. **Corrección tras aplicarlo (2026-08-25): estos campos NO se
  retiraron** — al resolverse un `CombatEncounter` de grupo, `turnResolution.ts` los materializa de
  verdad (decisión explícita: reutilizar el pipeline de saqueo/desuello clásico tal cual en vez de
  construir uno nuevo), así que `groupSize`/`groupDefeated`/`corpsesLooted` siguen vivos y en uso
  real — la condición física de CADA individuo del grupo mientras el combate está EN CURSO vive en
  `CombatParticipant.condicionFisicaGrupo` (fila nueva, un individuo real cada uno), y solo al
  terminar el encuentro se resume de vuelta a `NpcState`.
- `pendingCombatNpcSlugs` puede listar varios NPCs a la vez, pero el motor solo elige UNO como
  "objetivo activo" — el resto espera en cola, no atacan ni son atacados mientras tanto. Se
  sustituye por el orden de iniciativa real de este documento.
- **No existe ningún concepto de "sesión de combate" persistida** (comentario explícito del propio
  schema, § `NpcState.abilityUsesThisEncounter`) — hoy el estado de un combate vive repartido en
  campos sueltos (`condicionFisica`, `pendingCombatNpcSlugs`, `pendingNpcAttack`). Multi-combate
  real necesita algo más parecido a una sesión propia (ver § 5).
- `Companion` ya tiene `attributes`/`condicionFisica` propios (§ 5, aplicado) — copiados del `Npc`
  de catálogo origen al confirmar el tameo/persuasión, escalados por su nivel en el momento de
  combatir (`npcAttributesForLevel`, igual que cualquier otro NPC). **Bug real cerrado 2026-08-25**:
  la ruta de confirmación nunca rellenaba `attributes` pese a que el propio comentario del modelo ya
  lo prometía — ningún compañero podía luchar de verdad hasta que se arregló.

---

## 1. Estructura de la ronda: iniciativa individual real

Cada combatiente presente (tú, cada aliado, cada enemigo) tira su propia iniciativa — generaliza
`rollInitiative` de "2 lados" a "N combatientes", mismo dado, se ordenan todos en una única cola.
Cuando le toca el turno a alguien, ese combatiente **ataca** (un `resolveExchange` pairwise contra
su objetivo actual) — el resto de la ronda no se congela ni se resuelve en bloque, es turno a turno,
tipo D&D real, no una ronda simultánea.

## 2. Quién ataca a quién

- **Tú**: eliges tu objetivo manualmente, como ahora.
- **Aliados y enemigos**: se auto-emparejan, sin que tengas que microgestionar cada uno. El
  emparejamiento se **redecide en cada turno individual** (no se fija una vez al empezar la ronda) —
  si el objetivo de alguien ya cayó en un turno anterior, se redirige a otro vivo del bando
  contrario, nunca ataca al aire.
- **Criterio de selección de objetivo — depende de Inteligencia del atacante**:
  - **Inteligencia alta** → objetivo inteligente: prioriza rematar a quien esté más cerca de caer
    (`GRAVE`/`CONVALECIENTE`), o concentra fuego sobre el más herido del bando contrario.
  - **Inteligencia baja** → objetivo aleatorio entre los vivos del bando contrario, sin ninguna
    lógica.
  - Da un uso táctico real a Inteligencia en combate que hoy no tiene (hoy es sobre todo
    `ANALISIS`/utilidad) — un enemigo "cabecilla" o "brujo" con Inteligencia alta se vuelve
    tácticamente más peligroso que un "recluta"/bestia con Inteligencia baja, no solo
    numéricamente más fuerte.

## 3. Bandos y tope de combatientes — 4 vs. 4 máximo

**Tope duro: 4 combatientes por bando.** Un enfrentamiento más grande (ej. 12 vs. 12, una batalla de
verdad) **se divide en varios combates de 4 vs. 4** — solo UNO de esos sub-combates es jugable en
directo (el que te incluye a ti); el resto se resuelven de forma **determinista** con la misma
mecánica exacta (mismas tiradas, mismo criterio de emparejamiento/Inteligencia), pero sin pasar por
la interfaz turno a turno — se calculan de una sentada y se narran después.

## 4. Combates sin ti presente (Reino defendiéndose, etc.)

Mismo criterio que los sub-combates de arriba: **usan la misma mecánica de combate real** (misma
iniciativa, mismo `resolveExchange`, mismo criterio de Inteligencia para emparejar), pero se
resuelven de forma determinista de principio a fin, sin interacción en directo — y el resultado se
presenta después en un **"reporte de combate autónomo"** (narración a posteriori de lo que pasó,
generada una vez el combate ya está resuelto del todo). No es una mecánica distinta ni más simple
que el combate jugable — es la misma, ejecutada sin pausas para pedir input.

## 5. Infraestructura nueva necesaria — APLICADA (2026-08-25)

*Esta sección listaba lo que hacía falta construir; el título original decía "nada de esto existe
hoy" — se deja como referencia histórica de qué se pidió, con el estado real de cada punto.*

- **`rollInitiative` generalizado** — APLICADO (`rollInitiativeMultiple`, `combateMultiple.ts`).
- **Sesión de combate persistida** — APLICADO: `CombatEncounter`/`CombatParticipant` reales
  (`schema.prisma`), tal como se anticipaba aquí.
- **`Companion` con atributos y vida propios** — APLICADO (`Companion.attributes`/`condicionFisica`,
  copiados del `Npc` origen al confirmar tameo/persuasión). Confirma lo que este mismo punto ya
  apuntaba como requisito duro.
- **Lógica de emparejamiento/retargeting por turno** — APLICADO (`retargetBando`,
  `combateMultiple.ts`).
- **Partición de encuentros grandes en sub-combates de 4v4** — APLICADO (`particionarEnSubCombates`,
  `MAX_COMBATIENTES_POR_BANDO=4`).
- **Modo de resolución determinista sin interacción** (§ 4) — APLICADO para el disparo real
  (`iniciarCombatEncounter` + resolución de turnos autónomos); el combate autónomo de Reino
  mencionado aquí como reutilización futura sigue sin construir.
- **`NpcState.groupSize`/`groupDefeated`/`corpsesLooted`** — **NO se retiraron** (corrección real
  tras aplicarlo, ver nota de "Qué existe hoy" más arriba): decisión explícita de reutilizar el
  pipeline de saqueo/desuello clásico tal cual al resolverse el encuentro, en vez de migrar
  `recolectar.ts` a una lista nueva. Siguen siendo la fuente de verdad real tras terminar un
  combate de grupo.
