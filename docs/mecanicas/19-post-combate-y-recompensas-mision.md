# Post-combate (inconsciencia/recuperación) y recompensas deterministas de misión

**Estado:** documento vivo. Investigación cerrada el 2026-08-12; implementación completa el
2026-08-13 ("sigue e implementa todas las fases que sacamos ayer al roadmap", y confirmado "todo
ahora" al preguntar por el alcance de la pieza 2). **Las 5 piezas implementadas y verificadas**
(tsc + vitest limpios, backend y frontend). Pendiente jugarlo en vivo.

## Contexto

Surgió investigando el bug de resurrección del Orco Enfurecido (ver
`docs/registros/revisar-partida-hallazgos.md` § "2026-08-12 — Orco Enfurecido (ya MUERTO) narrado atacando
a Gorhorn..."). La usuaria propuso 5 ideas relacionadas; una es un malentendido (ver abajo), cuatro
son piezas de trabajo reales y distintas entre sí.

## Corrección: el Orco Enfurecido YA es un NPC único, no una plantilla

Propuesta original: convertirlo en un NPC único ("Orco Enfurecido (misión)") con población 1 para
diferenciarlo del resto. **Ya es así** — confirmado en `worldCatalog.ts`
(`slug: 'orco-enfurecido-hondonada'`): `kind: 'PRINCIPAL'`, `scope: '(global)'` (una sola fila en
todo el mundo). No participa en ningún pool de `WorldPopulation` —
`decrementPopulationOnDeath` (`services/population.ts:73`) solo toca filas de `WorldPopulation`,
y este NPC no tiene ninguna asociada. **Conclusión: renombrarlo es cosmético (más claridad en
Enciclopedia/UI si se quiere), pero no toca la causa real del bug de resurrección**, que sigue
siendo la ya diagnosticada y registrada por separado: `RESURRECTION_LEAK_REGEX` (`narrador.ts`) no
cubre el vocabulario real que usó el modelo. Ese fix sigue pendiente, tracked en
`revisar-partida-hallazgos.md`, no en este documento.

## Piezas de trabajo reales identificadas

### 1. Narrar explícitamente la inconsciencia al terminar el combate

Hoy el bloque de instrucciones de combate (`combatBlock` dentro de `buildNarrationPrompt`,
`narrador.ts`) solo dice "narra el intercambio de este turno... puedes proponer condicionFisica si
sale herido" — no exige explícitamente narrar el momento en que el enemigo cae inconsciente cuando
ese es justo el golpe que termina el combate. Resultado: el panel de victoria puede aparecer sin
que la propia narración del último golpe lo haya descrito con claridad.
**Alcance**: instrucción de prompt nueva, condicionada a "este golpe deja al NPC en
CONVALECIENTE/MUERTO" (dato ya disponible en `turnResolution.ts` en el momento de construir el
prompt). Bajo riesgo, un solo archivo.

**Implementado y verificado (2026-08-13)**: nuevo `npcFallsUnconsciousThisTurn` calculado en
`turnResolution.ts` justo al lado de `combatBothMissed` (mismo patrón) — true solo el turno EXACTO
en que `npcTargetNewCondicion` pasa a CONVALECIENTE/MUERTO viniendo de un estado distinto (nunca si
ya estaba así de antes). Viaja por `TurnContext.npcFallsUnconsciousThisTurn` (narrador.ts) hasta
`combatBlock` en `buildNarrationPrompt`, que añade una frase explícita pidiendo narrar ese momento
concreto cuando aplica. Tests: 2 nuevos en `narrador.test.ts` (con/sin la instrucción en el
prompt).

### 2. Recuperación tras 6h (CONVALECIENTE) / desaparición tras 48h (MUERTO) + panel de interacción

**No existe ningún mecanismo de este tipo hoy** — confirmado por grep en `death.ts` y el resto de
`services/*.ts`: cero código que revierta `condicionFisica` con el paso del tiempo, ni que borre/
oculte un cadáver. Diseño confirmado con la usuaria (2026-08-13), más amplio que el esbozo inicial:

**a) Recuperación de CONVALECIENTE** — a las 6h de tiempo de ficción sin decapitar, vuelve a
**HERIDO** (no GRAVE ni ILESO — decisión explícita de la usuaria, corrige la recomendación inicial
de este documento). Si se le ataca de nuevo a mitad de la recuperación, **combate normal, sin caso
especial**: si se remata, MUERTO; si no, sigue CONVALECIENTE y el conteo de 6h se reinicia solo
(nueva marca de tiempo al volver a dejarlo CONVALECIENTE), sin lógica aparte que mantener.

