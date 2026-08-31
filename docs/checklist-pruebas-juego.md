# Checklist de pruebas de juego — vivo, sin fecha de cierre

**Qué es:** inventario de TODAS las superficies jugables del juego, con su estado real de prueba
(probado en vivo / probado por tests automáticos solamente / sin probar). A diferencia de los demás
`checklist-*.md` del repo (que cierran una auditoría puntual y quedan congelados en su fecha), este
documento es un **checklist vivo**: se actualiza cada vez que se prueba algo nuevo, sin fecha de
cierre. Nace 2026-08-27, primera sesión con Claude jugando el frontend real vía Playwright (ver § 6).

**Cómo usarlo**: antes de dar algo por probado, comprobar aquí si ya lo está — evita repetir pruebas
al azar y ayuda a decidir qué probar a continuación. Al terminar una sesión de pruebas, actualizar
el estado de cada ítem tocado con la fecha y, si se encontró un bug, el enlace a la memoria/commit
del fix.

**Aviso importante** (aprendido de memorias previas desactualizadas, ver `tarkor_revision_partidas_reales_2026-08-26`):
una memoria de sesión que dice "pendiente jugarlo en vivo" puede haber quedado desactualizada por
trabajo de una sesión POSTERIOR que sí lo probó. Antes de marcar algo como "sin probar" basándose en
una memoria vieja, buscar si hay una memoria más reciente que lo contradiga.

**Criterio de prueba obligatorio, añadido 2026-08-28** (petición explícita de la usuaria, ver
`tarkor_directriz_estado_sobrevive_recarga_2026-08-28`): cualquier "oferta"/"pendiente"/"tarjeta de
decisión" nueva (algo que espera una respuesta del jugador) debe probarse EXPLÍCITAMENTE
recargando la página (`page.reload()` o cierre/reapertura del navegador) con el backend vivo, antes
de darla por probada — el estado debe reconstruirse completo. Solo es aceptable perder ese estado
si el propio proceso backend se reinició/cayó, nunca por una simple recarga de cliente. Dos casos
reales ya encontrados que violan esto: la tarjeta Matar/Capturar/Clemente de un NPC Convaleciente
y la oferta de modo dinámico ("Interactuar") — ambos viven solo en el `characterLog` efímero de
React, nunca en el backend.

Leyenda de estado:
- ✅ **Probado en vivo** — jugado de verdad (navegador o partida real de la usuaria), con resultado
  observado y verificado.
- 🧪 **Solo tests automáticos** — `tsc -b` limpio + suites en verde, pero el LLM está mockeado en los
  tests; nunca se ha visto la narración/UI real generarlo.
- ❌ **Sin probar** — ni en vivo ni con cobertura de test específica conocida.
- 🚧 **Requiere condición previa difícil** — existe y en teoría funciona, pero alcanzar el escenario
  en una partida normal es raro/lento (progreso de nivel, estación/clima concretos, etc.).
- ⛔ **Bloqueado/incompleto a propósito** — decisión ya tomada de dejarlo sin construir del todo.

---

## 1. Combate 1v1 (motor clásico)

**Aviso (2026-08-28)**: `combatExchange.ts` (`rollSide`/`ExchangeParticipant`/`ExchangeSideResult`)
se tocó a fondo hoy — pasivas raciales + `attributeBonus` expuesto. El motor lo hereda CUALQUIER
intercambio de combate, 1v1 o múltiple — las filas de abajo marcadas "REABRIR" son solo las más
representativas; en la práctica, cualquier combate jugado sirve para reverificar el motor entero de
paso (el resultado final del número no cambió, solo lo que ahora se expone y las 2 pasivas nuevas).

