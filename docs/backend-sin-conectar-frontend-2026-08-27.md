# Backend sin conectar a Frontend — hallazgos

Auditoría específica (2026-08-27): todo lo que el BACKEND calcula/expone/persiste con esfuerzo
real y que el FRONTEND nunca llega a mostrar, leer o usar de ninguna forma — datos muertos desde
el punto de vista de la jugadora, aunque el backend los produzca de verdad. Distinta de la
auditoría de "elementos desconectados" del 2026-08-23 (`docs/21-roadmap.md`), que era sobre si el
propio backend usa sus propios cálculos internamente — esta pasada es solo sobre el ENGANCHE
backend→frontend.

Método: `npx knip` en frontend como grounding (poco ruido nuevo — casi todo eran tipos anidados
marcados "sin exportar consumidor" por knip pero sí usados de verdad dentro del mismo archivo,
falsos positivos ya conocidos de este proyecto), más grep cruzado campo a campo entre
`backend/src/routes/turn.ts` / `backend/prisma/schema.prisma` y `frontend/src/types.ts` /
`frontend/src/lib/api.ts` / `frontend/src/pages/GameView.tsx` / paneles.

Cada entrada: zona, qué vive en el backend (archivo/línea), qué haría falta en frontend para
mostrarlo, y una valoración honesta de si merece la pena.

---

## Combate

### `Save.activeEffects` / `NpcState.activeEffects` (Fase 2 AUMENTO/DEBILIDAD) — CERO enganche

**Backend**: `backend/prisma/schema.prisma:166` (`Save.activeEffects`) y `:1708` (`NpcState.
activeEffects`) — columna `Json` con `ActiveEffect[]` (`{ attribute, magnitude, turnsRemaining,
sourceAbility }`, `backend/src/services/activeEffects.ts`). Construida y commiteada HOY MISMO
(2026-08-26, ver `docs/21-roadmap.md` § Fase 2): duración real por turnos sobre el motor de
combate 1v1, con 14 tests en verde. `turnResolution.ts` la lee/escribe de verdad en cada
intercambio (`effectiveAttributesConDuracion`, `pushActiveEffect`, `decrementActiveEffects`) y
`backend/src/routes/turn.ts:983` la pasa como parámetro a `narrateAndPersistTurn` — pero **nunca
se incluye en el cuerpo de la respuesta HTTP** que `turn.ts` manda de vuelta (ni en `narrate` ni
en `classify`, ni en `GET /saves/:id`). Confirmado con grep: `activeEffects` no aparece en ningún
sitio de `frontend/src/` — ni en `types.ts`, ni en `api.ts`, ni en ningún componente.

**Qué haría falta en frontend**: incluir `activeEffects` (jugador y de cada NPC en escena) en la
respuesta de `turn.ts`/`saves/:id`, tipar `ActiveEffect[]` en `types.ts`, y un indicador visual en
`CombatPanel.tsx`/`EnemyFicha` — un chip "+2 Fuerza (2 turnos)" o "-3 Destreza (1 turno)" junto a
la ficha correspondiente. Sin esto la jugadora nunca sabe que tiene un buff/debuff activo ni
cuánto le queda, aunque el motor ya lo esté aplicando de verdad a sus tiradas.

**Valoración**: MERECE LA PENA, alta prioridad. No es deuda cosmética — es una mecánica de combate
real (multiplica/resta al atributo efectivo) completamente invisible para quien juega. Confirmado
en vivo revisando `CombatPanel.tsx`/`CombatExchangeBadge.tsx`: no hay ningún rastro de "efecto
activo" en la UI de combate.

---

## Mundo / Facciones / Tiempo

### Estación y clima reales — ni siquiera llegan a la narración, mucho menos a un panel

**Backend**: `backend/src/services/worldClock.ts` — `estacionFor()` (:21) y `climaFor()` (:63)
calculan la estación (`PRIMAVERA/VERANO/OTONO/INVIERNO`) y el clima real de Las Llanuras
(`EstadoClima`, con niveles de severidad) a partir de `WorldState.fictionalMinutes`, y SÍ se usan
de verdad para gatear qué se puede recolectar (`HarvestYield.estacionRequerida`/`climaRequerido`,
ver `backend/src/routes/saves/recolectar.ts:406-490`). Existen además `estacionNombreFor()` (:48)
y `climaNombreFor()` (:108) — nombres Kektira por raza ("Ur'gathek", "Rok'ithek"...) con 14 casos
de test cada uno en `worldClock.test.ts` — pero **estas dos funciones no se llaman desde ningún
otro sitio del código de producción**, solo desde su propio test. Ni siquiera alimentan
`sessionFacts`/la narración (a diferencia de `WorldState.agenda`, ver más abajo, que sí llega a
prosa aunque no a UI estructurada).