**b) Desaparición de un cadáver (MUERTO)** — a las 48h de tiempo de ficción (no tiempo real), el
cadáver desaparece del mundo.

**c) Panel de interacción fuera de combate (pieza nueva, no estaba en el esbozo inicial)** —
interactuar con un NPC/fauna convaleciente o un cadáver (sin estar en combate activo) abre una
vista tipo "Victoria" de `CombatPanel.tsx` pero SIN el texto de victoria: la ficha del NPC/fauna
(igual que en combate) + botones:
- **CONVALECIENTE**: Salir · Saquear (solo si `!saqueado`) · Decapitar.
- **MUERTO**: Salir · Saquear (solo si `!saqueado` — sin Decapitar, ya está muerto).

Necesita, además del mecanismo de tiempo:
- Nuevos campos en `NpcState`: marca de tiempo de ficción de cuándo quedó CONVALECIENTE (para la
  regla a) y de cuándo quedó MUERTO (para la regla b) — requiere migración de schema (SQL a mano,
  nunca `prisma migrate dev`, ver docs/arquitectura/15-instalacion.md).
- Comprobación en cada turno/tick contra `fictionalMinutes` actual (mismo tipo de chequeo que ya
  hace `worldTick.ts` para tránsitos) — candidato natural: el mismo sitio que ya recorre NPCs en
  escena, o un paso nuevo en `worldTick.ts`.
- Detección de "el jugador quiere interactuar con un NPC/fauna convaleciente o muerto que ya
  conoce" fuera de combate — probablemente reutilizando `detectNpcsInScene` + comprobar
  `condicionFisica`, similar en espíritu al validador de grounding de hoy pero para el caso
  contrario (SÍ existe y SÍ está aquí, solo que inconsciente/muerto).
- Frontend: panel nuevo o variante de la pantalla "ended" de `CombatPanel.tsx`, disparable sin
  pasar por combate.
- Se decapita → `decrementPopulationOnDeath` ya se dispara (mecanismo existente, no tocar). Dejarlo
  vivo e inconsciente → sin decremento de población hasta que se decapite o se remate de verdad.
- Pregunta abierta, no cerrada todavía: ¿la desaparición a las 48h de un cadáver ya saqueado del
  todo simplemente borra su `NpcState`/lo saca de escena, o hace falta algo más (p. ej. un
  `SessionFact` que registre que el cuerpo "ya no está" para que el Narrador no lo mencione)?

**Implementado y verificado (2026-08-13)**:
- Backend: `detectsPostCombatInteraction` (nuevo `services/postCombatInteraction.ts`) — reutiliza
  la lista de `detectNpcsInScene` ya calculada para el validador de grounding (sin consulta nueva),
  filtra por `condicionFisica` CONVALECIENTE/MUERTO y comprueba que el jugador nombra a ese NPC por
  su nombre en la propia acción (no solo por hechos de sesión antiguos, mismo cuidado que el bug de
  resurrección de esta misma sesión). Cableado en `POST /turn/classify`, solo fuera de combate
  (`!enCombate`), antes de `classifyAction` — devuelve `{ postCombatInteraction: {...} }` en vez de
  la clasificación normal; no es una violación (a diferencia del validador de grounding), así que
  no persiste ningún `LogEntry`, no cuenta como una acción de verdad.
- Frontend: `PostCombatInteractionModal.tsx` (nuevo) — misma carcasa de overlay que
  `CombatSelectionModal.tsx`. `GameView.tsx` detecta `classifyResult.postCombatInteraction`,
  deshace el "TÚ: ..." optimista del log (el backend no persistió nada) y abre el modal. Saquear/
  Decapitar reutilizan el mecanismo determinista YA existente sin ningún endpoint nuevo: solo
  llaman a `handleSubmit` con el mismo texto libre que ya reconocen `detectsLootIntent`/
  `detectsExecuteIntent` (`Saqueo el cuerpo de 'X'.` / `Decapito a 'X'.`), el turno normal se
  encarga del resto.