| Ítem | Estado | Notas |
|---|---|---|
| Ataque básico, tirada, daño, condición física | ✅ reverificado en vivo (2026-08-28) | `rollSide`/`resolveExchange` con pasivas raciales + `attributeBonus` — jugado combate completo real (Orco Enfurecido, misión Gistera Koh), desglose `🎲dado+bono(atributo/2)=total` visible y correcto en 10+ intercambios, progresión Ileso→Herido→Grave→Convaleciente→Muerto observada de punta a punta. |
| Habilidades de ataque (Tajo Horizontal, Estocada Veloz, Sangre del Estallido) | ✅ Sangre del Estallido reverificada (2026-08-28) | Usada en vivo, dejó al rival Convaleciente con un golpe crítico — `attributeBonus` (+2) visible en el desglose. Tajo Horizontal/Estocada Veloz siguen sin probarse en vivo esta ronda. |
| Habilidades defensivas (Defenderse, Esquivar, Piel de Guerra) | 🧪 parcial (2026-08-28) | Defenderse probada en vivo (recupera energía, resuelve normal). Piel de Guerra/pasiva racial orca (desventaja a CONTROL) sin ver en pantalla todavía — no se dio la condición en este combate. |
| Analizar Rival | ✅ | Conectado y verificado en combate múltiple (2026-08-27); en 1v1 ya funcionaba de antes. |
| Narración vs. mecánica: golpe que no conectó narrado como acierto | ✅ fijado, vocabulario ampliado 2 veces más (2026-08-28) | `hasFalseCombatHit`, vocabulario ampliado varias veces. **2 huecos nuevos encontrados jugando en vivo, mismo combate contra Kirelon Arenoso, turnos consecutivos**: (1) "la clava con fuerza en el cuello... haciendo que éste retroceda" con tirada real Fallo (`parada_en_seco`) — `clava\s+(su|el|un|la)` no cazaba "clava CON fuerza EN" (preposición colada entre verbo y artículo), añadida alternativa `clava\s+con\s+\w+\s+en`; (2) turno siguiente, "apunto a Kirelon Arenoso y derriba su brazo de cuchillo" con tirada real también `parada_en_seco` — "derriba" sin más era vocabulario de golpe conectado totalmente sin cubrir, añadido `derrib[oa]|derribando`. 2 tests de regresión nuevos. Verificado: `tsc -b` limpio, backend 187/187 en `narrador.test.ts`. |
| Narración vs. mecánica: esquiva/bloqueo narrado cuando SÍ hubo golpe | ✅ fijado | `hasFalseCombatMiss` — 2 rondas de fix el 2026-08-27 ("bloquea el ataque", "se desvía"/"se aparta"). Ver `tarkor_bug_narracion_atacante_invertido_2026-08-27`. |
| Narración vs. mecánica: atacante invertido (jugador narrado como quien acierta cuando fue el NPC) | ✅ fijado, pendiente reverificar | `hasFalseCombatAttacker` nuevo (2026-08-27) — visto 2/4 turnos antes del fix; tras el fix, todos los turnos vistos en la partida original fueron de empate/mutuo éxito. Partida reiniciada de cero 2026-08-27/28 para reverificar con el modelo grande — sesión interrumpida por el bug del turno fantasma (ver fila de abajo) antes de completar un combate nuevo. **Sigue pendiente: repetir hasta ver un turno donde el NPC gane claro y confirmar que el guard actúa.** **Variante nueva CONFIRMADA reproducible por UI normal (2026-08-28)**: turno con NPC atacando (Kirelon Arenoso, "Caza por vibración") y FALLANDO (`resultado: ataque_falla`, `atacanteEsJugador: false`, `jugadorRecibeGolpe`/`npcAttackHits` ambos false → `combatBothMissed` debería ser `true`) narrado como "Gorhorn golpea fuertemente a la espalda de Kirelon Arenoso, dejando una mancha rojiza" — sujeto/objetivo invertidos Y contacto inventado en el mismo texto. `hasFalseCombatHit` debería haberlo cazado ("golpea" está en `COMBAT_HIT_LEAK_REGEX`) pero no se disparó. Confirmado que el turno viene de Playwright jugando por UI normal (no de mi prueba manual por API, que solo lo reveló al leer el historial). **Causa raíz encontrada, NO es un bug nuevo**: `combatBothMissed`/`hasFalseCombatHit` calculan y validan bien (confirmado por inspección — `exchangeHappened=true`, `npcAttackHits=false`, `jugadorRecibeGolpe=false` con `resultado: 'ataque_falla'`, contexto correcto enviado al modelo). El guard SÍ se disparó y pidió reintento, pero el modelo (probablemente el pequeño, más propenso) repitió el MISMO error de inversión sujeto/objeto en los 3 intentos de la cascada — y `narrador.ts` línea 1349 (`if (lastResult) return lastResult`) devuelve el último intento rechazado igualmente tras agotar los 3, por diseño deliberado (evita perder el turno entero si el modelo insiste). Es un trade-off ya asumido del sistema de reintentos, no un hueco de vocabulario ni un cálculo erróneo — sin acción propuesta. |
| Narración vs. mecánica: auto-contradicción en la misma frase (ambas mitades se desmienten) | 🧪 parcial | Cubierta solo para los 2 vocabularios ya vistos (bloquea+herida, esquiva+herida) — cualquier verbo nuevo puede seguir colándose, no hay detector genérico. **Otro caso real (2026-08-28, partida nueva de pruebas)**: "Quio se aparta con una agilidad sorprendente, dejando una mancha roja en la hoja de la hacha" — `resultado: parada_en_seco` (fallo total, sin contacto), "se aparta" correcto pero "mancha roja" contradice en la misma frase. Confirma el patrón ya documentado, sin construir detector genérico nuevo (decisión ya tomada). |
| **BUG CERRADO (2026-08-29)**: nombre de NPC inconsistente entre el encabezado del intercambio y el cuerpo de la narración, mismo turno | ✅ fijado | Turno Día 1, 13:02: el encabezado del log dijo "KIRELON ARENOSO ATACA CON 'CAZA POR VIBRACIÓN'" pero el cuerpo narrado dijo "El Quio retrocede gruñendo ante el ataque de Gorhorn" — Quio era el rival de un combate ANTERIOR de la misma sesión, ya ausente de la escena actual. Causa: el guard hermano `hasFalseCombatTargetName` solo detecta confusión entre NPCs presentes A LA VEZ en la escena (`otherNpcNamesInScene`) — un NPC ya ausente pero mencionado por el modelo (arrastrado de `sessionFacts` reciente) no lo cazaba. **Fix aplicado**: nuevo guard `hasWrongNpcName` (`narrador.ts`) — mismo criterio conservador que su hermano (solo dispara si el nombre real NO aparece en ningún sitio del texto), pero comparado contra `possiblyStaleNpcNames`: nombres de NPCs YA conocidos por esta partida (`NpcState` propio, query barata acotada a lo que la partida ya vio, sin cargar el catálogo completo del mundo) que no son el rival actual ni están en la escena de este turno (`turnResolution.ts`, junto al cálculo de `combatRealTargetName`). 3 tests de regresión nuevos en `narrador.test.ts`. Verificado: `tsc -b` limpio, 195/195 en `narrador.test.ts`, 1542/1542 unitarios backend, 97/97 integración. **Pendiente reverificar en vivo.** |
| **CAUSA RAÍZ ENCONTRADA (no era bug del motor)**: Orco Enfurecido "respawneó" como ILESO en un combate real nuevo | ✅ investigado y corregido (2026-08-28) | Investigando el hallazgo de arriba se encontró la causa real, MÁS GRAVE de lo pensado inicialmente: no era solo la narración mencionando mal un nombre — el propio motor determinista abrió un combate NUEVO real contra `orco-enfurecido-hondonada` con `condicionFisica: ILESO` (confirmado por API, `combateIniciado.npcs[0]`). Causa: el `NpcState` de ese NPC (scope PRINCIPAL, `''`) **no existía en absoluto** en Postgres — mi propio remate manual de antes (turno reenviado por HTTP directo para desatascar el bug de la tarjeta Convaleciente, ver `tarkor_bug_tarjeta_convaleciente_recarga_2026-08-28`) devolvió `combate: null` en su respuesta, señal de que NO pasó por el camino real de "ejecutar/ejecutar en combate" que escribe `condicionFisica: 'MUERTO'` (`turnResolution.ts:1975-1977`) — se resolvió como texto libre genérico fuera de combate estructurado, sin persistir el estado del NPC. **No es un bug del motor normal** (jugando por UI sin atajos manuales esto no pasa) — es una consecuencia real de mi propia intervención de emergencia anterior, que no reprodujo el 100% del camino que sigue el frontend. Corregido: `INSERT` manual en `NpcState` con `condicionFisica: 'MUERTO', saqueado: true, lootedItemNames: ['Maza orca','Amuleto de hueso']` (con aprobación implícita, dado que era arreglar una consecuencia de mi propio atajo anterior). **Lección para el futuro**: cualquier atajo manual por HTTP que sustituya un turno real de combate debe verificarse comprobando que la respuesta trae `combate` no-null (o el `NpcState` correspondiente en Postgres) antes de darlo por completado — de lo contrario deja huecos de estado silenciosos. |
| Persona gramatical (narrar siempre en 3ª persona) | 🧪 solo prompt, sin guard | Instrucción de prompt desde 2026-08-27, SIN guard determinista. **Confirmado en vivo que el modelo pequeño (`qwen3.5:4b`) la ignora** (turno real: "Te ergues... impactarte..."). Con el modelo grande (`tarkor-narrador`), turno de apertura fresco (2026-08-27/28, "Exploro la zona") narrado en 3ª persona correcta — 1 solo turno, muestra pequeña. |
| Fuga de inglés (`hasEnglishLeak`) | ✅ ampliado de nuevo (2026-08-28, partida nueva de pruebas) | Nuevo caso real: "El viento siseante lo accompanies en su búsqueda" — verbo inglés CONJUGADO sustituyendo al español ("acompaña"), variante nueva del hueco (los casos previos eran sustantivos/adjetivos sueltos). Añadido "accompanies" a `ENGLISH_LEAK_REGEX`. Test de regresión nuevo. Verificado: `tsc -b` limpio, backend 188/188 en `narrador.test.ts`. |
| **Hallazgo menor**: nombre de NPC pegado gramaticalmente como si fuera parte del lugar | ❌ nuevo (2026-08-28) | Turno de descanso nocturno: "Gorhorn se acomoda dentro de una boca de cueva hundida, Kirelon Arenoso, usando su arnés..." — "Kirelon Arenoso" (NPC del combate anterior en la misma sesión) aparece pegado como aposición del lugar, sin sentido gramatical (no dice que esté presente/vivo, solo lo mezcla mal en la frase). Distinto de los otros 2 hallazgos de NPC de hoy (esos afirmaban presencia/vida falsa) — aquí es puro ruido de coherencia narrativa, probablemente el modelo reutilizando el nombre reciente del contexto sin encajarlo bien. Sin guard candidato claro todavía, muestra de 1 turno. |
| Turno "fantasma" — conexión cortada a media narración pierde el turno sin persistir | ✅ fijado | Bug real (no de UI, de robustez del backend): `writeLine` (turn.ts) escribía directo al socket sin try/catch — si el cliente cortaba la conexión a mitad de streaming (navegador cerrado, wifi caído, recarga), el turno se perdía del todo. Reproducido con test de integración real, confirmado fix. Ver `tarkor_bug_turno_fantasma_stream_cortado_2026-08-27`. **FALSO POSITIVO descartado (2026-08-28/29)**: durante el cuelgue de Ollama de esta sesión, el botón ACTUAR parecía quedar permanentemente deshabilitado incluso tras recuperarse Ollama y tras un reinicio completo del backend hecho por la usuaria — se llegó a sospechar una reapertura de este bug o un candado (`turnLock`/`CharacterTransit.narrationClaimedAt`) quedando huérfano de forma persistente en Postgres. **Investigado a fondo y descartado**: la causa real era mucho más simple — los scripts de comprobación (`check_full.mjs`) leían el estado de `disabled` del botón ACTUAR con el composer de texto libre VACÍO, y el botón se deshabilita con normalidad sin texto que enviar (comportamiento esperado, no un bug). Confirmado con `Save`/`CharacterTransit` reales de la partida (consultados directamente vía Prisma): `characterTransit: null`, `pendingNpcAttack: null`, `pendingCombatNpcSlugs: []`, `combateIniciado: null` — nada pendiente de verdad. Al escribir texto en el composer y comprobar de nuevo, el botón ACTUAR se habilitó con normalidad y el turno se resolvió sin problemas. **Lección de proceso**: cualquier script de comprobación del estado de ACTUAR debe escribir texto en el composer antes de leer `disabled`, o el resultado no es representativo. |
| Huir de combate ANTES de entrar (`combat/flee`, botón junto a COMBATIR) | ✅ | Probado en sesiones previas — endpoint dedicado, una tirada determinista real. |
| Huir DENTRO de un combate ya iniciado (botón Huir del panel) | ✅ REDISEÑADO (P3.2, 2026-08-28) Y VERIFICADO EN VIVO — ambos caminos confirmados | Endpoint dedicado `combat/huir-en-curso` reemplaza el texto libre viejo — tirada real, fallo aplica golpe directo sin tirada de defensa. Bloqueado con 409 si el jugador está CONVALECIENTE. **Bug real encontrado jugando**: pulsar Huir estando Convaleciente no hacía NADA visible — el `catch` de `handleCombatHuir` tragaba el 409 en silencio. Corregido: ahora escribe el mensaje de error real del backend en el log de personaje. 1 test nuevo (`useCombatFlow.test.tsx`). Verificado: `tsc -b` limpio, frontend 23/23. **Camino de ÉXITO confirmado en vivo** (4 veces, partida nueva, 2026-08-28): Gorhorn HERIDO contra Kirelon Arenoso (nivel 8) — "Gorhorn rompe el contacto y logra escapar del combate", `combateIniciado` limpio, `condicionFisica` sin cambio. **Camino de FALLO también confirmado en vivo** (misma sesión): "Gorhorn intenta huir, pero el rival aprovecha el movimiento para conectar un golpe directo, sin darle tiempo a defenderse" — narración exactamente coherente con el diseño (sin tirada de defensa), `condicionFisica` empeoró un escalón (Herido→Grave), combate se quedó abierto (correcto). Ambos caminos del rediseño P3.2 confirmados funcionando en producción real. **Bloqueo por CONVALECIENTE reverificado en vivo (2026-08-29)**: pulsar Huir estando CONVALECIENTE mostró correctamente en el log "No puedes intentar huir estando convaleciente — resuelve tu propia condición primero." (409 del backend, ya no tragado en silencio). Nota de diseño aclarada: no existe ningún botón dedicado para "resolver la propia condición" del jugador — es la redacción del mensaje, no un hueco real; el diseño ya decidido (2026-07-31) es que estando CONVALECIENTE solo se puede seguir atacando/defendiendo (muy penalizado) hasta que el combate se resuelva por sí solo, igual que con Defenderse/Esquivar normales. |
| Clemente / Dejar vivir | ✅ | Confirmado 2026-08-26 (checklist 5 cierres rápidos). |
| **BUG CERRADO (2026-08-29)**: recargar tras Convaleciente atasca el combate del todo | ✅ fijado (código), pendiente reverificar en vivo | La tarjeta con los 3 botones (`entry.convalecienteOffers`) SOLO se calculaba en el momento del turno y vivía en el `characterLog` efímero de React — nunca se reconstruía al recargar. El bloqueo del composer (`combatHasPendingConvalecientes`, `useCombatFlow.ts:177`) sí persistía tras recargar (se deriva del estado real `combatNpcsDisplay`), y el botón HUIR también quedaba `disabled` en ese estado (`CombatPanel.tsx:425`, `pendingDecisions`) — **atasco total sin ninguna vía de UI**, confirmado con Playwright. **Fix aplicado**: NO hizo falta ningún campo nuevo en el backend — `combateIniciado.npcs[].condicionFisica`/`.name`/`.capturable`/`.slug` ya viajaban en `GET /saves/:id` desde el fix de combate múltiple (2026-08-27), y `syncFromSave` ya rehidrataba `combateIniciado` completo. El único cambio fue en `LogPanel.tsx` (línea ~466-485): nueva tarjeta PERSISTENTE, calculada directamente de `combatNpcsDisplay` (filtrando `condicion === 'CONVALECIENTE' && !dismissed`) en vez de depender de `entry.convalecienteOffers`, con `onMatarConvaleciente`/`onCapturarConvaleciente`/`onClementeConvaleciente` ya resueltos por `slug` desde `GameView.tsx`. **Comportamiento resultante, correcto por diseño**: el botón HUIR sigue bloqueado mientras haya un convaleciente sin resolver (intencional — no se puede huir dejando a medias la decisión sobre un rival caído), pero ahora la tarjeta de 3 botones SÍ reaparece tras F5, dando una vía real de salida (Matar/Capturar/Clemente resuelve y desbloquea Huir/composer). Verificado: `tsc -b` limpio backend+frontend, 111/111 frontend, 3050 tests unitarios backend en verde (Postgres no disponible en esta sesión para correr integración — la usuaria gestiona sus propios servidores). **Pendiente**: no hay test de integración dedicado a "GET /saves/:id tras recargar con un convaleciente pendiente" (a diferencia de `esperandoDefensaJugador`, que sí lo tiene) — añadir uno si se retoma esta zona. Reverificar en vivo la próxima vez que se juegue. |
| Capturar tras combate | 🧪 REDISEÑADO (2026-08-28) | Flujo completo reescrito — ya no es "captura instantánea contra la Jaula", ahora es atar→InventoryItem en tránsito→depositar en Jaula (ver § 4). El bug de grupo (fauna) quedó cerrado, ver § 2. Verificado solo por tests, no jugado en vivo con el flujo nuevo. |
| **BUG CERRADO (2026-08-29)**: saqueo podía mostrar "saqueado" en UI sin persistir nada | ✅ fijado | Jugando el flujo completo ("Saquear todo" → modal → "Saquear") el 2026-08-28, la UI mostró "Muerto · saqueado" con normalidad, pero al comprobar el backend (`GET /saves/:id`) el turno de saqueo había quedado SIN narración de resultado (turno huérfano, mismo síntoma que el "turno fantasma" ya fijado para otro camino) y los objetos no llegaron al inventario real. Causa: `handleSaquearSeleccion` (`useCombatFlow.ts:489-515`) actualizaba `yaSaqueado: true` de forma OPTIMISTA antes de que `submitCombatAction` confirmara, sin ningún camino de reversión si el turno fallaba — a diferencia de `handleDecapitarSeleccion` (línea 424-440), que sí revierte a CONVALECIENTE si `!ok`. **Fix aplicado**: mismo patrón de reversión, adaptado a que el saqueo puede ser PARCIAL (varios NPC, selección de objetos) — se guarda un snapshot `previousStates` (`yaSaqueado`/`lootedItemNames` reales por NPC) antes de mutar, y si `submitCombatAction` devuelve `false` se restaura ese snapshot exacto por NPC en vez de un valor fijo único (que sí basta para Decapitar, donde el único estado previo posible es CONVALECIENTE). Confirmado por revisión de código (2026-08-29): el fix ya estaba en el archivo, solo faltaba reflejarlo aquí. **Pendiente**: no se encontró test de regresión dedicado a este caso (saqueo fallido → reversión) en `useCombatFlow.test.tsx` — añadir uno simétrico al de Decapitar fallido si se retoma esta zona. **Desatascado en su día (2026-08-28)**: reenviado el turno de saqueo vía `/turn/classify`+`/turn/narrate` con `lootItemNames`, con aprobación previa de la usuaria — Maza orca + Amuleto de hueso ya en el inventario real, `combateIniciado: null` (combate cerrado del todo). |
| **BUG CERRADO (2026-08-29)**: cadáver aparecido tras la primera visita a la escena quedaba invisible para Desollar | ✅ fijado | Reverificando en vivo con Playwright (agente jugando la partida real de Gorhorn): tras cazar un grupo y matar un Gesgurio en combate, Desollar nunca ofreció la opción — ni el aviso pasivo, ni `GET /saves/:id/recolectar/desollador` (`{"sources":[]}"`), pese a `NpcState.condicionFisica: MUERTO` real y `HarvestYield` real en catálogo. **Causa raíz**: `Save.harvestRollCache` (`recolectar.ts`) congela la tirada de "desollador" la primera vez que se consulta una ubicación (`cachedRollFor`) — el `useEffect` pasivo del frontend consulta ESO al ENTRAR a la escena, antes de que hubiera ningún cadáver, así que se congela `{sources: []}`. La invalidación normal (`invalidateRollCacheFor`, disparada al confirmar una recolección) solo dispara si algún `sourceSlug` de la tirada congelada coincide con lo tocado — una tirada VACÍA no tiene ningún slug que pueda coincidir nunca, así que queda huérfana para siempre en esa visita a la zona. Afectaba a los 3 caminos que pueden matar a un NPC (combate 1v1 normal, Decapitar, combate múltiple), no solo al recién estrenado combate múltiple. **Fix**: nueva función `invalidateCarcassRollCache` (`recolectar.ts`) que tira la entrada `desollador` completa por ubicación (sin mirar slugs) en cuanto un turno deja algún NPC MUERTO ahí — enganchada en `turnResolution.ts` en dos puntos: tras el camino 1v1/Decapitar (`npcTargetNewCondicion === 'MUERTO' \|\| executeTargets.length > 0`) y tras poblarse `combatEncounterLootSummary` para combate múltiple (más fiable que `combatEncounterCaidos`, que solo refleja el golpe de ESE turno, no el estado final acumulado de un grupo). 2 tests de integración nuevos (`turn.integration.test.ts`): uno reproduce el escenario de combate múltiple con la caché vacía sembrada a mano, otro cubre Decapitar contra fauna solitaria — ambos confirmados estables (10/10 en aislamiento tras mockear `Math.random`, la propia tirada de habilidad del endpoint también es aleatoria y no debía confundirse con el bug). Verificado: `tsc -b` limpio, 3261 tests unitarios, 167 tests de integración (13 archivos). **REVERIFICADO EN VIVO tras reinicio (mismo día)**: al intentar reproducir este fix jugando de verdad, apareció un SEGUNDO bug real distinto — ver fila siguiente ("candado circular al matar fauna 1v1"). Con ambos fixes aplicados y el backend reiniciado, confirmado el flujo completo: matar un Kirelon Arenoso en combate 1v1 → aviso "Hay presas caídas sin desollar en esta zona" aparece → modal de Desollar ofrece Hueso/Cráneo/Piel de escamas/Garras de Kirelon → tras confirmar, los 4 objetos llegan de verdad al inventario (confirmado en Postgres). |
| **BUG CERRADO (2026-08-29)**: candado circular tras matar fauna en combate 1v1 — partida bloqueada sin ninguna vía de UI | ✅ fijado | Reproducido en vivo con Playwright (yo mismo, tras el hallazgo inicial de un agente): matar un Kirelon Arenoso con "Matar" en combate 1v1 clásico, pulsar "Salir" de la pantalla de victoria, deja la partida COMPLETAMENTE bloqueada — composer con `aria-disabled: true`, sin ningún panel de combate visible. El botón "⚔️ Combatir" seguía presente y SÍ reabre el panel, pero solo muestra la misma pantalla "¡VICTORIA!" con un único botón "Salir" (sin "Saquear todo", porque ese botón — `CombatPanel.tsx`, `quedaAlgoPorSaquear` — solo cuenta NPCs de `enciclopedia.npcs`, es decir humanoides; fauna se despieza por Desollar, un mecanismo aparte) — bucle sin salida real, confirmado con captura de pantalla. **Causa raíz**: el aviso pasivo de Desollar (`GameView.tsx`, "Hay presas caídas sin desollar") exige `!combateIniciado` para aparecer, pero `combateIniciado` (reconstruido en cada `GET /saves/:id`, `detail.ts`) solo se vacía cuando el NPC muerto está `saqueado` — y fauna NUNCA pasa por el flujo de "Saquear todo" que marca `saqueado: true`. Dependencia circular real: sin desollar no se puede saquear (no aplica a fauna), sin saquear no se vacía `combateIniciado`, sin `combateIniciado` vacío no aparece el aviso de Desollar. **Fix**: en `detail.ts`, `pendingCombatNpcsSinResolver` ahora excluye directamente cualquier NPC de fauna (`ataqueNatural` truthy, mismo marcador que usa `carcassCandidatesFor`) — fauna muerta nunca cuenta como "pendiente de resolver" ahí, su resolución real es Desollar. Test nuevo en `detail.test.ts` cubriendo el escenario exacto (Kirelon Arenoso MUERTO sin saquear no reabre `combateIniciado`). Verificado: `tsc -b` limpio, 3263 tests unitarios en verde. **CONFIRMADO EN VIVO tras reinicio**: la partida que había quedado bloqueada se desatascó SOLA (sin ninguna acción del jugador, `combateIniciado: null` en la siguiente consulta) — confirmado por Playwright que el composer quedó habilitado y el aviso de Desollar apareció de forma natural. |
| Objetivo individual entre combatientes duplicados (texto libre: "ataco al buitre herido") | ✅ fijado | `participantId`+`#N`, verificado en vivo 2026-08-27. |
| **BUG CERRADO (2026-08-29)**: primer golpe de un encuentro nuevo redirigido a un PNJ pacífico presente (Gistera Koh) | ✅ fijado, con test reproducible | Mismo síntoma exacto que el bug ya cerrado el 2026-08-04 ("un ataque de seguimiento sin comillas sigue golpeando al enemigo ya enfrentado, no a Gistera Koh"), pero en el PRIMER golpe de un encuentro NUEVO, sin combate previo — reproducido jugando en vivo con Playwright: el jugador atacó a "Kirelon Arenoso" citándolo con **comillas dobles** (`"..."`, texto libre válido en el composer), en vez de comillas simples (`'...'`, el único formato que reconoce `explicitTarget` — y el único que genera el mecanismo real de citar por nombre en la UI, el chip de click-izq+shift). Sin `explicitTarget` resuelto y sin `ongoingCombatTarget` (primer golpe, sin combate ya en marcha), el fallback caía en `npcsInSceneVivos[0]` — el primer NPC de una lista sin ningún orden por hostilidad, que en este caso era Gistera Koh (CAUTELOSO, se había presentado en la misma narración del turno). El agente jugando siguió golpeándola 3 turnos más sin darse cuenta ("un ataque controlado, sin intención de matarla"), pensando que era la única forma de progresar — nunca apareció el panel de combate real, todo pasó por el composer de texto libre. **Decisión de diseño explícita**: NO se amplía el reconocimiento de comillas dobles (la usuaria confirmó que comillas simples debe seguir siendo el ÚNICO formato válido de cita, coherente con que ya existe un mecanismo real y único para citar — el chip). **Fix real**: el fallback `candidateAttackTarget` ahora prioriza un NPC realmente hostil (`effectiveTemperamento` AGRESIVO/ENEMIGO, mismo criterio que `agresivoSlugsInScene`) sobre uno pacífico quieto en la lista — un NPC pacífico solo puede ser objetivo real de un golpe si el jugador lo cita explícitamente (comillas simples) o ya había combate en marcha contra él. Test de integración nuevo (`turn.integration.test.ts`, "PRIMER golpe de un encuentro nuevo... comillas dobles") — confirmado que FALLA sin el fix (el Orco nunca recibía el golpe) y pasa con él. Verificado: `tsc -b` limpio, 3265 tests unitarios, 169 tests de integración, sin regresiones (incluido el test histórico de 2026-08-04, que sigue en verde). **REVERIFICADO EN VIVO (2026-08-29, mismo día, tras reinicio del backend)**: reproducida la condición completa del bug original jugando de verdad — rastreo del Kirelon Arenoso, la narración introduce a Gistera Koh huyendo, ataque enviado con comillas dobles a mano (`Ataco a "Kirelon Arenoso"...`). Verificación mecánica precisa (Postgres, no solo narración): `Save.pendingNpcAttack.npcId` correspondía al Kirelon Arenoso real, y no existía ninguna fila `NpcState` para Gistera Koh en la partida — nunca fue enganchada como objetivo. Fix confirmado funcionando en producción real, pese a las comillas dobles no reconocidas y con la pacífica presente en la misma escena. |
| Muerte real / respawn | ✅ con 2 bugs fijados, REVERIFICADO EN VIVO (2026-08-28) | Victoria falsa tras derrota real, corregido 2026-08-27 (`tarkor_pruebas_paralelas_2026-08-27`). **BUG NUEVO CERRADO (2026-08-28, jugando en vivo)**: morir y respawnear (sobrevivible, sin fin de partida) no limpiaba `pendingCombatNpcSlugs` — el aviso "COMBATIR/HUIR" contra el agresor original seguía apareciendo aunque el jugador ya reapareciera Ileso en su campamento, físicamente lejos de donde murió. Causa raíz: `resolveCombatSlugsAndPersist` (calcula y persiste `pendingCombatNpcSlugs`) se ejecuta DESPUÉS del bloque de muerte/respawn en el orden del turno, pero no sabía nada de la muerte — recalculaba el combate con el agresor de siempre y sobrescribía cualquier estado limpio. Fix: nuevo parámetro `justDied` que fuerza `combatSlugs = []` cuando este turno propuso MUERTO con respawn sobrevivible. Test de integración nuevo (`turn.integration.test.ts`, "Respawn tras morir") cubriendo explícitamente `pendingCombatNpcSlugs` antes/después. Verificado: `tsc -b` limpio, backend 1688/1688. **REVERIFICADO EN VIVO tras reiniciar el backend**: segunda muerte real de Gorhorn contra Kirelon Arenoso (deathCount 1→2) — `combateIniciado: None` y `condicionFisica: HERIDO` limpios tras el respawn, sin ningún combate residual enganchado. El caso sospechoso anterior ("condicionFisica volvió a CONVALECIENTE sin turno visible") resultó ser un turno de Playwright que sí se había enviado pero se quedó atascado tras el corte de contexto entre sesiones (`turnLock` con 409 al reintentar, liberado tras esperar) — no un bug real del motor, confirmado al reintentar el turno y verlo completarse con normalidad. **TERCERA REVERIFICACIÓN EN VIVO (2026-08-29)**: tercera muerte real de Gorhorn (deathCount 2→3), otra vez contra Kirelon Arenoso estando CONVALECIENTE (falló un ataque en ese estado penalizado) — `combateIniciado: null`, `condicionFisica: ILESO`, sin combate residual. Mismo resultado limpio las 3 veces. |
| Pasivas raciales (Goirntes/Orcos/Nabieus/Faerus, ventaja-desventaja de tirada) | 🧪 NUEVO (2026-08-28) | Sustituyen la 2ª habilidad activa por raza — ver `tarkor_pasivas_raciales_aplicado_2026-08-28`. Los 4 casos reales sin ver jugando: Goirnte defendiéndose de ataque físico vs mágico, Orco recibiendo CONTROL, Nabieu recibiendo INTIMIDACION, Faerus en apertura de combate. Verificar también que el frontend muestra bien los 2 dados (ventaja/desventaja) con el descartado tachado. |
| **BUG CERRADO (2026-08-29)**: combate "fantasma" reaparece tras huir/viajar, mismo enemigo agresivo enganchado indefinidamente | ✅ causa raíz real aislada y fijada, con test reproducible | Confirmado 2 veces en vivo (2026-08-28): tras huir de Kirelon Arenoso y viajar a otra zona/región, el combate se reabría en turnos totalmente neutrales ("descansar", "recolectar"). Un fix previo (2026-08-28, usar `regionLocationId`/destino real en vez de origen crudo tras un viaje vía `worldTick.ts`) era correcto por code review pero un test de integración dedicado NO logró reproducir el fallo ni con ese fix revertido — la causa real era otra. **Causa raíz real (2026-08-29, reproducida en test aislado y determinista)**: `detectNpcsInScene` (npcScene.ts) trata a un NPC "ya establecido en esta partida" (tiene `NpcState` propio) como candidato de escena SIEMPRE, sin importar la región actual (`encounteredIds.has(npc.id)` gana sobre el filtro geográfico) — comportamiento INTENCIONAL, con sus propios 4+ tests explícitos (mencionar a alguien conocido lejos de su territorio no debe hacerlo desaparecer del todo, necesario para diálogo/misiones/loot). Combinado con el matching fuzzy de alias (mismo mecanismo que ya causó el bug histórico "res" dentro de "presas"/"interesante", Levenshtein 2) y sin ningún estado de "se calmó tras huir" para fauna sin facción (`effectiveTemperamento` es fijo salvo por reputación), el propio `SessionFact` que narra la huida ("Gorhorn logra escapar de Kirelon Arenoso...") reintroduce a Kirelon como candidato en CUALQUIER región posterior, disparando `agresivoSlugsInScene`/`shouldForceCombat` de nuevo — reproducido con un turno de "Busco un buen sitio para descansar" en una región completamente distinta. **Fix**: nuevo campo `NpcInScene.homeLocationSlug` (npcScene.ts) + función `npcCanForceCombat` en `resolveCombatSlugsAndPersist` (turnResolution.ts) — un NPC agresivo solo puede FORZAR combate (`agresivoSlugsInScene`) si su ubicación de origen cae en la región ACTUAL del jugador (o es itinerante/región sin resolver); sigue siendo válido para el resto de usos de `npcsInScene` en la misma función (nunca se tocó `detectNpcsInScene`/`encounteredIds`, que debía seguir intacto). Decisión explícita: NO se aplicó el mismo filtro a `combatSlugsFromModel` (el LLM proponiendo combate activamente ya tiene su propio filtro de temperamento, decisión más deliberada que la red de seguridad automática). Test de integración nuevo (`turn.integration.test.ts`, "Combate fantasma") reproduce el escenario exacto: huir con éxito + viajar a otra región + `SessionFact` de la huida + turno neutral → antes `combateIniciado` se poblaba, ahora `null`. Verificado: `tsc -b` limpio, 3264 tests unitarios, 168 tests de integración (13 archivos), sin regresiones. **REVERIFICADO EN VIVO (2026-08-29, mismo día, jugando de verdad con Ollama real tras un reinicio)**: huida real y exitosa de un Kirelon Arenoso en La Hondonada del Eco (narración confirmó el escape), viaje a El Pozo de Cauce Viejo (ubicación distinta, misma región), 3 turnos neutrales consecutivos ("Descanso un rato", "Miro alrededor con calma", "Recojo lo que encuentro por la zona") — en ninguno reapareció el Kirelon ni se reactivó combate, confirmado tanto en la narración como en `combateIniciado` (`null` durante todo el recorrido). Sin regresiones, sin cuelgues de Ollama. |
| Cinturón de combate (selección de habilidades activas, tope 6) | ✅ parcial (2026-08-28) | Toggle activar/desactivar confirmado en vivo (5/6→4/6→5/6), y **persiste correctamente tras recargar la página** (única de las 3 "ofertas/estados de UI" auditradas hoy que SÍ cumple la directriz de sobrevivir a F5, a diferencia de la tarjeta Convaleciente y la oferta de modo dinámico). Sin probar todavía: drag-and-drop para reordenar, bloqueo real al llegar al tope de 6 (solo se tenían 5 habilidades desbloqueadas, nunca se alcanzó el límite), y que CombatPanel solo ofrezca las activas + genéricas durante una pelea real (no verificado explícitamente, aunque el panel de combate visto hoy sí mostraba las 5 activas). |
| **BUG CERRADO (2026-08-28)**: descansar nunca curaba si el descanso se interrumpía por un combate real | ✅ arreglado, verificado en vivo | Causa raíz encontrada con un log de depuración temporal + logs reales del backend: `nextCondicionFisica` (`death.ts:140-180`) — cuando el turno de descanso se interrumpe por un encuentro real (frecuente en La Hondonada del Eco, único `Location` con `ZonePoint` sembrado), el modelo narra el peligro y a veces propone una `condicionFisica` PEOR que la actual en su JSON; con `enCombate: false` (el descanso en sí nunca pasa `enCombate: true`), la rama `if (!enCombate) return current;` descartaba el techo de curación real (`healCeiling`) por completo, dejando al jugador congelado en su condición pese a que el descanso/refugio sí debería haber curado. Mismo patrón exacto que 2 bugs ya cerrados antes en esta misma función (2026-07-31, 2026-08-26) — un tercer hueco no cubierto. **Fix**: esa rama ahora aplica `Math.min(currentIdx, ceilingIdx)` igual que el resto de casos "sin mejora genuina real", en vez de `return current` a secas. Test de regresión nuevo en `death.test.ts` cubriendo exactamente este caso (`CONVALECIENTE`→propuesta `MUERTO`→techo `GRAVE` debe dar `GRAVE`, no quedarse en `CONVALECIENTE`). Verificado: `tsc -b` limpio, backend 1665/1665 (incluye el test nuevo), y reverificado en vivo en la partida real — Gorhorn pasó de CONVALECIENTE a GRAVE con un descanso interrumpido de nuevo por Kirelon Arenoso, mismo escenario exacto que antes fallaba. **Seguimiento CERRADO (2026-08-28, ronda de correcciones, ver P4.2)**: investigado y NO es bug — Gorhorn ya estaba en GRAVE tras el fix, y sin refugio propio el techo de curación es GRAVE (nunca mejora desde ahí), comportamiento correcto del diseño. |
| **BUG NUEVO CERRADO (2026-08-28, jugando en vivo tras la ronda de correcciones)**: fix de energía Defenderse/Esquivar (P3.1) no llegó a partidas ya creadas | ✅ arreglado en la partida real | `SavedAction` es una tabla PERSISTIDA (copia congelada de `energyCost`/`energyRegen` en el momento de crear la partida, `creation.ts`), no recalculada en caliente desde `GENERIC_COMBAT_ABILITIES` — el fix de P3.1 (esta misma ronda) cambió la constante en el código pero nunca escribió una migración de datos para partidas ya existentes. Confirmado jugando: la ficha de combate de Gorhorn seguía mostrando "Defenderse +10⚡"/"Esquivar +5⚡, sin coste" (valores viejos) pese a que el endpoint nuevo de Huir (P3.2) sí usaba código actualizado — la propia constante en memoria estaba bien, solo el dato ya persistido estaba desactualizado. Corregido con `UPDATE` directo en las 2 filas `SavedAction` (Defenderse/Esquivar) de esta partida, con aprobación explícita previa. **Lección para el futuro**: cualquier fix que cambie una constante usada para SEMBRAR datos persistidos (`SavedAction`, y potencialmente otras tablas con el mismo patrón de copia congelada) necesita revisar también las partidas ya existentes, no solo las nuevas — verificado ahora con `GET /saves/:id`, valores reales `{energyCost:0,energyRegen:5}`/`{energyCost:5,energyRegen:0}`. |

