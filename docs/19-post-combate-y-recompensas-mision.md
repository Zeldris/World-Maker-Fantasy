# Post-combate (inconsciencia/recuperación) y recompensas deterministas de misión

**Estado:** documento vivo. Investigación cerrada el 2026-08-12; implementación empezada el
2026-08-13 ("sigue e implementa todas las fases que sacamos ayer al roadmap"). Pieza 1 (narrar
inconsciencia) **implementada y verificada**. Piezas 2-4 siguen pendientes, ver cada sección.

## Contexto

Surgió investigando el bug de resurrección del Orco Enfurecido (ver
`docs/revisar-partida-hallazgos.md` § "2026-08-12 — Orco Enfurecido (ya MUERTO) narrado atacando
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
INCAPACITADO/MUERTO" (dato ya disponible en `turnResolution.ts` en el momento de construir el
prompt). Bajo riesgo, un solo archivo.

**Implementado y verificado (2026-08-13)**: nuevo `npcFallsUnconsciousThisTurn` calculado en
`turnResolution.ts` justo al lado de `combatBothMissed` (mismo patrón) — true solo el turno EXACTO
en que `npcTargetNewCondicion` pasa a INCAPACITADO/MUERTO viniendo de un estado distinto (nunca si
ya estaba así de antes). Viaja por `TurnContext.npcFallsUnconsciousThisTurn` (narrador.ts) hasta
`combatBlock` en `buildNarrationPrompt`, que añade una frase explícita pidiendo narrar ese momento
concreto cuando aplica. Tests: 2 nuevos en `narrador.test.ts` (con/sin la instrucción en el
prompt).

### 2. Recuperación tras 6 horas de tiempo de juego si no se decapita

**No existe ningún mecanismo de este tipo hoy** — confirmado por grep en `death.ts` y el resto de
`services/*.ts`: cero código que revierta `condicionFisica` de INCAPACITADO a un estado mejor con
el paso del tiempo. Es una pieza nueva de verdad:
- Necesita guardar CUÁNDO quedó incapacitado (marca de tiempo de ficción — `NpcState` no tiene hoy
  ningún campo así, habría que añadirlo).
- Necesita comprobarlo en cada turno/tick contra `fictionalDate` actual (mismo tipo de comprobación
  que ya hace `worldTick.ts` para tránsitos).
- Decisión de diseño pendiente: ¿a qué condición se recupera exactamente (vuelve a GRAVE? a ILESO?)
  y qué pasa si el jugador vuelve a atacarlo a mitad de recuperación.
- Se decapita → `decrementPopulationOnDeath` ya se dispara (mecanismo existente, no tocar). Dejarlo
  vivo e inconsciente → sin decremento de población, y ahora además con posibilidad real de que se
  reponga si no se remata a tiempo.

### 3. Recompensa determinista de misión (el mapa, y en general)

Hallazgo clave en `prisma/schema.prisma`, modelo `Quest`: el campo `rewardItems` (ej.
`['Mapa de las Llanuras', 'Maza orca']`, fijado en `turnResolution.ts:3216` al crear la misión del
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
  INCAPACITADO/MUERTO, no a saquear el cuerpo), para que quede desacoplado del saqueo normal.

### 4. Fondo amarillo al completar una misión (UI)

Confirmado en `MisionesPanel.tsx:11,17`: `COMPLETADA` se pinta hoy con el mismo estilo neutro que
el resto (`border-iron-700 text-wood-400`), sin ningún tratamiento especial. Cambio de frontend
acotado — nuevo caso en el mapa de colores por `status`, mismo patrón que los "3 fondos" ya
existentes en `LogPanel.tsx` (notificación de misión aceptada, 2026-07-31).

### 5. Narración determinista de recompensas al completar

Ligado al punto 3: cuando una misión pasa a `COMPLETADA`, debería generarse un `LogEntry`
determinista (sin IA) que liste XP + objetos concedidos — mismo criterio de "nunca lo decide el
modelo" que ya rige saqueo/despiece/crafteo. Hoy no existe ningún `LogEntry` dedicado a esto; el
aviso actual de completar misión (si lo hay) depende de que el propio narrador lo mencione de
pasada.

## Pendiente de decidir con la usuaria (antes de implementar)

- Orden de las 4 piezas (parecen independientes entre sí, no hay dependencia dura salvo que 3 y 5
  conviene hacerlas juntas).
- Diseño exacto del punto 2: a qué condición física se recupera, y qué pasa si se le ataca de nuevo
  a mitad de recuperación.
- Si el rebautizo cosmético del Orco Enfurecido merece la pena hacerlo de todos modos, aparte de
  esto.
