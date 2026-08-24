# Helek Sirik — Combate múltiple (varios aliados vs. varios enemigos)

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-24, sesión conjunta autora/Claude). **Nada de esto está implementado en
el motor todavía** — documentación pura, mismo criterio que `clases.md` y
`companeros-y-supervivencia.md`. Esta es la pieza de infraestructura más grande de toda la sesión:
desbloquea `MULTIPLE`/`INVOCACION`/`COMPANERO`/`CONTROL`/`EXPULSAR` en las 34 especializaciones de
`clases.md`, y es lo que de verdad haría falta para que un compañero
(`companeros-y-supervivencia.md`) luche a tu lado en combate.*

---

## Qué existe hoy en el motor (grounding — por qué esto NO es "ampliar" algo semi-hecho)

- **`resolveExchange(atacante, defensor)`** (`combatExchange.ts`) — función pura que compara
  **exactamente 2** participantes: un d20 opuesto cada lado, quien saca más gana. Es el corazón de
  todo el combate hoy, y **se queda como la pieza atómica del sistema nuevo** — lo que cambia es
  CUÁNTAS veces y en qué orden se llama por ronda, no la propia tirada.
- El "combate en grupo" que ya existe (cazar en manada, `NpcState.groupSize`/`groupDefeated`) **no
  es multi-combate de verdad** — es un truco: la misma fila de NPC "resucita" a `ILESO` cada vez que
  cae un individuo, para simular 3 lobos como 3 combates 1v1 SEGUIDOS, nunca simultáneos. **Se
  retira** cuando se construya esto — cada lobo pasa a ser un combatiente real propio.
- `pendingCombatNpcSlugs` puede listar varios NPCs a la vez, pero el motor solo elige UNO como
  "objetivo activo" — el resto espera en cola, no atacan ni son atacados mientras tanto. Se
  sustituye por el orden de iniciativa real de este documento.
- **No existe ningún concepto de "sesión de combate" persistida** (comentario explícito del propio
  schema, § `NpcState.abilityUsesThisEncounter`) — hoy el estado de un combate vive repartido en
  campos sueltos (`condicionFisica`, `pendingCombatNpcSlugs`, `pendingNpcAttack`). Multi-combate
  real necesita algo más parecido a una sesión propia (ver § 5).
- `Companion` hoy es casi puramente narrativo (`name`/`role`/`notes`, ver
  `companeros-y-supervivencia.md`) — **no tiene atributos ni vida propios**, así que hoy no podría
  ni siquiera participar en un `resolveExchange`. Esto también hay que resolverlo (§ 5).

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

## 5. Infraestructura nueva necesaria (nada de esto existe hoy)

- **`rollInitiative` generalizado**: de comparar 2 lados a ordenar N combatientes — nueva firma,
  misma tirada de base.
- **Sesión de combate persistida** — hoy el estado vive repartido en campos sueltos de `Save`/
  `NpcState`; multi-combate necesita algo que trackee de verdad: lista de combatientes de ambos
  bandos, orden de iniciativa, turno actual, emparejamiento vivo de cada uno. Probablemente un
  modelo nuevo tipo `CombatEncounter` + `CombatParticipant`.
- **`Companion` necesita atributos y vida propios** — hoy es puramente narrativo
  (`name`/`role`/`notes`). Para participar en un `resolveExchange` de verdad necesita al menos un
  `AttributeBlock` y una `CondicionFisica` (reutilizando el mismo enum que jugador/NPC). Ya se
  apuntaba como pendiente en `companeros-y-supervivencia.md § 7`, esto lo confirma como requisito
  duro, no opcional.
- **Lógica de emparejamiento/retargeting por turno**, con la rama de Inteligencia alta/baja (§ 2) —
  función pura nueva, sin infraestructura previa que reutilizar.
- **Partición de encuentros grandes en sub-combates de 4v4** (§ 3) — lógica de reparto + orquestación
  de "1 en directo + N deterministas".
- **Modo de resolución determinista sin interacción** (§ 4) — ejecutar una `CombatEncounter`
  completa de principio a fin sin pausas, y generar su reporte narrado al final. Reutilizable tanto
  para los sub-combates que no juega la usuaria como para el combate autónomo de Reino.
- **Retirar** `NpcState.groupSize`/`groupDefeated`/`corpsesLooted` (el truco de "fila que resucita")
  una vez esto esté construido — sustituido por combatientes reales en la cola de iniciativa. Migrar
  el despiece en grupo (`recolectar.ts`, hoy depende de `groupDefeated`/`corpsesLooted`) a la lista
  real de caídos del encuentro.