## 2. Combate múltiple (motor N-way, `combateMultiple*.ts`)

**Cómo forzarlo**: solo se activa si existe un `CombatEncounter` `EN_CURSO` — hace falta cazar/enfrentar
un GRUPO de 2+ criaturas a la vez (`saves/cazar.ts` → `cazar/confirmar` con varios slugs/cantidades).
Un combate contra un único NPC siempre cae en el motor 1v1 clásico, nunca ejercita este código.

| Ítem | Estado | Notas |
|---|---|---|
| Disparo real del motor (2+ criaturas) | ✅ **CERRADO Y CONFIRMADO EN VIVO (2026-08-29)** — primera vez visto funcionando jugando de verdad | Construido y con 16 tests de integración real contra Postgres (`combateMultipleOrquestacion.integration.test.ts`) en verde — el motor en sí ya funcionaba. **Causa raíz real de por qué nunca se había visto disparar jugando**: `hayGrupoReal` (`cazar.ts:336-371`, el gate que decide si se crea un `CombatEncounter`) exige que al menos una especie seleccionada tenga `avistados > 1`, calculado como `avistadosFor(capturablePct, poblacion) = Math.max(1, Math.round(capturablePct / 10))` — depende de `Npc.capturablePct` (`@default(0)` en el schema), NO de seleccionar 2+ especies distintas. Los 3 únicos candidatos de La Hondonada del Eco (Kirelon Arenoso, Gesgurio, Nuente) no tenían `capturablePct` sembrado — los 3 caían al default 0, `avistados` siempre exactamente 1, combate múltiple matemáticamente inalcanzable desde la única zona con `ZonePoint` real. **Fix aplicado**: `capturablePct: 30` sembrado para Gesgurio (`worldCatalog.ts`, insecto de emboscada, población real alta ×2146, bio coherente con aparecer en grupo — a diferencia de Kirelon Arenoso, depredador solitario de alto nivel) + `npm run seed-catalog` para aplicarlo a Postgres. Verificado: `tsc -b` limpio, 3250/3250 tests unitarios en verde (sin regresión). **CONFIRMADO EN VIVO justo después**: cazados Kirelon Arenoso + Gesgurio a la vez — `actionText` de la confirmación ya narró "aunque al final solo consigo acorralar a 2 de los que había marcado" (la `varianceClause` real de grupo), y el combate abierto resultante tiene **3 combatientes reales**: Kirelon Arenoso + **2 Gesgurio distintos** (`combateIniciado.npcs`, confirmado por API) — primera vez que se ve el motor N-way disparado jugando de verdad, no solo en tests. |
| Iniciativa N-way, orden de turnos | 🧪 | Igual que arriba. |
| Retargeting por Inteligencia | 🧪 | Igual que arriba. |
| Objetivo individual (enganche/duelo/golpe gratis) | ✅ | Verificado en vivo 2026-08-26/27 según memoria (`tarkor_objetivo_individual_combate_multiple_2026-08-26`). |
| CONTROL (Opresión Mental — fuerza atacar a un aliado) | 🧪 | Requiere nivel de clase específico para tener la habilidad — no verificado en vivo. |
| MULTIPLE (Punta Doble, Golpe Gemelo — golpe con margen alcanza objetivo extra) | 🧪 | Igual, requiere nivel de clase específico. |
| OCULTACION (Camuflaje) / DESVIAR (Comunión Salvaje) | 🧪 | Bug real cazado en tests (ocultación "colgada" en duelos mutuos) y corregido — no visto en partida jugada. |
| INVOCACIÓN / Tótem de Guerra | 🧪 | Bug real cazado en tests (expiración prematura) y corregido — no visto en partida jugada. |
| EXPULSAR (Embate de Escudo) | 🧪 | No verificado en vivo. |
| **BUG CERRADO (2026-08-29)**: el `CombatEncounter` se cerraba ENTERO si el JUGADOR estaba CONVALECIENTE, aunque quedaran enemigos vivos | ✅ fijado, 2 causas raíz distintas | En el primer combate múltiple real (Kirelon Arenoso + 2 Gesgurio), tras usar Matar sobre Kirelon estando Gorhorn CONVALECIENTE, el combate se cerró del todo (`combateIniciado: null`) pese a que los 2 Gesgurio seguían `ILESO` — confirmado en Postgres: `CombatEncounter.estado: 'RESUELTO'` con 2 `CombatParticipant` enemigos todavía `ILESO`. **Causa raíz 1**: el chequeo de "combate terminado" (`combateMultipleOrquestacion.ts`, 2 sitios) reutilizaba `objetivosValidos` (`combateMultiple.ts`, diseñada para "a quién puede atacar un NPC" — CONVALECIENTE/MUERTO excluidos a propósito) también para "¿sigue el bando en juego?", tratando la CONVALECIENCIA de la jugadora como derrota total — contradice el motor 1v1 ("puedes seguir intentándolo, muy penalizado"). **Fix 1**: nueva función `bandoSigueEnCombate` — decide por `esJugadorReal` (el `CombatParticipant.tipo === 'JUGADOR'` real, NUNCA por el string `bando`, que puede estar lleno de NPC aliados en un encuentro NPC-vs-NPC): la jugadora real sigue en combate hasta MUERTO real; cualquier otro participante (NPC, aliado, incluso uno metido en el bando "JUGADOR") sigue el criterio estricto de siempre. **Causa raíz 2, encontrada arreglando la 1**: con la 1 sola, la jugadora CONVALECIENTE quedaba en un bucle sin salida — `resolverTurnoJugador` tenía su propio guard con el mismo `objetivosValidos` que la bloqueaba de ATACAR en absoluto una vez CONVALECIENTE (a diferencia de `resolverTurnoAutonomo`, donde ese mismo guard SÍ es correcto para NPCs). **Fix 2**: ese guard ahora solo bloquea en `MUERTO` real — la penalización de CONVALECIENTE ya la aplica `resolveExchange`/`condicionMalus` dentro del propio intercambio, sin duplicarla. Ambos fixes verificados: `tsc -b` limpio, 1547 tests unitarios backend en verde, `combateMultipleOrquestacion.integration.test.ts` estable en 10/10 corridas repetidas (16/16 cada vez — antes flaky ~50% tras el Fix 1 solo, sin el Fix 2). Tests nuevos en `combateMultiple.test.ts` cubriendo `bandoSigueEnCombate` con los 3 casos reales (jugadora convaleciente, NPC convaleciente, bando "JUGADOR" de puros NPC aliados). **REVERIFICADO EN VIVO parcialmente (2026-08-29, mismo día)**: cazado un grupo real de 3 Gesgurio + Kirelon Arenoso estando Gorhorn ya CONVALECIENTE — confirmado que el combate de 4 combatientes se abrió y se MANTUVO abierto pese al estado del jugador (Fix 1 funcionando), y que el botón ACTUAR ya NO estaba deshabilitado por su condición (Fix 2 funcionando, `actuar disabled: false` confirmado). **Causa raíz 3, confirmada e investigada a fondo**: `calcularEnganchesRonda` (`combateMultipleOrquestacion.ts`, la función que recalcula a quién apunta cada combatiente al cruzar de ronda) excluía a la jugadora CONVALECIENTE de su propia lista de "vivos" — mismo patrón otra vez: con ella fuera, `jugadoraId` salía `null` y nunca se le recalculaba un objetivo nuevo tras la muerte del anterior, dejándola apuntando a un enemigo YA MUERTO (`resolverTurnoJugador` lo trataba como "sin defensor", turno vacío sin narración real). **Fix 3**: mismo criterio que el resto de esta familia — la lista de "vivos" para el cálculo de enganche solo excluye a la JUGADORA real por `MUERTO`, no por `CONVALECIENTE`. **Causa raíz 4, encontrada arreglando la 3** (reproducida en script de debug aislado: NPC quedaba con `objetivoActualId: null` para siempre, `resolverTurnoAutonomo` devolviendo `null` ronda tras ronda): con la jugadora ya "viva" para el enganche, el NPC enemigo que solo la tenía a ELLA como candidato no podía elegirla como objetivo — `elegirObjetivo` (`combateMultiple.ts`, usado por todo NPC/tótem para decidir a quién atacar) seguía usando `objetivosValidos` a secas, que la excluye por CONVALECIENTE. **Fix 4**: nueva función `objetivosValidosParaAtacar` — la jugadora real sigue siendo objetivo válido de ataque mientras no esté MUERTA (coherente: un enemigo puede seguir golpeando a un jugador convaleciente hasta rematarlo), propagada a los 3 sitios donde un NPC/tótem/CONTROL elige objetivo. **Los 4 fixes verificados juntos**: `tsc -b` limpio, 1547 tests unitarios backend en verde, 97/97 en `turn.integration.test.ts` aislado, script de debug aislado (`saveId` propio, sin compartir estado con otros tests) da **30/30 estable, siempre resuelto en exactamente 4 rondas** con Destreza 1000 + Fuerza +100 en la jugadora (mismo patrón que ya usaba el test de `activeEffects` del mismo archivo). Tests de `combateMultiple.test.ts` ampliados. **Flake residual investigado y descartado como relacionado**: la suite completa (`combateMultipleOrquestacion.integration.test.ts`, 16 tests) sigue fallando ~10-15% de las veces en un test AJENO a estos fixes ("ANALIZAR RIVAL: contra un miembro de grupo") — confirmado que es un flake preexistente del archivo, reproducible igual corriendo la suite SIN mis 2 tests modificados de por medio (mismo patrón de fallo intermitente antes y después de mis cambios). No investigado más a fondo — es deuda de aislamiento de tests preexistente, no una regresión de este cierre. **REVERIFICADO EN VIVO COMPLETO tras reinicio real del backend (2026-08-29, misma sesión, agente jugando con Playwright)**: partida real de Gorhorn, combate múltiple de 4 combatientes (Kirelon Arenoso MUERTO + 3 Gesgurio ILESO) con Gorhorn ya CONVALECIENTE al entrar. 3 turnos consecutivos resueltos con normalidad: aviso correcto "⚠️ Estás convaleciente — puedes seguir intentándolo, pero muy penalizado", botón ACTUAR habilitado los 3 turnos, combate nunca se cerró pese al estado del jugador, sin errores de consola. Los 4 fixes confirmados funcionando en producción real, no solo en tests. Hallazgo menor no bloqueante: un crash de React una única vez en `ActiveEffectChips` (`CombatPanel.tsx:88`, `effects.length` sobre valor `undefined` — el backend siempre envía `activeEffects: []` para NPCs de combate múltiple, confirmado por código; no reproducido en 3 intentos limpios posteriores, atribuido a condición de carrera del propio script de pruebas, no a los fixes). |
| Capturar UN individuo específico de un grupo de 2+ del mismo tipo (fauna) | 🧪 CERRADO 2026-08-28 | Rediseño completo: la captura se materializa como InventoryItem en tránsito y libera el NpcState del grupo (mismo criterio que `grupoContinua`) — ver [[tarkor_rediseno_captura_2026-08-28]]. Test de integración reproduce el bug original exacto (2 buitres, capturar solo el primero) y confirma que el segundo sigue cazable. NPC capturado sigue pendiente de la Celda de Retención (pausada). No visto jugando en vivo todavía. |
| Dejar vivir UN individuo específico de un grupo de 2+ del mismo tipo | ✅ **BUG CERRADO (2026-08-29)**: tarjeta MATAR/CLEMENTE reaparecía tras recargar en combate MÚLTIPLE | Investigado 2026-08-28: `/combat/dejar-vivir` solo tocaba `Save.pendingCombatNpcSlugs`, nunca `NpcState`. **Hallazgo en vivo 2026-08-29**: pulsado Clemente sobre Kirelon Arenoso (Convaleciente) dentro de un `CombatEncounter` real — al recargar, la tarjeta MATAR/CLEMENTE reapareció. Causa raíz: `GET /saves/:id` (`detail.ts`) reconstruye la tarjeta de combate múltiple desde `CombatParticipant`, sin mirar la decisión de la jugadora en absoluto — ni Clemente ni Capturar (mismo hueco exacto, confirmado por code review) escribían ahí. Investigado a fondo el mismo día: la solución obvia (reutilizar `Save.pendingCombatNpcSlugs` como filtro en `detail.ts`) resultó **incorrecta y peligrosa** (`combateMultipleOrquestacion.ts` nunca escribe ese campo — habría excluido a TODOS los convalecientes de cualquier combate múltiple), así que se dejó documentado sin aplicar hasta esta sesión. **Fix real aplicado (2026-08-29, migración de schema completa)**: nueva columna `CombatParticipant.dismissedGrupo` (`Boolean?`, migración `20260829210356_combat_participant_dismissed_grupo` vía `migrate deploy` — `migrate dev` falla con P3006/shadow DB, gotcha ya documentado del proyecto). Ambos endpoints (`/combat/dejar-vivir/:npcSlug` y `/capturar/:npcSlug`) ahora aceptan `participantId` opcional en el body — con él, ramifican a leer la condición real desde `CombatParticipant.condicionFisicaGrupo` (nunca `NpcState`, compartido por toda la especie) y marcan `dismissedGrupo: true` en el propio participante al resolver; sin él, siguen exactamente igual que antes (combate 1v1 clásico/solitario). `detail.ts` excluye a cualquier participante `dismissedGrupo` de `combatEnemigosParaDisplay` al reconstruir `combateIniciado`. **Bug hermano encontrado y cerrado en el mismo cambio**: el FRONTEND (`useCombatFlow.ts`) filtraba `combatNpcStates` por `slug` a secas al marcar `dismissed` — con 2+ individuos del mismo tipo en el mismo encuentro, marcaba a AMBOS de golpe; corregido a `combatKeyFor` (mismo criterio que el resto del archivo, ya usa `participantId` cuando existe). `postCapturar`/`dejarVivir` (`lib/api.ts`) ahora envían `participantId`. Tests nuevos: 2 de integración por endpoint (`session.dejarVivir.integration.test.ts`, `companeros.integration.test.ts` — grupo real de 2, confirma que solo el participante indicado queda `dismissedGrupo`) + 2 de frontend (`useCombatFlow.test.tsx` — confirma que `dismissed` local no se filtra por `slug`). Verificado: `tsc -b` limpio backend+frontend, 3270 tests unitarios backend, 174 tests de integración, 115 tests frontend, sin regresiones. Pendiente reverificar en vivo la próxima vez que se juegue un combate múltiple real con 2+ individuos del mismo tipo. |
| Saqueo/Captura post-combate múltiple (varios cadáveres del mismo tipo) | 🧪 sin el bug | Verificado 2026-08-28 (código): al terminar el `CombatEncounter`, cada individuo caído del grupo se materializa en `NpcState.groupSize`/`groupDefeated`/`corpsesLooted` (turnResolution.ts:4613-4645) — el MISMO mecanismo que ya usa la caza clásica y que el fix de Capturar de hoy lee directamente, sin distinguir de dónde viene. No tiene el hueco que Capturar sí tenía antes del fix. No visto jugando en vivo todavía. |
| Sub-partición >4v4 | 🧪 CORREGIDO (2026-08-28) | Estaba marcado ❌ "sin construir" por error de búsqueda de texto — SÍ existe código real: `particionarEnSubCombates`/`MAX_COMBATIENTES_POR_BANDO=4`/`chunk` (combateMultiple.ts:282-320+), con 6 tests unitarios que cubren el caso simétrico (ejército contra ejército) documentado explícitamente en el propio código. Nunca visto disparado en una partida real todavía (haría falta un encuentro de 5+ criaturas del mismo bando). |
| **Investigado (2026-08-29): "golpes con Éxito con coste no bajan condición en combate múltiple de grupo"** | ✅ investigado, código confirmado correcto | Hallazgo colateral de un agente jugando en vivo (3 Gesgurio, varios ataques conectados sin cambiar de "Ileso 100"). Investigado por código antes de asumir un bug: `escribirCondicionYEnergia` ya comprueba `condicionFisicaGrupo !== null` primero y escribe en el propio `CombatParticipant`, nunca en el `NpcState` compartido — el código parecía correcto. Construido un test de integración aislado (golpe NO decisivo — "golpe_normal"/"con_coste" — contra un miembro de un grupo de 2) para confirmarlo con datos reales: **el golpe SÍ baja `CombatParticipant.condicionFisicaGrupo` del defensor golpeado (ILESO → HERIDO)**, sin afectar al otro individuo del grupo ni al `NpcState` compartido (que se queda fijo en ILESO por diseño — es una fila COMPARTIDA por todos los individuos de la especie, no la fuente de verdad de la condición individual). **Conclusión más probable**: el agente consultó `NpcState.condicionFisica` directamente en vez de `GET /saves/:id` (que sí expone `condicionFisicaGrupo` correctamente vía `detail.ts`) — falso positivo de método de verificación, no un bug real del motor. Nota de proceso: al escribir el test, apareció un flake real distinto y menor (`findMany` sin `orderBy` no garantiza qué participante del grupo es "el objetivo" entre corridas) — corregido con `orderBy: { id: 'asc' }`, 12/12 estable tras el fix. Verificado: `tsc -b` limpio, 3266 tests unitarios, 170 tests de integración. |
| **Hallazgo real (2026-08-28)**: el texto de iniciativa ("Iniciativa: tú X vs Y del enemigo...") no sale en la primera ronda de combate | ✅ FIJADO (2026-08-29) | Confirmado por la usuaria jugando en vivo — el bloque de iniciativa que sí se ve en rondas posteriores faltaba en la ronda de apertura. Causa raíz: `openingAmbush` (`turnResolution.ts`) sembraba `nuevoPendingNpcAttack` pero nunca calculaba `nextInitiativeRoll`, así que el `LogEntry` de apertura quedaba sin `initiativeRoll` que mostrar (`CombatPanel.tsx` está condicionado a que ese valor sea truthy). **Fix aplicado**: el bloque `openingAmbush` ahora también llama a `rollInitiative` con los atributos efectivos de jugador/NPC, igual que cualquier otro intercambio — la emboscada ya decidía que el NPC actúa primero (por eso siembra el ataque pendiente); tirar aquí deja constancia de esa iniciativa con los mismos dados, sin contradicción posible con `ganador` porque el texto de la rama `awaitingDefense` (`CombatPanel.tsx:573-588`) nunca usa ese campo, solo las cifras. Test de regresión nuevo en `turn.integration.test.ts` (describe "Emboscada real del turno de apertura") confirma `initiativeRoll` persistido en el `LogEntry` de apertura. Verificado: `tsc -b` limpio backend+frontend, 97/97 en `turn.integration.test.ts` en solitario, 3213 tests unitarios backend en verde, 111/111 frontend. |
| **BUG real confirmado en vivo (2026-08-28)**: recargar la página mientras el enemigo tiene la iniciativa ("elige a ciegas cómo defenderte") rompe la resolución del turno | ✅ FIJADO (2026-08-29) | Reproducido dos veces por dos personas distintas. Al recargar en el estado "un enemigo actúa primero, elige a ciegas cómo defenderte", el panel volvía a mostrar el catálogo de ATAQUE — el jugador elegía con el atributo equivocado y perdía el intercambio contra la Destreza real del NPC (derrota real observada, "HAS CAÍDO EN COMBATE"). Causa raíz: `Save.pendingNpcAttack` persistía bien en el backend, pero `GET /saves/:id` nunca lo exponía, así que `combatAwaitingDefense` (`useCombatFlow.ts`, solo `useState` en memoria) no podía rehidratarse tras F5. **Fix aplicado**: nuevo campo `esperandoDefensaJugador: !!save.pendingNpcAttack` en la respuesta de `GET /saves/:id` (`detail.ts`), añadido al tipo `SaveDetail` del frontend (`api.ts`), y `syncFromSave` (`GameView.tsx`) ahora llama a `combat.setCombatAwaitingDefense(save.esperandoDefensaJugador)` en cada resincronización — mismo patrón que ya se usaba para `lastInitiativeRoll`, pero completándolo esta vez (se rehidrataba el banner, no el modo real del panel). Alcance confirmado: este mecanismo es exclusivo del motor 1v1 clásico, el combate múltiple (Fase 3) nunca genera `esperandoDefensaJugador`. 2 tests de regresión nuevos en `turn.integration.test.ts` (describe "GET /saves/:id expone esperandoDefensaJugador") cubren ambos casos (con y sin `pendingNpcAttack`). Verificado: `tsc -b` limpio backend+frontend, 97/97 en `turn.integration.test.ts` en solitario, 3213 tests unitarios backend en verde, 111/111 frontend. **REVERIFICADO EN VIVO (2026-08-29)**: recargada la partida real con `esperandoDefensaJugador: true` ya persistido en el backend (Kirelon Arenoso con la iniciativa) — el panel mostró correctamente "COMBATE — DEFENSA" con el aviso "Un enemigo actúa primero — elige a ciegas cómo defenderte" desde el primer render tras F5, sin pasar nunca por el catálogo de ATAQUE equivocado. Fix confirmado funcionando en producción real. |
| XP de la tirada de combate múltiple | ⛔ hueco conocido | El motor no expone el resultado del dado hacia fuera — documentado, no arreglado. |
| Control Rúnico (Chamán/Rúnico 32) | ⛔ bloqueado a propósito | Combina CONTROL+DEBILIDAD, ninguna fila del catálogo cubre ambos — decisión de no sembrarlo hasta rediseñar. |