- La pregunta abierta sobre `SessionFact` al desaparecer un cadáver se deja tal cual (no se
  implementó nada aparte del borrado del `NpcState`) — riesgo bajo: el propio Narrador ya evita
  narrar como activo a cualquier NPC MUERTO por instrucción de `npcSceneBlockFor`, y sin `NpcState`
  ni siquiera aparece como "ya resuelto" en el contexto, simplemente deja de mencionarse.

### 3. Recompensa determinista de misión (el mapa, y en general)

Hallazgo clave en `prisma/schema.prisma`, modelo `Quest`: el campo `rewardItems` (ej.
`['Mapa de las Llanuras', 'Maza orca']`, fijado en `turnResolution.ts:3562` al crear la misión del
Orco Enfurecido) es **solo texto para mostrar en el panel — no crea ningún `InventoryItem` por sí
solo** (comentario explícito en el propio schema). La entrega real de esos objetos hoy pasa
enteramente por el loot normal del cadáver (su `loadout` en `worldCatalog.ts`). Es decir: **la
recompensa determinista de misión que describe la usuaria no existe todavía** — no es solo
"separar el mapa del resto del loot", hace falta construir el mecanismo de entrega en sí:
- Al completarse una misión (`status` → `COMPLETADA`), crear de verdad los `InventoryItem` de
  `rewardItems` que aún no se hayan entregado por otra vía (evitar duplicar si el jugador ya lo
  looteó del cadáver).
- Para el caso concreto del mapa: decisión de diseño de la usuaria — quitarlo del `loadout` del
  Orco Enfurecido en el catálogo y entregarlo SOLO como recompensa de misión (ligado a
  CONVALECIENTE/MUERTO, no a saquear el cuerpo), para que quede desacoplado del saqueo normal.

**Implementado y verificado (2026-08-13)** — junto con la pieza 5 (narración), en el mismo commit:
- `grantQuestRewardItems` (nueva, privada) — crea de verdad los `InventoryItem` de `rewardItems`
  que el jugador aún no tenga (dedup por nombre normalizado), idempotente si se llama dos veces
  sobre la misma misión ya recompensada.
- `questRewardNarrationFor` (nueva, privada) — texto determinista `Misión completada: "X" —
  consigue Y, +N XP.`, mismo criterio "nunca lo decide el modelo" del resto del motor.
- `closeItemQuests` (misión "conseguir Z") ahora recibe `timeLabel`/`fictionalMinutes` y llama a
  las dos funciones de arriba tras cerrar — cubre tanto el turno normal como `recolectar.ts`
  (Minar/Talar/Desollar), ambos call sites actualizados.
- `completeNpcTargetQuests` (nueva, privada) — extraída para no duplicar el mismo bloque (cerrar +
  recompensar + narrar) entre un ataque normal y "Decapitar", los dos caminos que pueden dejar a
  un NPC CONVALECIENTE/MUERTO.
- El mapa se quitó de verdad del `loadout` del Orco Enfurecido (`worldCatalog.ts`) y su
  `rewardItems` pasó de `['Mapa de las Llanuras', 'Maza orca']` a solo `['Mapa de las Llanuras']`
  — "Maza orca"/"Amuleto de hueso" siguen viniendo del loot normal (seguían en el `loadout`);
  incluirlos también en `rewardItems` los habría adelantado al momento de derrotarlo, antes de
  poder saquear de verdad.
- **Hueco cerrado en el mismo commit**: la rama "el orco ya estaba resuelto antes de aceptar la
  misión de Gistera" (`orcoYaResuelto`, la misión nace ya `COMPLETADA` directamente vía
  `tx.quest.create`) nunca pasa por `completeNpcTargetQuests` — sin un fix aparte ahí, el mapa se
  habría perdido para siempre en ese camino concreto. Cubierto con un test de integración real
  (extensión del test ya existente "la misión nace ya COMPLETADA...").