**Qué haría falta en frontend**: lo mínimo sería que el backend empujara la estación/clima actual
como hecho de mundo hacia el Narrador (mismo patrón que `STAGE_FACTS` de `worldAgenda.ts`) para
que aparezca en prosa; lo completo sería un indicador en el panel "El mundo"/Entorno
(`EstadisticasPanel.tsx` o donde viva la fecha ficticia) con la estación y el clima actuales.

**Valoración**: MERECE LA PENA, y es el hallazgo más sorprendente de esta pasada — no es solo "sin
UI", es que el backend calcula la estación/clima para BLOQUEAR recursos de crafteo de verdad (p.
ej. recetas de Las Llanuras con `climaRequerido`) sin que exista ninguna vía, ni siquiera
narrativa, para que la jugadora sepa qué estación o clima hay ahora mismo. Desde su punto de vista
un recurso "a veces está y a veces no" sin explicación.

### `WorldState.agenda` (conflicto Serhu-Concordia vs Helsig/Goshg) — solo prosa ocasional, sin panel estructurado

**Backend**: `backend/prisma/schema.prisma:405-420`, `backend/src/services/worldAgenda.ts`. Hito
de mundo real con 5 etapas (`AgendaEntry { stage, maxStage, nextStageAtMinutes }`), avanzado por
`worldTick.ts` cada 7 días de ficción si nadie interviene, y que deplete población real de Helsig/
Goshg (`WorldPopulation`). Cada etapa cruzada SÍ llega a la jugadora — pero solo como hecho suelto
inyectado a `sessionFacts` (`STAGE_FACTS`, `worldAgenda.ts:40-46`) para que el Narrador lo mencione
de pasada la próxima vez que narre, nunca como dato estructurado. Confirmado con grep: `agenda` no
se selecciona en `backend/src/routes/saves/detail.ts` (el `GET /saves/:id` que sí manda
`factionsStatus`), y no aparece en ningún sitio de `frontend/src/`.

**Qué haría falta en frontend**: exponer `agenda` en `GET /saves/:id`, y un mini-tracker en el
panel de Facciones/Reputación ("Conflicto Serhu-Concordia vs Helsig/Goshg — etapa 2/4") junto a
`ReputacionPanel.tsx`, que ya muestra `factionsStatus`.

**Valoración**: MERECE LA PENA pero prioridad media — a diferencia de estación/clima, esto SÍ le
llega a la jugadora de alguna forma (prosa ocasional cuando el Narrador decide mencionarlo), así
que no es un dato 100% muerto, solo con visibilidad débil y dependiente del azar de qué mencione
el modelo ese turno.

### `Save.clase` / `Save.especializacion` — ni se asignan nunca ni se muestran nunca

**Backend**: `backend/prisma/schema.prisma:120-129`. Enums reales (`Clase`/`Especializacion`) que
sí alimentan lógica de juego — restricción de armas por clase (`weaponPoolFor`, usado en
`backend/src/routes/saves/inventario.ts:84`) y si un compañero cuenta como Domador (`esDomador`,
`backend/src/routes/saves/companeros.ts:137/186/222`) — pero el propio comentario del schema ya
es honesto al respecto: *"No hay ningún flujo in-game para elegirla"*. Confirmado con grep:
`backend/src/routes/saves/creation.ts` nunca escribe `clase:`/`especializacion:` al crear una
partida, así que en la práctica están SIEMPRE en `null` para cualquier personaje — incluida
Gorhorn, cuyas habilidades de clase reales se conceden por un atajo aparte
(`classAbilityUnlocksFor` compara `characterName === 'Gorhorn'` directamente, no lee
`Save.clase`). Consecuencia real: `weaponPoolFor(save.clase, ...)` recibe `null` siempre, así que
la restricción de armas por clase que sí está implementada y testeada
(`backend/src/routes/saves/inventario.test.ts`) no se dispara nunca en una partida real de hoy.

**Qué haría falta en frontend**: no es solo un tema de UI — hace falta primero un flujo de
creación/asignación de clase (no existe ni en backend), y luego mostrarla en `PersonajePanel.tsx`
("Clase: Cazador · Tirador"), como ya se hace con `raza`.

**Valoración**: dato ya conocido/pendiente en el propio código (el comentario del schema lo
admite), no es un descubrimiento nuevo — se incluye aquí solo porque encaja de lleno en el patrón
de la auditoría (campo de Prisma con lógica real enganchada, cero superficie de frontend) y porque
tiene un efecto colateral real (la restricción de armas por clase, con tests propios, no se activa
nunca hoy). Prioridad baja hasta que exista el flujo de asignación.