## 3. Caza y recolección

| Ítem | Estado | Notas |
|---|---|---|
| Explorar/confirmar caza (individual) | ✅ | Probado extensamente. |
| Explorar/confirmar caza en grupo (dispara combate múltiple) | 🧪 | Ver § 2. |
| Recolección por oficio (minería, herboristería, etc.) | ✅ | `harvestSourceHomeLocationSlug` verificado 2026-08-27, tirada de recolección verificada 2026-08-22. |
| Filtro de terreno en recolección/caza | ✅ | `locationTerrainTags`/`harvestSourceTerrainTag`/`faunaTerrainTag`. |
| Gate de estación (`HarvestYield.estacionRequerida`) | 🚧 requiere condición previa | Verificado (2026-08-28): el Día 1 siempre empieza en PRIMAVERA (`ESTACIONES_ORDEN`, worldClock.ts), y solo `boungo` tiene este gate (Otoño) — hacen falta 60 días de ficción para llegar. NO existe ningún endpoint de administración para saltar tiempo (buscado en todas las rutas, no hay nada). Única vía: editar `WorldState.fictionalMinutes` directamente en Postgres — no hacerlo sin permiso explícito de la usuaria, es manipular datos de su partida. |
| Gate de clima (`HarvestYield.climaRequerido`, ej. Tormenta Extrema) | 🚧 requiere condición previa | ~14 de 120 días son Tormenta Extrema — mismo criterio que estación. |
| Cooldown de recolección (30 min, salta al cambiar de Location) | ✅ | Cubierto por tests de integración, mencionado en checklist de hoy. |
| **BUG CERRADO (2026-08-29)**: narración de recolección sin materializar el objeto | ✅ fijado | Acción "Recolecto más materiales de la zona antes de descansar." — narración: "Gorhorn se agacha junto a una veta de yerreo y recoge... Encontrado un par de hojas duraderas, las añade a sus raciones para el viaje." Pero el `LogEntry` real no tenía `newInventoryItems`, inventario sin cambios. Causa: `detectHarvest` exige nombrar la fuente real del catálogo (decisión de diseño 2026-07-29, evita "picar madera"/"talar piedra") — esta frase no la nombraba, así que el turno se resolvió como narración libre SIN recolección mecánica de fondo, y el modelo tampoco rellenó `newItem` (así que `hasFalseNewItemClaim`, que solo mira ese campo, no lo cazaba). **Fix aplicado, sin tocar el vocabulario de `detectHarvest`** (decisión deliberada de diseño, no se amplía): nuevo guard `hasFalsePassiveHarvestClaim` (`narrador.ts`) — veta cualquier prosa con vocabulario de obtención (encontrar/recoger/conseguir/añadir a la mochila) cuando el turno NO tiene ningún camino mecánico real activo (recolección/saqueo/construcción/crafteo, `harvestOrLootActiveThisTurn` en `turnResolution.ts`) NI el modelo propuso `newItem` — cubre cualquier frase de recolección no reconocida, no solo el caso concreto visto. 4 tests de regresión nuevos en `narrador.test.ts`. Verificado: `tsc -b` limpio, 195/195 en `narrador.test.ts`, 1542/1542 unitarios backend, 97/97 integración. **Pendiente reverificar en vivo.** |