- **Alcance NO cubierto a propósito** (documentado, no descubierto tarde): la recompensa-al-saquear
  más antigua (`turnResolution.ts`, "Recompensa estática de misión al saquear", solo XP) y el cierre
  de misión "llegar a Y" (`targetLocationId`) siguen sin pasar por `grantQuestRewardItems` — ninguna
  misión real hoy usa `rewardItems` en esos dos caminos, así que no había caso de prueba real que
  lo justificara; extender si algún día una misión de ese tipo los necesita.
- Tests: 1 nuevo de integración real (Decapitar + misión con `rewardItems` → objeto creado + log),
  1 extendido (rama `orcoYaResuelto`), 2 tests de `recolectar.test.ts` corregidos (mocks
  desactualizados por el cambio de firma de `closeItemQuests`).

### 3bis. Recompensa de misión no-objeto: recetas y compañero (2026-08-17)

Ampliación de la pieza 3 — no toda recompensa de misión es un `InventoryItem`. `Quest` ganó dos
campos nuevos en `schema.prisma`: `rewardRecipeKeys: string[]` (recetas de crafteo que se
desbloquean, comprobadas contra `Save.unlockedRecipeKeys` y el flag opcional
`CraftingRecipe.requiresUnlock` en `crafting.ts`) y `rewardCompanion: Json?` (forma
`{name, role, notes}`, tipo compartido `QuestRewardCompanion` en `questResolution.ts`). Pasivas
temporales ("+5 fuerza durante 24h") quedan fuera a propósito — necesitarían un sistema de duración
que todavía no existe en ningún sitio del motor.

`grantQuestRewardRecipesAndCompanion` (nueva, `questResolution.ts`) concede ambas cosas: la receta
se añade a `unlockedRecipeKeys` sin duplicar si ya estaba; el compañero se crea respetando el mismo
tope real de plazas que cualquier otro (`companionSlotsForRecipeKey`) — si no hay hueco, se omite
en silencio, el resto de la recompensa (XP/objetos/recetas) se concede igual. Llamada desde los
mismos dos sitios que `grantQuestRewardItems` (`closeItemQuests`/`completeNpcTargetQuests`), y
narrada en el mismo texto determinista (`questRewardNarrationFor`, ampliado con "aprende N
receta(s) nueva(s)"/"se une {nombre}").

### 4. Fondo amarillo al completar una misión (UI)

Confirmado en `MisionesPanel.tsx:11,17`: `COMPLETADA` se pinta hoy con el mismo estilo neutro que
el resto (`border-iron-700 text-wood-400`), sin ningún tratamiento especial. Cambio de frontend
acotado — nuevo caso en el mapa de colores por `status`, mismo patrón que los "3 fondos" ya
existentes en `LogPanel.tsx` (notificación de misión aceptada, 2026-07-31).

**Implementado y verificado (2026-08-13)**: nuevo `CARD_CLASS` (`MisionesPanel.tsx`) — la tarjeta
entera de una misión `COMPLETADA` lleva fondo/borde amarillo (`bg-yellow-500/10 border-yellow-600/40`),
no solo la pastilla de estado (que también pasa de gris a amarillo). `ACTIVA`/`FALLIDA` sin cambios.

### 5. Narración determinista de recompensas al completar

Ligado al punto 3: cuando una misión pasa a `COMPLETADA`, debería generarse un `LogEntry`
determinista (sin IA) que liste XP + objetos concedidos — mismo criterio de "nunca lo decide el
modelo" que ya rige saqueo/despiece/crafteo. Hoy no existe ningún `LogEntry` dedicado a esto; el
aviso actual de completar misión (si lo hay) depende de que el propio narrador lo mencione de
pasada.

**Implementado junto con la pieza 3** (mismo commit, 2026-08-13) — ver `questRewardNarrationFor`
en la sección de arriba, es la misma pieza de trabajo, no una separada.

## Pendiente de decidir con la usuaria (antes de implementar)

- Orden de las 4 piezas (parecen independientes entre sí, no hay dependencia dura salvo que 3 y 5
  conviene hacerlas juntas).
- Diseño exacto del punto 2: a qué condición física se recupera, y qué pasa si se le ataca de nuevo
  a mitad de recuperación.
- Si el rebautizo cosmético del Orco Enfurecido merece la pena hacerlo de todos modos, aparte de
  esto.