---

## Combate múltiple

### Orden de iniciativa / ronda del `CombatEncounter` — sin tracker, solo narrado turno a turno

**Backend**: `backend/prisma/schema.prisma:704-738`. `CombatEncounter.ronda` (número de ronda),
`ordenIniciativa` (cola de `CombatParticipant.id` ya ordenada) y `turnoActual` (índice dentro de
esa cola) son estado real, persistido y recalculado cada ronda por
`combateMultipleOrquestacion.ts`. Confirmado con grep: ninguno de los tres aparece en
`backend/src/routes/turn.ts` como campo de respuesta, ni en ningún archivo de `frontend/src/`.

**Qué haría falta en frontend**: un indicador de "Ronda 3" y/o "orden: Jugador → Lobo A → Lobo B →
Compañero" en `CombatPanel.tsx` cuando hay más de un enemigo.

**Valoración**: prioridad baja — a diferencia de `activeEffects`, esto NO es un dato invisible de
verdad: quién ataca a quién y en qué orden ya se cuenta turno a turno vía `LogEntry.
npcAbilityUsed`/`playerAbilityUsed`/`combatExchange` (la jugadora lo deduce leyendo el log). El
propio roadmap de Combate múltiple lo dice explícitamente: *"sin cambio de flujo visible para la
jugadora"* fue una decisión de diseño, no un descuido. Un contador de ronda explícito sería una
mejora de comodidad, no una corrección de un hueco.

---

## Precedente ya cerrado (verificado, no repetir como hallazgo nuevo)

`esperandoDefensaJugador` — el bug histórico citado en el encargo de esta auditoría (campo que el
backend mandaba siempre pero el frontend no leía) **ya está arreglado**: confirmado con grep,
`frontend/src/hooks/useCombatFlow.ts:551` lo lee y lo pasa a `setCombatAwaitingDefense`, con test
propio en `useCombatFlow.test.tsx`. Se deja constancia aquí para que quede registrado que se
verificó el estado actual en vez de asumir la memoria vieja.

---

## Zonas revisadas y limpias (sin hallazgos)

- **`BuildingStatus`/`TerritoryControl`** (`DANADO`/`ABANDONADO`/`PERDIDO`/`DISPUTADO` incluidos):
  el backend los alcanza de verdad (`turnResolution.ts:4286-4293`) y `ReinoPanel.tsx` tiene
  etiqueta propia para cada valor del enum. Conectado del todo.
- **`CompanionInfo`** (`felicidad`/`comida`/`agua`/`esSlotDomador`/`rolReino`): los 5 campos se
  leen y pintan en `CompanerosPanel.tsx` (barras de mini-stat + badges). Conectado del todo.
- **`ItemCatalogInput.dimensiones`/`lugarOrigen`**: llegan hasta `enciclopediaTargets.ts` y se
  muestran en el detalle de objeto. Conectado.
- **Enciclopedia de Clases** (`buildClassesSection`, `EnciclopediaClassInfo`/
  `EnciclopediaClassUnlock`): las 8 clases construidas con su árbol de habilidades sí se muestran
  en `EnciclopediaPanel.tsx` — el hueco real está en `Save.clase` (arriba), no aquí.
- **`WorldPopulation`**: nunca se expone como número crudo, pero es intencional — solo alimenta la
  disponibilidad real de `HarvestSourceCandidate`/`HuntCandidate`, que sí llegan al frontend ya
  filtrados. No es un hallazgo, es la capa de indirección correcta.
- **`LiveTeacherCapture`**: tabla de infraestructura de fine-tuning (captura de pares
  cloud/local para exportar dataset DPO) — intencionalmente interna, nunca debería tener
  superficie de frontend. No es un hallazgo.

---

## Resumen de prioridad

| Hallazgo | Prioridad | Motivo |
|---|---|---|
| `activeEffects` (buffs/debuffs de combate) | **Alta** | Mecánica real que ya afecta tiradas, cero visibilidad |
| Estación/clima nunca comunicados | **Alta** | Bloquea recetas/recolección sin ninguna explicación, ni narrativa |
| `WorldState.agenda` sin panel estructurado | Media | Llega por prosa ocasional, pero no de forma fiable |
| `Save.clase`/`especializacion` sin flujo ni display | Baja | Ya conocido/pendiente, requiere diseño de flujo previo |
| Orden de iniciativa / ronda de combate múltiple | Baja | Decisión de diseño explícita de no mostrarlo aparte |