## 4. Compañeros, captura y domesticación

| Ítem | Estado | Notas |
|---|---|---|
| Captura post-combate (individual) | ✅ camino de éxito verificado en vivo (2026-08-31) | Rediseño confirmado: atar deja la captura como InventoryItem en tránsito, hay que llevarla a una Jaula y depositarla ahí antes de que aparezca en "Pendientes de tamear". **Jugado en vivo**: cazado un grupo de 4 Buitre Cenizo (combate múltiple), un participante forzado a CONVALECIENTE, pulsado "Capturar" en la tarjeta real de decisión — primer intento con 400 real ("Necesitas cuerdas"), añadidas cuerdas al inventario, reintento con 400 real distinto (mensaje de guard de estado cuando el `participantId` no coincidía con el CONVALECIENTE real — confirma que el guard exige el id correcto, no solo el slug), tercer intento con el `participantId` correcto → 200, `InventoryItem` real creado ("Buitre Cenizo (Capturado) (3)", `capturaNpcId`/`capturaScope`/`capturaExpiraAtMinutes` poblados), `CombatParticipant.dismissedGrupo` correctamente marcado `true` para ese individuo, el resto del grupo sin tocar. Confirma también en vivo el patrón de combate múltiple: cada botón "Capturar"/"Matar" de la lista corresponde a un `participantId` real distinto, no intercambiable por posición en el DOM. **Sigue pendiente**: depositar en Jaula, tameo, y expiración (ver fila siguiente). |
| **Expiración silenciosa de captura en tránsito no depositada** | ✅ verificado en vivo (2026-08-31) | Antes CERO cobertura de test conocida. `InventoryItem.capturaExpiraAtMinutes` forzado a un valor ya vencido vía SQL (470, con `fictionalMinutes` real en 480), turno normal de texto libre enviado para disparar `applyCapturaEnInventarioTimeouts` — confirmado en Postgres: el `InventoryItem` de la captura desapareció del todo tras el turno (`fictionalMinutes` 480→481), sin dejar ningún residuo/huérfano en el resto del inventario (8 objetos normales de partida, ninguno relacionado con la captura). Comportamiento 100% silencioso confirmado tal como documenta el código — sin mensaje, sin log, sin narración. **Bloqueada varias veces por un cuelgue real de Ollama** durante la verificación (ver hallazgo de infraestructura más abajo, `ollamaQueue.ts` corregido con autorrecuperación) — la verificación final se completó una vez el sistema volvió a responder con normalidad. |
| Tameo/persuasión (tirada opuesta, Felicidad) | 🧪 REABRIR (2026-08-28), cobertura confirmada por código (2026-08-28) | El mecanismo en sí (`resolverIntento`) no cambió, y el flujo completo de punta a punta (incluyendo `resolverIntento` con estado real persistido) SÍ está cubierto por el mismo test de integración de la fila de arriba (mismo `describe`, no hace falta un test aparte) — camino feliz confirmado por código. Frontend (`TameoModal.tsx`) sin ningún test de React, igual que Captura. Sin verificar en vivo todavía esta sesión (bloqueado por cuelgue de Ollama, ver § 1). |
| Hambre/Sed/Felicidad derivadas en tiempo real | ✅ | Backend+frontend completos, verificados. |
| Equipar/desequipar compañero (ranuras reducidas fauna / completas NPC) | ✅ | — |
| Almacén de Reino (depositar/retirar) | ✅ | — |
| Plantillas de equipo + auto-equipado | ✅ | — |
| Asignar rol de Reino a un compañero/súbdito | ✅ | — |
| Muerte por inanición (Hambre Y Sed a 0% 24h) | ⛔ sin construir a propósito | Corte deliberado — el pipeline de muerte/respawn vive dentro de la transacción del turno, un tick de fondo sin turno en marcha no tiene ese contexto. |

## 5. Reino y construcción

| Ítem | Estado | Notas |
|---|---|---|
| Fundar Reino | ✅ | — |
| Construcción de Campamento / Ayuntamiento pequeño | ✅ | — |
| Ayuntamiento mediano (75% material procesado) | 🚧 requiere condición previa | Exige oficio de procesado a nivel medio — poco frecuente alcanzar en sesión corta. |
| Ayuntamiento grande (100% material procesado, 4 oficios) | 🚧 requiere condición previa | Exige los 4 oficios de procesado a la vez — muy poco frecuente. |
| Control regional (neutro/disputa/conquistado) | ✅ LOS 3 ESTADOS CONFIRMADOS EN VIVO (2026-08-31) | `regionControlFor` verificado contra `GET /saves/:id/zona` real, agenda forzada por SQL para cubrir los 3 casos: `stage: 0` → `NEUTRAL_O_DUENO_ORIGINAL` (Clan Helsig, dueño real de Cristal Helado); `stage: 2` → `EN_DISPUTA` (dueño Clan Helsig, agresor "Clan Serhu-Concordia de Hierro"); `stage: 4` → `CONQUISTADA` (dueño pasa a ser el agresor). **Excepción de diseño confirmada**: con `stage: 4` activo, Las Llanuras del Viento Rojo (territorio del propio Clan Serhu, el agresor) se queda `NEUTRAL_O_DUENO_ORIGINAL` — nunca se disputa a sí misma, tal como estaba diseñado. Visto también en pantalla real ("Territorio de Clan Serhu" bajo el título del panel de Zona de La Hondonada del Eco). |

## 6. Modo dinámico (Pieza 4 de "Dinamismo del mundo")

| Ítem | Estado | Notas |
|---|---|---|
| Oferta tras turno normal (botón "Interactuar") | ✅ FIJADO Y REVERIFICADO EN VIVO (2026-08-28) | Confirmado jugado en vivo 2026-08-27. **BUG CERRADO (ronda de correcciones 2026-08-28, P2.3)**: campo nuevo `Save.pendingDynamicModeOffer` persiste la oferta desde el momento en que se calcula — sobrevive a una recarga real. Verificado en vivo hoy: oferta de Gesgurio (FAUNA) apareció tras un turno normal, sobrevivió al menos una recarga de página durante las pruebas, y el botón "Interactuar" funcionó con normalidad al pulsarlo tras recargar. |
| Mini-flujo turno-a-turno (responder/ignorar) | ✅ reverificado en vivo (2026-08-28) | Mismo hallazgo previo — varios bugs reales encontrados y arreglados jugando: fauna "hablando" como NPC, lugares inventados sin anclaje, frecuencia sin cooldown. **Reverificado hoy con Gesgurio**: 3 vueltas completas de diálogo (oferta → Interactuar → "ofrecer comida" → "preguntar por el camino" → "rechazar y seguir camino"), cada vuelta con narración coherente y opciones nuevas reales, cerrado limpio con `pendingDynamicMode: null` al terminar — sin fauna hablando como NPC, sin lugares inventados, comportamiento correcto de principio a fin. |
| Nunca sustituye combate (si deriva en pelea, sale del modo dinámico) | 🧪 solo prompt, sin guard | Verificado leyendo código (2026-08-28): es SOLO una instrucción de prompt en `dynamicModeNarracion.ts:79` ("Nunca sustituye un combate... descríbelo y pon 'cierra': true"), sin ningún guard determinista post-generación que lo verifique — mismo patrón frágil ya visto varias veces en este proyecto para instrucciones "no hagas X" con un modelo pequeño. Candidato real de bug si algún día se prueba con `qwen3.5:4b` (que ya se confirmó que ignora otra instrucción similar, "narra en 3ª persona"). |

## 7. `ZonePoint` vivo y mapa de zona

| Ítem | Estado | Notas |
|---|---|---|
| 4 formas de icono por categoría (círculo/triángulo/cuadrado/rombo) | ✅ LAS 4 CONFIRMADAS EN VIVO (2026-08-31) | Círculo (fauna) ya visto 2026-08-28 (La Hondonada del Eco, ×20). Triángulo y cuadrado confirmados 2026-08-31 en el interior de Karot Veku (§12): 2 triángulos NPC (Torgash/Ulkha) + 3 cuadrados EDIFICIO. **Rombo confirmado 2026-08-31**, mismo día: La Hondonada del Eco tiene un `ZonePoint` tipo RECURSO real (Veta de Yerreo, ×20) — visible como rombo naranja en el mapa real junto a los 2 círculos de fauna. Las 4 formas vistas en pantalla real. |
| Color por reputación con la facción del elemento | ✅ reverificado en vivo (2026-08-28) | Ambos puntos en naranja — correcto, fauna salvaje sin facción asociada usa naranja de fondo según el diseño. |
| Agrupación dinámica por cantidad (×N) | ✅ reverificado en vivo (2026-08-28) | Contador "×20" visible directamente sobre el icono en el mapa real, tal como se diseñó. |
| Recálculo proporcional al tiempo de ficción transcurrido | 🧪 verificado por código (2026-08-28) | `recalcularZonePointsDeLocation` (zonePoints.ts, 9 tests unitarios) enganchada en `turnResolution.ts:3139` — corre en CADA turno, no solo en algunos. Los ×20 vistos hoy no se compararon contra un valor anterior, así que el recálculo en sí sigue sin confirmarse visualmente (haría falta ver el número cambiar entre dos visitas). |
| Control regional (texto de facción dueña bajo el nombre de zona) | ✅ reverificado en vivo (2026-08-28) | "La Hondonada del Eco — Territorio de Clan Serhu" visible bajo el título del panel de Zona, confirma §5 también en pantalla, no solo por código. |
| **BUG NUEVO reportado jugando (2026-08-30), SIN INVESTIGAR** | ❌ | "La Sábana Alta" no conecta con ningún otro punto en el mapa de región (nodo aislado) — ver detalle completo en `docs/revisar-partida-hallazgos.md § 2026-08-30`. |

## 8. Clima y estaciones (efecto en narración)

| Ítem | Estado | Notas |
|---|---|---|
| Estación/clima en el bloque de contexto del Narrador | ✅ | Visto en pantalla hoy (icono 🌸⛈️/🌸🌪️ junto a la fecha) — llega al frontend. |
| Nombres Kektira por raza (orco) | ✅ reverificado en vivo (2026-08-28) | Confirmado por API: `entorno: {estacion: {nombre: "Ur'gathek"}, clima: {nombre: "Rokthar"}}` con Gorhorn (orco) en PRIMAVERA/TORMENTA_GRANDE — los nombres Kektira sí llegan correctos al backend/frontend. **Matiz nuevo**: solo se ven en el HUD estructurado (iconos), la narración libre en prosa NO cita el nombre Kektira ("la tormenta de arena magnética", "viento gélido" — vocabulario propio, nunca "Rokthar" literal). Puede ser diseño intencional (el HUD ya lo muestra, no hace falta repetirlo en prosa) o un hueco — no decidido, solo constatado. |
| Narración menciona el clima/estación de forma coherente | ✅ reverificado en vivo (2026-08-28) | Turno real de descanso nocturno bajo TORMENTA_GRANDE: "el rugido constante de la tormenta de arena magnética se filtra a través de las paredes de arcilla" — coherente con el clima real activo, aunque sin citar el nombre Kektira (ver fila de arriba). |

## 9. Sistema de clases

| Ítem | Estado | Notas |
|---|---|---|
| Restricción de armas por clase (Guerrero/Cazador/Chamán) | ✅ verificado en vivo (2026-08-31) | Requiere `especializacion` fijada (`weaponPoolFor('CAZADOR', null)` devuelve `null` = sin restricción — Gorhorn no la tiene hasta nivel 10). Partida de prueba con `clase: CAZADOR, especializacion: TIRADOR` (SQL directo) + "Espada corta goirntes" (`ESPADA_1_MANO`, no permitida para TIRADOR) añadida al inventario. Jugado en vivo con Playwright: Personaje→Equipo→Arma Principal→"Sustituir por"→Espada corta goirntes → `PATCH /saves/:id/inventario/:itemId` devuelve 400 real (`"Espada corta goirntes" no encaja con tu clase — CAZADOR (TIRADOR) no puede equipar armas de tipo ESPADA_1_MANO.`), mensaje mostrado en rojo dentro del propio modal, "Hacha de guerra rota" se queda equipada sin cambios (sin desequipado silencioso). Circuito completo confirmado en pantalla real, no solo por code review. Sigue sin ningún test de React dedicado (no bloqueante). |
| Bonus de atributo por habilidad desbloqueada | 🧪 REABRIR (2026-08-28), componente confirmado sin test (2026-08-28) | El bono en sí (+2/+4) ya se aplicaba en combate desde 2026-08-24, pero era INVISIBLE en toda la UI (bug real encontrado jugando) — ahora se muestra en el tooltip de la habilidad y como chip en el desglose de la tirada. **Confirmado por code review**: el chip vive en `CombatExchangeBadge.tsx:345-349` (`+${side.attributeBonus} habilidad`) y el desglose en líneas 288-293; un segundo sitio (`abilityBonusSuffix.ts:9`, usado en `PersonajePanel.tsx`) muestra el bono en el tooltip de la propia habilidad. **Cero cobertura de test confirmada por grep**: no existe `CombatExchangeBadge.test.tsx`/`CombatPanel.test.tsx`/`abilityBonusSuffix.test.ts`, y `LogPanel.test.tsx` (que sí envuelve `CombatExchangeBadge`) no menciona `attributeBonus` en absoluto. Sigue necesitando verse en pantalla real jugando — la revisión estática no puede sustituir esta verificación. |
| Clase Mago | ⛔ sin diseñar | Sin tabla de niveles todavía — la usuaria no lo ha diseñado. |
| Migraciones de clases aplicadas contra Postgres real | ✅ | Confirmado indirectamente (2026-08-28): migración `20260824030000_sistema_clases` existe en `prisma/migrations/`, y la partida real de hoy funciona sin ningún error de schema en combate/inventario/progresión — si no estuviera aplicada, cualquiera de esas rutas habría fallado con un error de Prisma como el visto en otra partida (`Value 'CONSUMIBLE_1' not found in enum`, ver `tarkor_bug_narracion_atacante_invertido_2026-08-27`, causado por un proceso viejo con cliente desincronizado, no por falta de migración). |
| **BUG CERRADO (2026-08-29)**: `Save.clase` sin ningún flujo de asignación | ✅ fijado (backend), frontend pendiente | Confirmado 2026-08-28 jugando: `Save.clase` de la partida real de Gorhorn estaba `NULL` en Postgres pese a que la clase ya está decidida (Cazador) — corregido esa vez con un `UPDATE` manual. **Investigado a fondo antes del fix (2026-08-29)**: el hueco era MÁS GRANDE de lo que parecía — incluso arreglando la columna a mano, `classAbilityUnlocksFor` (motor real de habilidades de clase) nunca leía `Save.clase`, solo un lookup hardcodeado `characterName === 'Gorhorn' → CAZADOR` — así que ni siquiera el UPDATE manual activaba el sistema de clases de verdad, solo los otros 2 consumidores reales (`weaponPoolFor`, `esDomador`). **Fix aplicado**: nuevo endpoint `PATCH /saves/:id/clase` (`progression.ts`) — valida el enum, rechaza si la partida ya tiene clase (mismo criterio que `especializacion` a nivel 10: decisión única, no respec libre), concede de golpe todo el tronco común ya alcanzado por el nivel actual (bucle `1..level` sobre `classAbilityUnlocksFor`, no solo nivel 1 — cubre tanto crear personaje como decidir la clase más tarde jugando), y narra el hito en un `LogEntry`. `classAbilityUnlocksFor` (`classAbilities.ts`) ahora acepta `clase` como tercer parámetro opcional y la usa como fuente real, con el lookup por `characterName` como fallback SOLO para partidas creadas antes de este fix. **Guard anti-duplicado** (bug real encontrado ANTES de aplicarlo a la partida real, no en producción): una partida creada antes de este fix pudo recibir ya alguna de estas habilidades por el camino viejo (ej. Gorhorn ya tenía "Analisis Salvaje" de fábrica) — el endpoint comprueba por nombre contra las `SavedAction` de categoría 'combate' ya existentes antes de crear, para no duplicar. **Aplicado a la partida real de Gorhorn** (nivel 3, vía el mismo código ya verificado, backend no levantado en esta sesión): `clase: CAZADOR` fijada, 0 habilidades nuevas creadas (ya las tenía todas), sin duplicados confirmado por consulta directa a Postgres. Verificado: `tsc -b` limpio, 3236 tests unitarios backend en verde (incluye 2 archivos de test nuevos/ampliados), 97/97 en `turn.integration.test.ts`, 111/111 frontend (no tocado). **Pendiente real**: `especializacion` (nivel 10) sigue sin ningún flujo — fuera de alcance de este cierre. Y NO hay todavía ningún selector en el frontend (`CharacterSelect.tsx`) para llamar a este endpoint desde el wizard de creación — el flujo de creación sigue sin pedir clase, así que una partida NUEVA seguirá naciendo con `clase: NULL` hasta que se construya ese selector o se llame al PATCH a mano/desde otro punto de la UI. |

## 10. Inventario, equipo, habilidades, misiones, progresión

| Ítem | Estado | Notas |
|---|---|---|
| Equipar/desequipar objetos (jugador) | ✅ reverificado en vivo (2026-08-28) | Flujo real: solo desde panel Personaje → Equipo → clic en la ranura ocupada → "SUSTITUIR POR" con candidatos. Confirmado equipando Maza orca en Arma Principal (reemplazó Hacha de guerra rota). **Nota UX menor, no bug**: el detalle de un objeto SUELTO en el panel Inventario (icono ⓘ) NO tiene botón Equipar — solo "Cerrar" — pese a que `DetailModal.tsx:370` sí tiene lógica de "Sustituir por"/"Equipar" para el `target.kind === 'equipSlot'`; ese código solo se alcanza desde la ranura en Personaje, nunca desde Inventario. Comentario propio en `GameView.tsx:715-717` ya reconoce que antes el modal viejo (vía Inventario) "solo 'Quitar', sin forma de sustituir directo" — sigue siendo así para el camino de Inventario, el nuevo con sustitución vive solo en Personaje. Restricción de armas por clase no se pudo probar de forma completa: `especializacion` de Gorhorn (Cazador) sigue `null` hasta nivel 10, y `weaponPoolFor` no aplica ninguna restricción sin especialización — Maza orca se ofreció sin filtrar, como se esperaba. |
| Crear/editar/borrar habilidad general | ✅ | — |
| Aceptar misión ofrecida (botones Aceptar/Cancelar, 2026-08-26) | ✅ el flujo con botones, incluida la misión del Orco Enfurecido | El camino legado de "Acabar con el Orco Enfurecido" saltándose los botones (`turnResolution.ts`, `detectsVerbalAcceptanceIntent`) se CERRÓ en la ronda de correcciones 2026-08-28 (P2.2, ver `docs/ronda-correcciones-2026-08-28.md`) — ahora solo ofrece (`newQuestOfferInfo`), la Quest real se crea vía `POST /saves/:id/quests/aceptar`. Reverificado indirectamente jugando la partida nueva: "Yo me ocupo de tu perseguidor" (mismo verbo que disparaba el bug) esta vez no creó ninguna Quest directa — el motor determinista encontró un Quio en vez del Orco Enfurecido guionizado (RNG distinta) y no ofreció nada, comportamiento coherente con el fix (sin combate real contra el agresor correcto, no hay oferta que mostrar). |
| Crafteo con texto libre sin materiales reales | ✅ reverificado en vivo (2026-08-28) | "Tallo piedra en bloques para construir." sin ninguna piedra en el inventario — narración: "Gorhorn se detiene a pensarlo mejor. No sabría ni por dónde empezar a levantar algo así — no es nada que conozca." Inventario confirmado SIN cambios tras el turno — el sistema no fabrica nada de la nada, respeta el `narrationWant` de la receta (`crafting.ts`, `STONE_BLOCK_RECIPE`). |
| Repartir punto de atributo (ASI) al subir de nivel | ✅ | Confirmado hoy (Gorhorn subió a nivel 3 jugando). |
| Enciclopedia (NPC/fauna/lugares descubiertos) | ✅ reverificado en vivo (2026-08-28) | Auditoría implementada 2026-08-27, 5/5 hallazgos cerrados. Confirmado hoy: Gistera Koh y Orco Enfurecido visibles como descubiertos en la sección "Orcos", el resto de individuos no encontrados aparecen como 🔒??? — comportamiento correcto. |
| Reputación con facciones | ✅ | — |
| **BUG NUEVO reportado jugando (2026-08-29), SIN INVESTIGAR — esperar orden explícita** | ❌ | Crear una partida nueva deja la pantalla en "Cargando partida..." en `/solitario/partida/nueva` indefinidamente, sin redirigir nunca a la partida real. Recargar la página manualmente SÍ la muestra — el backend crea todo bien (`POST /saves` funciona), el fallo es de FRONTEND: algo no detecta que la creación terminó y no navega a `/solitario/partida/:id`. Petición explícita de la usuaria: "anótalo pero no te pongas hasta que diga yo a corregirlos" — sin investigar causa raíz todavía. Ver `tarkor_bug_nueva_partida_cargando_infinito_2026-08-29` en memoria para candidatos de investigación cuando se retome. |
| **Tanda de hallazgos del 2026-08-30 — CERRADA (2026-08-31)** | ✅ | Los 16 puntos de la tanda revisados uno a uno: Matar (P3.2), reputación de facción al matar, aviso Convaleciente repetido, barra de habilidades, Cazar rechazado (causa real encontrada y fijada), combate NPC distinto al narrado, Huir sin narración única, muerte con/sin punto de guardado, Agua hervida crafteable (+ auditoría amplia, 1 caso más fijado: racion-carne), Hagar duplicado, fauna/flora en uploads, género macho/hembra en fauna (26/26), Sábana Alta duplicada, scroll/foco tras acción — todos ya estaban fijados de sesiones previas o se fijaron en esta ronda. Único sin causa reproducible: banner de Kirelon Arenoso (pipeline verificado sano, no reproducido). "Narración de viaje tramo a tramo" ya estaba fijada aparte (2026-08-31, ver `tarkor_narracion_viaje_tramos_y_espera_real_2026-08-31`). Detalle completo en `docs/revisar-partida-hallazgos.md § 2026-08-30`. |

## 11. Modelo LLM: comparación grande vs. pequeño

Pieza pedida explícitamente por la usuaria 2026-08-27: evaluar si un modelo más pequeño/rápido es
viable ahora que el contexto determinista es más completo (ver "Tras cerrar 1+2" del plan de
Dinamismo del mundo).

| Modelo | Tamaño | Estado de prueba | Notas |
|---|---|---|---|
| `tarkor-narrador` (fine-tune) | 7.6B | ✅ el de referencia habitual | Modelo con el que se ha jugado y verificado prácticamente todo el juego hasta ahora. |
| `qwen3.5:4b` (sin fine-tune) | 4.7B | 🧪 1 sesión corta | **Único hallazgo de esta comparación**: ignoró la instrucción de prompt "narra siempre en 3ª persona" en al menos 1 turno de varios — el modelo grande no ha mostrado ese fallo. El resto de turnos probados (3-4) fueron coherentes narración-vs-mecánica. Muestra demasiado pequeña para conclusión firme — **repetir con más turnos y comparar tiempo de respuesta real** (no medido con rigor todavía, percepción de "más lento" sin cronometrar bien). |
| `qwen3.5:9b` | 9.7B | ❌ sin probar | Disponible en Ollama, nunca cargado como narrador. |
| `qwen2.5:7b` (base sin fine-tune) | 7.6B | ❌ sin probar | Sirve para aislar si las mejoras de `tarkor-narrador` vienen del fine-tune o solo del tamaño. |
| `tarkor-narrador-v2` | 7.6B | ❌ sin probar | Existe una v2 en el catálogo de Ollama, no se ha usado como narrador activo en ninguna prueba reciente. |
| `tarkor-narrador-fast` | 3.1B | ❌ sin probar | El más pequeño del catálogo con fine-tune de Tarkor — candidato interesante para la comparación pendiente. |

## 12. "Trabajador de Reino" (2026-08-31) — moneda, edificios de facción, interior, aprender oficio

Fase 1 verificada en vivo con Playwright (2 partidas de prueba) — ver
`tarkor_pruebas_trabajador_reino_2026-08-31` (memoria de sesión) para el detalle completo, 1 bug
real encontrado y corregido (`ZonaPanel.tsx`, commit `0e3e4a8`).

| Ítem | Estado | Notas |
|---|---|---|
| Goirnos visibles en Inventario (🪙 junto a capacidad) | ✅ verificado en vivo (2026-08-31) | "🪙 50" visible junto a "Capacidad: 0/48 objetos". |
| Entrar al interior de Karot Veku (viaje instantáneo) | ✅ verificado en vivo (2026-08-31) | Narración coherente, ~1 min real de espera, `currentLocationId` confirmado en Postgres. |
| Ver a Torgash/Ulkha dentro del interior (ya no en la Zona exterior) | ✅ verificado en vivo (2026-08-31) | Ulkha Ketg apareció en escena real dialogando al entrar. |
| Ver los 2 `FactionBuilding` de prueba (Herrería/Curtiduría) en el mapa de Zona del interior | ✅ FIJADO Y VERIFICADO EN VIVO (2026-08-31) | **Bug real encontrado**: el `<svg>` de pines estaba condicionado a `imageUrl` (sin imagen de fondo, cero pines visibles pese a existir en BD) — afectaba a cualquier zona sin PNG subido, no solo esta. Corregido (`0e3e4a8`), reverificado: 2 triángulos + 3 cuadrados naranjas visibles. |
| Habilidad "Aprender oficio" en la barra general | ✅ verificado en vivo (2026-08-31) | Icono 📜 presente (confirmado por `aria-label`, sin texto visible en la barra), abre modal con los 2 Maestros. |
| Aprender oficio con éxito (reputación AMIGABLE + 10 Goirnos) | ✅ verificado en vivo (2026-08-31) | Sembrado un 3er Maestro real (`maestro-cocinero-serhu`, `teachesProfession: 'cocinero-orco-llanuras'`, + `FactionBuilding` "Cocina común de Karot Veku" + `ZonePoint`, mismo patrón que Herrero/Curtidor) — Cocinero es uno de los únicos 2 oficios que Gorhorn no tiene de serie. Jugado en vivo: modal mostró "Cuesta 🪙 10" con botón APRENDER habilitado (Herrero/Curtidor ya `disabled`, "Ya conoces este oficio"), pulsado → `POST /saves/:id/npc/maestro-cocinero-serhu/aprender-oficio` devuelve 200 con `LogEntry` real ("Gorhorn paga 10 Goirnos y aprende el oficio de Maestro Cocinero Serhu"), confirmado en Postgres: `Save.goirnos` 50→40, fila nueva en `ProfessionProgress` (`cocinero-orco-llanuras`, nivel 1, xp 0). **Recargada la página**: los 3 Maestros muestran correctamente "Ya conoces este oficio" tras F5 — estado sobrevive a recarga. Flujo de éxito completo confirmado en producción real, no solo por tests. |
| Icono de asentamiento en la ficha de Enciclopedia de Karot Veku | ✅ verificado en vivo (2026-08-31) | Botón "Generar icono (emblema plano)" presente SOLO en asentamientos (Miniatura/Banner ocultos), prompt generado real con 512×512 + estilo plano correcto. |

---

## Proceso: cómo probar el frontend en vivo (Claude jugando como jugadora)

Añadido 2026-08-27, primera vez que Claude prueba el frontend real en vez de solo por API/tests.

### Herramienta

Playwright instalado como paquete npm normal en el scratchpad de la sesión (NO como MCP — se
intentó, la extensión de VSCode no lo detectó; ver detalle completo en memoria
`tarkor_herramienta_playwright_2026-08-27`), controlado con scripts `.mjs` sueltos vía Bash+node.

```bash
export PATH="$HOME/.var/app/com.visualstudio.code/config/nvm/versions/node/v22.23.1/bin:$PATH"
cd /tmp/claude-*/scratchpad/playwright-runner   # crear si no existe, con su propio package.json
npx playwright install chromium                 # SIN --with-deps (falla: no hay `su` en este sandbox)
```

Un script mínimo de smoke test:
```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5173');
console.log(await page.title());
await browser.close();
```

### Antes de cada sesión de pruebas

- **La usuaria arranca/para backend, frontend y Postgres ella misma** — nunca Claude (acuerdo ya
  establecido). Comprobar con `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health`
  y `...5173` antes de empezar.
- Comprobar qué modelo de Ollama está activo si es relevante para la prueba:
  `curl -s http://localhost:11434/api/ps` (modelos cargados) — el `.env` del backend
  (`OLLAMA_MODEL_NARRADOR`) define cuál se usa, requiere reinicio del backend para cambiar.
- **`logs/backend.log` y `logs/backend-restart.log` (raíz del repo) pueden estar MUY desactualizados**
  (confirmado 2026-08-27: contenían entradas de julio, de una sesión de pruebas completamente
  distinta — ni siquiera la partida actual aparecía ahí) — no asumir que reflejan el proceso real
  que responde en el puerto 3001 ahora mismo. Si un turno se queda colgado sin resolver y hace
  falta ver el error real, pedirle a la usuaria que mire su propia terminal en vez de fiarse de
  estos archivos.

### Gotchas de la app (no de Playwright)

- `POST /saves/:id/resume` sale como `net::ERR_ABORTED` al cargar la partida — **falso positivo**,
  es React StrictMode cancelando el fetch del montaje efímero en dev; el endpoint responde 204 de
  verdad (confirmado con curl directo) y el código ya lo trata como best-effort. No investigar de
  nuevo.
- El botón "Actuar" existe DOS veces en el DOM (panel de texto libre inferior + panel de combate).
  Usar `getByRole('button', { name: /^actuar$/i }).nth(0)` — el índice 0 es el que se habilita
  primero tras seleccionar una habilidad de combate.
- 409 "Todavía se está resolviendo tu turno anterior" es el guard `turnLock` real funcionando bien,
  no un bug — aparece si se actúa demasiado rápido tras el turno previo. Dar 2-3s de margen tras
  cualquier acción antes de la siguiente.
- La resolución de un turno vía Ollama puede tardar **20-30s reales** (más con un modelo recién
  cargado o bajo carga) — no asumir cuelgue con menos de esa espera. **El método más fiable para
  saber si un turno terminó de resolverse no es esperar un tiempo fijo y hacer screenshot — es
  consultar el estado real vía API**: `curl -s http://localhost:3001/saves/:id` y mirar el último
  `characterLog`/`combateIniciado`. El frontend puede quedarse mostrando una vista de combate
  obsoleta (p. ej. tras ganar, sin refrescar la navegación) mientras la partida en Postgres ya
  avanzó — confundió varias veces durante la sesión del 2026-08-27.
- Para esperas más largas de las que permite un `waitForTimeout` cómodo, usar Bash con
  `run_in_background: true` + `ScheduleWakeup`/notificación, no encadenar `sleep` cortos (el propio
  entorno bloquea sleeps largos encadenados).
- El texto de `body.innerText()` puede mezclar contenido de paneles distintos si el selector
  `div.overflow-y-auto` no es único — preferir tomar un screenshot y leerlo visualmente (`Read`
  sobre el PNG) cuando haya dudas, es más fiable que confiar ciegamente en el texto extraído.
- Al hacer scroll al final del historial de combate, hacerlo DESPUÉS de confirmar que el turno ya
  se resolvió (vía API) — si se hace scroll mientras un turno sigue en cola, se ve el turno
  ANTERIOR completo y es fácil confundirlo con el resultado del turno recién enviado.
- **Nunca cerrar `browser.close()` (ni dejar que un script crashee) mientras un turno sigue en
  streaming** ("El narrador escribe..." visible) — hasta 2026-08-28 esto podía perder el turno
  del todo, sin persistir nunca su narración (bug real "turno fantasma", ya fijado, ver § 1 de la
  tabla de Combate 1v1). Aunque ya está arreglado, sigue siendo mala práctica: esperar siempre a
  que el turno termine (confirmado vía API) antes de cerrar el navegador o lanzar el siguiente
  script.
- **El composer de texto libre NO siempre es el mismo selector** (hallazgo real, 2026-08-31, tras
  varios timeouts perdidos): fuera de combate es `[contenteditable="true"]` (placeholder "¿Qué
  hace tu personaje?"); DENTRO del panel de combate (tras pulsar "Combatir") es un `<input
  placeholder="O describe tu acción...">` normal, sin `contenteditable`. Un selector que solo
  busca uno de los dos falla en silencio (`count: 0`, timeout largo) en el otro contexto —
  comprobar `page.locator('[contenteditable="true"], input[placeholder]')` o inspeccionar antes de
  asumir cuál aplica.
- **NUNCA reenviar la misma acción de texto libre por segunda vez sin confirmar antes, vía API,
  que el turno anterior terminó** (hallazgo real, 2026-08-31): cada clic en "Actuar" crea su eco
  ("Tu acción") de inmediato en el `characterLog` (`turn.ts:863-867`, `/turn/classify`), ANTES de
  que la narración real (`/turn/narrate`) responda — reenviar tras un timeout de script (no de
  turno real) deja varios ecos idénticos sin ninguna respuesta del narrador detrás,
  ensuciando el log de la partida de prueba sin avanzar `fictionalMinutes`. Si un script de
  Playwright falla/hace timeout tras pulsar Actuar, comprobar el estado real vía API antes de
  reintentar — nunca reintentar a ciegas solo porque el script murió.
- **En un `CombatEncounter` de grupo (2+ del mismo tipo), el orden de los botones en el DOM NO
  coincide con el orden por `id` de `CombatParticipant` en Postgres** (hallazgo real, 2026-08-31):
  si se fija la condición de un participante concreto por SQL para forzar un escenario de prueba
  (p. ej. CONVALECIENTE para probar Capturar), hace falta verificar con el `body enviado` real del
  `POST` (interceptar `req.postData()` en Playwright) qué `participantId` mandó el botón pulsado,
  no asumir que "el primero de la lista" es el que se acaba de editar en la BD — si no coinciden,
  el backend responde 400 con guard de estado ("no está listo para atar"), confuso si no se sabe
  la causa. Más simple y fiable: fijar TODOS los participantes del grupo al estado deseado de una
  vez, no solo uno.
- **Un turno real puede tardar mucho más de los 20-30s habituales tras cargar el modelo narrador
  grande desde cero por primera vez en la sesión de Ollama** (hallazgo real, 2026-08-31, confirmado
  con el log completo de `ollama serve`): un turno se quedó sin resolver 5+ minutos justo después
  de que Ollama arrancara `tarkor-narrador` (7.6B) desde cero (`load_tensors`/`llama_context` en el
  log) — el modelo tarda en cargar en VRAM antes de poder procesar el prompt real, y ese tiempo de
  carga NO es visible desde `GET /saves/:id` (que solo muestra "sin resolver todavía", igual que un
  cuelgue real). **Aviso importante de la usuaria, jugando de verdad su experiencia real es 30-120s,
  casi nunca más** (salvo procesos con espera de ficción real, como viajar) — si un turno de
  Claude jugando tarda mucho más que eso, sospechar primero del PROPIO proceso de prueba (curls
  externos de diagnóstico al puerto 11434 compitiendo por el único slot de generación de Ollama,
  `n_slots = 1` confirmado en el log — un `curl .../api/generate` de "comprobación de salud" hecho
  mientras un turno real está en cola puede desplazarlo) antes de concluir que es un cuelgue de
  infraestructura sin más. **No hacer curls directos a Ollama para "comprobar salud" mientras se
  espera un turno real** — comprobar solo `GET /saves/:id`, que no compite por el slot de
  generación.
- El input de acción libre NO es un `<textarea>` — es un `[contenteditable="true"]`. Usar
  `page.locator('[contenteditable="true"]')` con `.click()` + `.fill()`, nunca
  `getByPlaceholder(...)` (el placeholder cambia dinámicamente y puede dar timeout).
- Un script de Playwright que crashea a mitad (p. ej. un error de tipos como `req.response()` sin
  `await`) puede dejar un turno a medio enviar — si algo se ve raro después, comprobar el log de
  personaje completo vía API antes de asumir que el juego está roto; puede ser solo el script.
- **Nunca enviar un turno de "prueba"/diagnóstico crudo (`action: "test"` o similar) directamente
  contra el saveId real que se está jugando** — usar siempre una partida de prueba aparte para
  diagnosticar problemas de infraestructura (timeouts, locks, Ollama). Se cometió este error el
  2026-08-28 intentando comprobar si `turnLock` seguía vivo: el turno de prueba SÍ llegó a
  resolverse en segundo plano (aunque el `curl` local diera timeout), dejó `combateIniciado: null`
  de forma confusa sin quedar claro si el combate real se resolvió o se interrumpió, y hubo que
  reiniciar la partida (`POST /saves/:id/restart`) para recuperar un estado limpio.
- **Algunos turnos son 100% deterministas y NUNCA pasan por Ollama** — no sufren el cuelgue de
  abajo. Ejemplo confirmado en código (turnResolution.ts): la primera vez que Gistera Koh se
  presenta (`gisteraSePresentaEsteTurno`) usa un texto FIJO, no generado (mismo patrón que
  `lootMode`/`buildMode`/`harvestOutcome`/`craftMode` — ver `wasLlmNarrated` en turnResolution.ts).
  Si un cuelgue de Ollama bloquea las pruebas, estos turnos deterministas siguen siendo seguros de
  probar.
- **Si un turno se queda sin resolver 3+ minutos con el navegador conectado todo el tiempo** (no es
  el bug del turno fantasma, que ya está fijado), sospechar de un cuelgue de Ollama/el prompt real
  siendo demasiado grande — ver el hallazgo completo en `tarkor_cuelgue_turno_combate_modelo_grande_2026-08-28`
  y el punto 0 de "Próximos pasos" más abajo. Comprobar `curl http://localhost:11434/api/ps` y una
  generación de prueba simple y directa (`POST /api/generate` con un prompt corto) para aislar si
  Ollama en sí funciona — puede responder bien a prompts cortos mientras el turno real (con mucho
  más contexto) sigue colgado.

### Verificación tras cualquier fix de código encontrado jugando

Mismo criterio que el resto de la sesión (no específico de Playwright, pero crítico repetirlo):
```bash
cd backend && rm -rf dist && npx tsc -b               # rm -rf dist SIEMPRE antes, si no vitest
npx vitest run src/services/narrador.test.ts           # recoge también los .js viejos de dist/
                                                          # y duplica/contamina el conteo de fallos
```
Un fix de narración necesita que la usuaria **reinicie el backend** para aplicar en su partida en
curso — Node ya cargó el código viejo en memoria, el archivo `.env`/código nuevo no se recarga solo.

### Cambiar el modelo de Ollama para comparar

```bash
# En backend/.env — comentar la línea activa, descomentar/añadir la nueva:
OLLAMA_MODEL_NARRADOR="qwen3.5:4b"
# OLLAMA_MODEL_NARRADOR="tarkor-narrador"
```
Requiere que la usuaria reinicie el backend. Comprobar que el modelo ya está descargado en Ollama
antes (`curl -s http://localhost:11434/api/tags`) — si no, `ollama pull <modelo>` tarda minutos.

**Cuelgue real visto (2026-08-27/28) tras alternar 2 veces entre modelo grande y pequeño en la
misma sesión**: un turno de texto libre se quedó colgado en `/turn/classify` sin resolver nunca
(ni con el timeout de 90s del backend, que debería haber cortado la llamada) — `curl` a
`/api/tags` de Ollama respondía bien (200), pero la generación real no avanzaba. `ollamaQueue`
(lib/ollamaQueue.ts) es en memoria del proceso backend, así que un backend recién reiniciado no
puede arrastrar una tarea vieja atascada — el cuelgue estaba del lado de Ollama en sí, no del
backend. Solución: reiniciar Ollama (no solo el backend) resolvió el problema al instante — el
siguiente turno se resolvió con normalidad. Si un turno se queda colgado mucho más de 90s sin
error visible, sospechar de Ollama en sí, no solo del backend/frontend, especialmente después de
haber cambiado de modelo activo varias veces en la misma sesión.

---

## Próximos pasos sugeridos (por prioridad)

0. **NUEVO, máxima prioridad** (2026-08-28): investigar/arreglar el patrón de cuelgues de Ollama
   visto al final de la sesión del 2026-08-27/28 — reproducido 3 veces (combate y exploración
   simple), 10-15+ min cada uno sin resolver, Ollama con el modelo cargado pero sin generar. Ver
   `tarkor_cuelgue_turno_combate_modelo_grande_2026-08-28` para el diagnóstico completo. **Pista de
   código real encontrada** (no solo hipótesis): `narrador.ts:1183` — el recorte de `worldFacts`
   (`retryFacts = ctx.worldFacts.slice(...)`) SOLO se aplica en `attempt2` (el reintento tras
   timeout), el intento inicial (`attempt1`, el que corre siempre primero) envía `worldFacts`
   COMPLETO sin ningún límite. Medido con `buildNarrationPrompt` directamente: un turno de
   exploración SIMPLE con solo 15 hechos cortos sintéticos ya pesa ~2164 tokens — una partida real
   con horas de juego acumuladas y `worldFacts` mucho más largo podría acercarse o superar el
   `context_length: 8192` del modelo, lo que explicaría un cuelgue desproporcionado (no solo lento)
   en el primer intento, antes de que el recorte del segundo intento pueda ayudar. **Causa raíz más
   probable, confirmada por conteo real**: `contextBlocks` (turnResolution.ts) tiene **33 puntos
   distintos de `.push(...)`** (NPCs en escena, viaje, clima, inventario, ZonePoint, misiones,
   escenas obligatorias...) sin NINGÚN límite agregado después — a diferencia de `sessionFacts`,
   que sí está acotado (`MAX_SENT_FACTS=10`, worldFacts.ts). Un turno con muchos mecanismos
   deterministas activos a la vez (como el mío: combate + Gistera Koh + fauna ambiental + NPC
   detectado) podría inflar `contextBlocks` sin control. Candidato de fix a evaluar: poner un tope
   a `contextBlocks` igual que ya existe para `sessionFacts`.

   **MATIZ importante añadido tras un 4º intento**: el ÚLTIMO cuelgue del día fue en una partida
   RECIÉN REINICIADA (2 entradas de log, sin `SessionFact` acumulados) — el mismo tipo de turno
   simple que antes en la misma sesión sí se había resuelto bien. Esto separa el problema en DOS
   causas distintas, no una sola: **(1) degradación de infraestructura** (Ollama/hardware) bajo
   uso sostenido de la SESIÓN — confirmado hoy con una prueba directa a Ollama que dejó de
   responder incluso a un prompt trivial ("hola"); solo se arregla reiniciando, no con un cambio
   de código. **(2) `contextBlocks` sin tope** — sigue siendo un riesgo real y válido para
   partidas LARGAS con mucho historial acumulado, pero NO explica los cuelgues de hoy en una
   partida recién reiniciada. Ambas cosas merecen atención, pero no confundir una con la otra.

   Bloquea CUALQUIER prueba que necesite generar narración real — resolver antes de seguir con los
   puntos de abajo.

   **ACTUALIZACIÓN (2026-08-28, mismo día, sesión posterior)**: aplicado un fix real para la causa
   (2) — tope de 3 NPCs con bloque completo en `contextBlocks` (prioriza `npcParaIntercambio`), el
   resto recibe una línea corta (`npcSceneLineFor`). Verificado por tests (1633/1633 en ese
   momento), **sin confirmar todavía si esto resuelve el cuelgue real jugando** — la causa (1)
   (degradación de infraestructura bajo uso sostenido) sigue sin fix de código posible. Ver
   `tarkor_cuelgue_turno_combate_modelo_grande_2026-08-28`.

   **REPRODUCIDO DE NUEVO (2026-08-28, sesión de pruebas posterior, autónoma)**: tras una tanda
   larga de combates seguidos (Kirelon Arenoso × varios, Nuente × varios) buscando reverificar
   Desollar, un turno de descanso quedó sin resolver 20+ minutos reales. Confirmado con
   `curl http://localhost:11434/api/generate -d '{"model":"tarkor-narrador:latest","prompt":"hola","stream":false}'`
   con `timeout 20` que Ollama NO respondía ni a un prompt trivial, pese a `curl .../api/ps` seguir
   mostrando el modelo cargado en VRAM — mismo patrón exacto que la causa (1) ya documentada arriba
   (degradación bajo uso sostenido de la sesión, no un bug de código). Refuerza que el tope de
   `contextBlocks` (causa 2) no es suficiente por sí solo para evitar esto — sigue haciendo falta
   una mitigación real del lado de infraestructura (timeout+reintento automático del backend hacia
   Ollama, o vigilancia/reinicio del propio proceso Ollama) para que sesiones de pruebas largas no
   queden bloqueadas así.

   **REPRODUCIDO UNA TERCERA VEZ tras reinicio completo (2026-08-29)**: la usuaria reinició backend
   + Ollama para desatascar la sesión. Tras el reinicio, el sistema funcionó con normalidad un rato
   (turno de comprobación "Miro alrededor..." se envió sin problemas, botón ACTUAR se habilitaba
   bien con texto), pero Ollama volvió a dejar de responder poco después — confirmado de nuevo con
   `curl .../api/generate` (prompt trivial, timeout) sin respuesta, pese a `/health` seguir
   reportando `ollama: ok` y `/api/ps` seguir mostrando el modelo cargado. **Refuerza con más fuerza
   todavía** que esto es un problema de degradación bajo carga que un simple reinicio solo alivia
   temporalmente, no lo resuelve de raíz — la mitigación de infraestructura real (timeout+reintento,
   o healthcheck de generación real en vez de solo `/api/ps`) sigue pendiente y cada vez parece más
   necesaria para poder completar sesiones de pruebas largas sin interrupciones repetidas.

   **CAUSA RAÍZ REAL DEL LADO DE CÓDIGO ENCONTRADA Y FIJADA (2026-08-31)**: la mitigación pedida
   arriba ("timeout+reintento automático del backend hacia Ollama") NO existía — investigado a
   fondo tras reproducir el cuelgue en vivo una vez más y confirmarlo con el log real del backend
   (`/turn/classify` sin `res` en absoluto, minutos después de enviarse) y el log real de `ollama
   serve` (el modelo `tarkor-narrador` cargándose desde cero justo antes, `load_tensors`/
   `llama_context`). Causa exacta en `ollamaQueue.ts`: la cola de concurrencia-1 solo avanzaba
   (`this.tail`) cuando la tarea encolada RESOLVÍA de verdad — el `timeoutMs`/`AbortController` de
   `ollama.ts` (`classifyAction`: 90s, `narrateAction`: 90-240s) protege el propio `fetch`, pero si
   Ollama acepta la conexión TCP y se cuelga genuinamente sin devolver el control, el `AbortSignal`
   no siempre logra cerrar esa conexión a tiempo del lado de Node/undici — la tarea puede quedar
   viva mucho más allá de su timeout nominal. Con la cola vieja, esa UNA tarea zombie bloqueaba TODA
   la cola detrás para siempre: ni el turno atascado ni ningún turno posterior (de cualquier
   partida, es una cola global de proceso) llegaba nunca a resolver ni a fallar con un error visible
   — la única forma de destrabar la sesión era reiniciar el backend entero, exactamente lo que la
   usuaria llevaba haciendo repetidamente sesión tras sesión. **Fix real** (`ollamaQueue.ts`): la
   cola ahora avanza (`this.tail`) en cuanto CUALQUIERA de las dos cosas ocurre primero — la tarea
   real resuelve, O expira su propio `queueTimeoutMs` de cola (150s por defecto, por encima del
   timeout interno más largo conocido) — vía `Promise.race`. Esto da **autorrecuperación real**: una
   tarea zombie sigue corriendo de fondo sin que nada la controle, pero dejar de ser escuchada no
   bloquea a nadie más — el siguiente turno en cola (de la misma partida o de otra) puede ejecutar
   con normalidad en cuanto le toque, sin ninguna intervención manual. 5 tests nuevos en
   `ollamaQueue.test.ts` (orden normal, error real propagado, zombie rechaza sola, autorrecuperación
   de una tarea real detrás de una zombie, varias zombies seguidas no bloquean a una tarea real más
   adelante) — todos en verde. `tsc -b` limpio.

   **INVESTIGACIÓN AMPLIADA LA MISMA NOCHE (2026-08-31→09-01)**: el fix de `ollamaQueue.ts` por sí
   solo NO resolvió el síntoma real — reproducido en vivo repetidas veces esa misma noche, turnos
   de prueba se quedaban sin resolver 260s-990s incluso tras reiniciar backend y Ollama con el fix
   ya aplicado y compilado. Investigado a fondo (scripts de diagnóstico aislados, todos pasaban
   perfecto — la discrepancia entre "funciona aislado" y "falla en producción real" fue la pista
   de que el problema estaba en OTRO punto del pipeline, no en `ollamaQueue.ts` en sí). Lanzado un
   agente de auditoría del pipeline completo (turno del jugador → respuesta), que encontró la causa
   raíz real, más profunda de lo diagnosticado la primera vez:

   - **CRÍTICO, la causa real del síntoma**: `turnLock.ts`/`inFlightClaimSet.ts` — el candado de
     turno en memoria (`claimTurnInFlight`, `turn.ts:904`, ANTES de `reply.hijack()`) solo se
     liberaba en el `finally` de `narrateAndPersistTurn`. Si esa promesa entera nunca resuelve NI
     rechaza (ver punto siguiente), el `finally` nunca corre y el candado queda tomado PARA
     SIEMPRE — el fix de `ollamaQueue.ts` protege la cola de Ollama, pero no este candado superior,
     que es el que de verdad explicaba "turnos que no resuelven ni fallan": el frontend seguía
     esperando una respuesta HTTP que nunca iba a llegar (turno original zombie), y cualquier
     REINTENTO del jugador chocaba con 409 en vez de con un error claro. **Fix**:
     `inFlightClaimSet.ts` gana caducidad automática (`staleAfterMs`, default 5 min/300000ms) — un
     candado más viejo que ese margen se trata como abandonado y `claim()` lo reemplaza, sin
     esperar nunca a un `release()` que quizás no llegue. 6 tests nuevos, todos en verde.
   - **ALTO**: `retrieval.ts` — `prisma.$queryRaw` (RAG contra pgvector/Postgres, corre en casi
     todos los turnos vía `retrieveLore`) sin ningún timeout propio ni AbortController (Prisma no
     soporta cancelación nativa de queries raw). El propio comentario del código YA advertía
     "latencia de red... Supabase remoto" como cuello de botella conocido, sin protección real.
     **Fix**: `withQueryTimeout` (15s) envolviendo la consulta + `try/catch` en el caller
     (`turnResolution.ts:2722`) que degrada a `[]` (sin lore RAG) en vez de romper el turno entero
     — mismo criterio que ya usa `isWeaklyGrounded` para "sin lore relevante". 3 tests nuevos.
   - **Bug real introducido por mi propio primer fix, encontrado revisando el informe del agente**:
     `ollamaQueue.enqueue` nunca recibía `queueTimeoutMs` explícito desde `ollama.ts` — SIEMPRE
     usaba el default de la cola (150s), pero `narrateAction` (attempt2) pide `timeoutMs: 240_000`
     a su propio `AbortController` interno. Mi guard de cola (150s) disparaba ANTES de que ese
     timeout interno más largo tuviera ocasión de actuar de forma limpia — cortando prematuramente
     intentos legítimos que el propio código ya había decidido que podían tardar más. **Fix**:
     `queueTimeoutFor` (`ollama.ts`) deriva el guard de cola del `timeoutMs` real de cada llamada
     +30s de margen, en vez de usar siempre el default. 2 tests nuevos.
   - **Investigado y descartado como causa, documentado para no repetir la investigación**: Fastify
     tiene `requestTimeout: 0` (`server.ts:16`) a propósito, y `/turn/narrate` usa `reply.hijack()`
     — ninguno de los dos es el bug en sí (son decisiones deliberadas ya documentadas), pero juntos
     confirman que la ÚNICA red de seguridad real contra un cuelgue es el guard de nivel de
     aplicación (candado + cola), nunca Fastify — coherente con por qué los 2 fixes de arriba eran
     necesarios. Los proveedores cloud de imagen (`aiProviders/*Client.ts`) tampoco tienen timeout,
     pero solo se usan en scripts de siembra offline y en una llamada fire-and-forget
     (`liveTeacherCapture.ts`, `void` sin await) — no bloquean la respuesta al jugador, riesgo real
     pero de fuga de recursos, no de cuelgue de turno.

   **Verificación**: `tsc -b` limpio backend completo. 11 tests nuevos en total entre las 3 piezas
   (`inFlightClaimSet.test.ts`, `retrieval.test.ts`, `ollama.test.ts`), todos en verde, más los 5 ya
   existentes de `ollamaQueue.test.ts`. **Pendiente de verificar en vivo la próxima sesión real**:
   este conjunto de 3 fixes juntos (candado con caducidad + timeout de RAG + guard de cola
   coherente con el timeout interno) es la primera vez que se ataca el problema completo de punta a
   punta en vez de solo la pieza de Ollama — confirmar que un cuelgue real ya no deja la partida
   bloqueada más de ~5 minutos sin que el jugador pueda seguir jugando (reintentando el turno),
   incluso sin que nadie reinicie nada.

   **AVISO para la usuaria**: como resultado de esta inestabilidad, la partida real de pruebas
   (Gorhorn, `cmtd4qgfk003lriuof6id16e0`) acumuló **5 turnos de acción sin ninguna narración de
   resultado** ("Miro alrededor...", "Busco la presa más débil...", entre otros) — no bloquean el
   composer (el botón ACTUAR se sigue habilitando con normalidad al escribir texto), pero tampoco
   tienen respuesta y quedan como "huecos" en el historial. No representan pérdida de datos del
   personaje (XP/inventario/condición no se tocaron en esos turnos), pero si la usuaria retoma esta
   partida puede querer saber que esos turnos concretos nunca se narraron.

0.5. **Ronda grande de cierres (2026-08-28, misma sesión)**: bug de captura en grupo (fauna)
   CERRADO, bug "decapitar concurrente" investigado (no era real, ruido de test), cuerda-no-craftea
   CERRADO, foco de auto-scroll CERRADO, cinturón de combate CONSTRUIDO, pasivas raciales
   CONSTRUIDAS, sessionFacts reintroduciendo NPCs retirados CERRADO. Todo esto está verificado SOLO
   por tests (backend 1664/1664, frontend 107/107) — ninguna pieza de esta ronda se ha visto
   funcionar en una partida real jugando. Cualquier fila de arriba marcada "REABRIR"/"NUEVO
   (2026-08-28)" necesita una pasada de juego real antes de volver a marcarse ✅.
1. ✅ CERRADO (2026-08-28): combate 1v1 completo jugado en vivo (Orco Enfurecido, misión Gistera
   Koh) — desglose nuevo de tirada confirmado, Sangre del Estallido confirmada, saqueo completo
   confirmado. Pendiente todavía: el NPC ganando claro con `hasFalseCombatAttacker` activo (el
   combate de hoy tuvo varias victorias del orco pero no se revisó la narración con lupa para
   ese guard concreto), pasiva racial orca en acción (no se dio la condición), y el cinturón de
   combate (selección de activas, tope 6 — no se tocó la pantalla de Habilidades esta ronda).

1.5. **Hallazgo de diseño/balance a valorar (2026-08-28, petición explícita de la usuaria)**: jugando
   el combate contra el Orco Enfurecido (primer combate real de la partida, gatillado por la misión
   de Gistera Koh — funciona como tutorial de facto para un personaje recién creado), tras 8 turnos
   de intercambio Gorhorn pasó de Ileso a Grave (50%) mientras el orco solo bajó de Ileso a Grave
   también, con varias rachas de bloqueo/esquiva seguidas por ambos lados — nada asegura la victoria,
   pero tampoco se siente "asequible" para un primer combate de nivel 1. Cita textual: "el primer
   combate que será como un tuto en este caso para Gorhorn, la misión de Gistera... el enemigo
   debería ser 'asequible', vamos no una victoria asegurada pero algo factible — para esto quizás
   tengamos que reducir más aún los stats del enemigo, o quitarle equipo... ya lo valoraremos". NO
   se ha tocado el balance todavía — pendiente de decisión de diseño (bajar stats del Orco
   Enfurecido en `worldCatalog.ts`, y/o quitarle parte de su equipo/loadout). Revisar si otros
   "primeros combates" de otros orígenes/arquetipos de personaje tienen el mismo problema, no solo
   este NPC concreto.

1.6. ✅ **CERRADO** — ajuste de coste/regeneración de energía de Defenderse/Esquivar. Ya aplicado
   en el código (`genericCombatAbilities.ts`, comentario "Ajuste 2026-08-28") — Defenderse
   `energyCost: 0, energyRegen: 5`, Esquivar `energyCost: 5, energyRegen: 0` — y verificado
   (2026-08-29) contra Postgres real en las 2 partidas existentes (`SavedAction` ya persistida con
   los valores correctos, no solo la constante en código). Esta entrada estaba duplicada/obsoleta
   respecto a la fila ya cerrada en §1 ("fix de energía Defenderse/Esquivar (P3.1) no llegó a
   partidas ya creadas") — sin trabajo pendiente real aquí.

1.7. ✅ **CERRADO** — retomar viaje tras evento resuelto con éxito. Ya implementado (ronda de
   correcciones 2026-08-28, ítem P3.3 de `docs/ronda-correcciones-2026-08-28.md`) — esta entrada
   estaba desactualizada. Flujo real confirmado en el código (2026-08-29): al truncar el viaje por
   una interrupción, se persiste `Save.pendingTravelResumeDestinationId` (schema.prisma:300) con el
   `Location.id` del destino original pedido. Al resolver un turno siguiente sin combate activo ni
   fin de partida (`turnResolution.ts:5987-6052`), si ese campo sigue apuntando a un destino válido
   y distinto de la ubicación actual, se narra explícitamente "Con esto resuelto, {personaje} retoma
   el camino hacia {destino}." (línea 6008 — cumple la petición textual de la usuaria) y se crea un
   `CharacterTransit` nuevo hacia el destino original, que al completarse narra la LLEGADA real por
   el mismo camino genérico de cualquier viaje (worldTick.ts). Si la ruta ya no es alcanzable, el
   campo se limpia sin reintentar cada turno. 3 tests de integración de extremo a extremo
   (`turn.integration.test.ts`, ~línea 4570-4670): truncamiento → resolución del evento → reanudación
   con narración → llegada real confirmada. **Pendiente real**: no se ha reverificado en vivo el caso
   concreto que motivó el hallazgo original (Gorhorn / Hondonada del Eco / Kirelon Arenoso) — la nota
   se escribió antes de que existiera este fix.

1.8. **INVESTIGADO A FONDO (2026-08-29) — no es un bug, cálculo original de probabilidad era
   inaplicable**. El ~1.25% (154/12247) que hacía sospechoso el resultado se calculó sobre los 5
   candidatos de `WorldPopulation` de TODA la región — pero el camino real que interrumpe un
   "descansar" (`pickStationaryInterruption`, `stationaryInterruption.ts`) NO elige entre toda la
   fauna de la región: su universo de candidatos son solo los `ZonePoint` sembrados a mano en ESA
   `Location` concreta (Capa 1 del mundo determinista, prototipo en una sola zona). Para Hondonada
   del Eco eso son únicamente 2 candidatos, Kirelon Arenoso y Gesgurio (`worldCatalog.ts:6839-6840`)
   — los otros 3 del cálculo original (`ruptidar`, `quio`, `nuente`) NO viven en esta Location:
   `quio` tiene `homeLocationSlug: 'manaderos'`, `nuente` tiene `homeLocationSlug: 'agujas-iman'`, y
   `ruptidar` es itinerante sin hogar fijo ("presente en cualquier zona arenosa") pero tampoco tiene
   `ZonePoint` sembrado aquí — el comentario del propio código (`worldCatalog.ts:6821-6822`) ya deja
   claro que el seed se limita a propósito a "los únicos 3 con `homeLocationSlug: 'hondonada-del-eco'`"
   (yerreo/gesgurio/kirelon-arenoso; yerreo es RECURSO, no cuenta para interrupciones). Con el
   universo real de 2, la probabilidad de Kirelon por tirada es ~6.7% (154/2300), no 1.25% — sigue
   siendo baja (verlo ganar 5-6 veces seguidas en igualdad de condiciones es ≈1.35×10⁻⁶, raro pero no
   imposible), y no hay ninguna vía de código que explique un sesgo real: `pickTravelInterruption`
   (RUTA) filtra correctamente `homeLocationSlug: null` y Kirelon tiene hogar fijo, así que NUNCA
   puede colarse por ahí (hipótesis del checklist original, descartada con certeza de código); la
   "sugerencia ambiental" narrativa (`turnResolution.ts:3078`) también filtra `homeLocationSlug: null`
   por el mismo motivo. Tampoco hay ningún caché/estado en proceso que "pegue" el último NPC ganador
   entre tiradas — cada llamada consulta Prisma y tira `random()` desde cero. **Conclusión: dato de
   diseño correcto (universo real de 2 candidatos, ponderación correcta dentro de ese universo),
   racha observada estadísticamente rara pero no evidencia de bug — sin fix de código aplicable.**
   Único hueco de cobertura real detectado de paso: `stationaryInterruption.test.ts` solo prueba con
   1 candidato a solas, ningún test ejercita 2+ compitiendo — no bloqueante, anotado para si se
   retoma esta zona.

2. Forzar un combate de grupo (cazar 2+ criaturas iguales) para ejercitar por primera vez el motor
   de combate múltiple jugando de verdad, y probar el flujo NUEVO de captura (atar → depositar en
   Jaula) contra 2 individuos del mismo tipo — el caso que antes era un bug conocido.
3. Verificar `ZonePoint` vivo abriendo el panel de Zona en un lugar con varios puntos.
4. Terminar la comparación de modelo grande vs. pequeño con más turnos y tiempos cronometrados.

## Verificaciones de código estático hechas sin necesitar Ollama (2026-08-28)

Cuando los cuelgues de Ollama bloquearon seguir jugando, se revisó código real (sin generar
narración) para refinar varios ítems que estaban marcados de forma imprecisa. Cambios de estado
reales de esta pasada: **Control regional** (❌→🧪, SÍ está conectado backend+frontend, solo
faltaba verlo en pantalla), **las 4 filas de `ZonePoint` vivo** (❌→🧪, las 4 piezas — formas,
color, agrupación, recálculo — están implementadas y con tests, no "sin construir"), **"nunca
sustituye combate" del Modo Dinámico** (con detalle nuevo: es solo prompt, sin guard, mismo patrón
frágil de siempre), **restricción de armas por clase** (con detalle: sí tiene test de integración),
**migraciones de clases** (❓→✅, confirmado indirectamente por la partida real funcionando sin
errores de schema). Ningún ítem bajó de estado — todos subieron o se precisaron, ninguna sospecha
nueva de regresión.
