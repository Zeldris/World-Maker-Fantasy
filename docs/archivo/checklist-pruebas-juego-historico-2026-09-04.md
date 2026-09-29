# Checklist de pruebas de juego — historial cerrado (2026-09-03 → 2026-09-04)

**ARCHIVADO (2026-09-29, Fase 7 del plan de octubre):** secciones movidas SIN editar desde
[../registros/checklist-pruebas-juego.md](../registros/checklist-pruebas-juego.md). Cubren el
diagnóstico del cuelgue de Ollama (causa raíz, fix de `/turn/classify` y guards de duración) y la
crónica de las mejoras hechas esa misma ronda (tiradas en vivo, Diario en pestañas, barras de
habilidades, iniciativa, etc.), todas ya cerradas. Se conservan por valor de diagnóstico; comprobar
siempre contra el código real antes de dar nada por pendiente.

---

## Cuelgue de Ollama reproducido de nuevo (2026-09-03 noche → 2026-09-04, ronda de pruebas continuas
tras el sembrado de `FloraCategoria`/renombrado Chudo)

**Contexto**: la usuaria pidió pruebas continuas nocturnas tras reiniciar backend y frontend con el
código nuevo. Se creó una partida de prueba limpia (`cmtm3qi4b0001rirshc899tlc`, Gorhorn/Guerrero),
se confirmó en vivo que el fix de reconexión de ayer (`useReconnectionPolling`/`mountedRef`,
`docs/registros/checklist-pruebas-juego.md`/commit `2b2c31a`) sigue funcionando correctamente en producción
real — tras recargar la página, el composer muestra "Esperando la narración de tu último turno..."
en vez de quedar deshabilitado sin explicación, y el tooltip de equipo (commit `2b2c31a`) también
sigue mostrando el nombre completo del objeto correctamente.

**El bug real**: el primer turno de exploración ("Exploro la zona con atención.") NUNCA se resolvió
— confirmado con espera activa y monitorizada de **más de 15 minutos**, muy por encima del peor
caso teórico documentado en el propio código (`narrador.ts`: `attempt1` 90s + `attempt2` 240s +
`attempt3` 90s ≈ 7 min máximo). Diagnóstico:
- `curl http://localhost:11434/api/ps` devolvió `{"models":[]}` — **ningún modelo cargado en
  Ollama** durante toda la espera, pese a que los 2 primeros intentos de la cascada usan
  `keepAlive: '1h'` (deberían mantenerlo cargado mientras generan). Esto descarta que sea una
  generación real simplemente lenta — la llamada nunca llegó a Ollama, o falló antes en silencio.
- `curl http://localhost:3001/health` siguió devolviendo `{"status":"ok","database":"ok","ollama":"ok"}`
  durante todo el cuelgue — ese endpoint solo comprueba conectividad, no detecta este tipo de fallo.
- **Se creó una SEGUNDA partida independiente** (`cmtm4a83r001urirsx95kob96`, Gorhorn/Cazador) para
  aislar si el problema era del candado en memoria de la primera partida (`turnLock.ts`,
  `inFlightClaimSet.ts`, `staleAfterMs: 300_000`, confirmado que es por-`saveId`, no global) — el
  turno de esta segunda partida ("Observo mi entorno.") **tampoco se resolvió**, con `api/ps`
  igualmente vacío varios minutos después. Descarta que sea un candado zombie heredado de la sesión
  de ayer (el combate colgado de `cmtlwx13g0044rik16vto9iqy`) — es un problema sistémico del proceso
  backend/Ollama en este momento, no de una partida concreta.
- **No se pudo diagnosticar más a fondo**: sin acceso a los logs del proceso backend real (corre
  fuera del sandbox de Bash de esta sesión) ni forma de reiniciarlo sin la usuaria. Las 3 partidas
  con turnos colgados a fecha de este cierre: `cmtlwx13g0044rik16vto9iqy` (combate de ayer, nunca se
  resolvió tampoco), `cmtm3qi4b0001rirshc899tlc`, `cmtm4a83r001urirsx95kob96` — las 3 se dejan tal
  cual, sin tocar, como evidencia.
- **Matiz sobre el mensaje de fallback del frontend, RESUELTO con verificación positiva**: en el
  primer intento, tras 20+ min de espera con `page.goto()` repetidos, el composer seguía en
  "Esperando la narración..." sin caer al mensaje de fallback — sospeché un efecto colateral de
  recargar la página (cada `goto()` reinicia el sondeo `useReconnectionPolling` desde cero). Se
  verificó con una pestaña ÚNICA sin ninguna recarga, dejada correr 13 minutos ininterrumpidos:
  **confirmado en vivo que el fix de ayer funciona de extremo a extremo** — a los 12 minutos
  exactos (72×10s), el mensaje `"La acción quedó registrada, pero la narración sigue sin
  completarse tras esperar — puede que tengas que reintentarla."` apareció correctamente y el
  composer dejó el estado "Esperando..." — la sospecha inicial era en efecto solo un artefacto de
  las recargas repetidas de las pruebas, no un problema real del fix.

**Relación con el fix de la sesión anterior**: `tarkor_fix_ollamaqueue_autorrecuperacion_2026-08-31`
documentaba 3 fixes (candado sin caducidad + RAG sin timeout + guard de cola mal calibrado)
pendientes de "verificar en vivo" — este cuelgue de esta noche, si se confirma que persiste tras un
reinicio limpio de verdad, sería la primera verificación en vivo real de esos fixes, y sugeriría que
no cubren la causa completa (o que hay una causa nueva/distinta). **No se puede concluir con
certeza si el reinicio de esta noche fue completo** (proceso backend realmente matado y vuelto a
lanzar, vs. solo un `restart` que no limpiara todo el estado en memoria) — la usuaria debería
confirmarlo la próxima vez que revise esto.

**Siguiente paso recomendado**: cuando la usuaria retome la sesión, reiniciar el backend de verdad
(matar el proceso, no solo recargar) y repetir un turno simple en una partida nueva para confirmar
si el cuelgue se repite desde cero — si sí, la causa raíz de `ollamaQueue.ts`/`retrieval.ts` sigue
sin cerrar del todo pese a los fixes de agosto.

**Actualización ~40 min después (23:10-23:15)**: `curl http://localhost:11434/api/ps` empezó a
mostrar `tarkor-narrador:latest` y `nomic-embed-text:latest` cargados con `expires_at` real —
Ollama en sí volvió a tener actividad/keepAlive activo, probablemente por alguna llamada que sí
llegó a completarse (quizás el propio sondeo de reconexión, u otra ruta). **Pero ninguno de los 2
turnos colgados llegó a resolverse ni con Ollama ya "vivo"** — sigue en 4+4 `LogEntry` sin cambio
varios minutos después de que los modelos aparecieran cargados. Esto apunta más al candado en
memoria por-`saveId` (`turnLock.ts`) atascado con la tarea zombie original, que a un Ollama
realmente caído — coherente con el propio comentario de `inFlightClaimSet.ts`: "la tarea zombie de
origen sigue corriendo de fondo sin que nada la mate [...] su resultado real, si llega,
simplemente no tiene ya ningún caller esperándolo" — el candado de estas 2 partidas concretas
seguiría bloqueado hasta que caduque (5 min desde su claim) o el proceso se reinicie, aunque
Ollama en sí ya esté respondiendo con normalidad a peticiones nuevas de otras partidas.

---

## Reinicio real confirmado, el cuelgue PERSISTE — hipótesis del candado zombie refutada
(2026-09-04, madrugada, continuación directa de la sesión anterior)

La usuaria confirmó reinicio real del backend ("ya está reinciado"). Verificación inmediata:

1. Las 3 partidas colgadas de la noche anterior (`cmtlwx13g0044rik16vto9iqy`,
   `cmtm3qi4b0001rirshc899tlc`, `cmtm4a83r001urirsx95kob96`) siguen exactamente igual tras el
   reinicio (21/4/4 `LogEntry`, sin cambio) — esperado, un reinicio no revive turnos ya zombie,
   solo debería liberar el candado en memoria para turnos NUEVOS.
2. **Se creó una partida completamente nueva** (`cmtmjkmkv0001riduoyequbdn`), se eligió clase y se
   envió un turno de exploración simple ("Exploro con cuidado."). **El turno sigue sin resolverse
   tras 14+ minutos**, con `curl http://localhost:11434/api/ps` mostrando `{"models":[]}` durante
   TODA la espera (a diferencia de la sesión anterior, donde en algún punto sí aparecieron modelos
   cargados) — esta vez Ollama nunca llegó a cargar nada en absoluto, ni el modelo pequeño de
   clasificación.

**Esto refuta la hipótesis principal de la sesión anterior** (candado zombie en memoria de
`turnLock.ts` heredado de un proceso viejo) — un reinicio real mata el proceso y limpia
`turnClaims`/`inFlightClaimSet` por completo, así que un turno en una partida NUEVA nunca debería
toparse con ningún candado preexistente. Que se cuelgue igual, y que Ollama ni siquiera llegue a
cargar un modelo, apunta a que el fallo está en algún punto ANTES de la primera llamada HTTP real
a Ollama — candidatos revisados sin conclusión definitiva por lectura estática de código (sin
acceso a los logs reales del proceso backend, que corre fuera de este sandbox):
- `playerActionCount = await prisma.logEntry.count(...)` (`turnResolution.ts`, justo antes del
  guion de Gistera Koh) — consulta ORM trivial, sin timeout explícito, pero Postgres respondía con
  normalidad a consultas directas desde este mismo entorno durante todo el cuelgue.
- `recordEntityDiscoveries` (`entityDiscovery.ts`) — 5 `findMany` en `Promise.all`, sin ningún
  timeout, corre al FINAL de cada turno (no bloquearía la narración en sí, pero si el propio
  `narrateAndPersistTurn` no llega a este punto, tampoco es la causa raíz del cuelgue observado).
- Ninguna de las dos pistas es concluyente sin logs reales — **se necesita acceso a la salida de
  consola del proceso backend real** (dónde se queda colgado exactamente) para diagnosticar más
  allá de este punto. Recomendación: la próxima vez que se reproduzca, capturar/revisar esa salida
  en vivo mientras el turno está en curso, en vez de solo inferir desde Postgres/Ollama externos.

**Estado al cierre de esta ronda**: 4 partidas de prueba quedan con turnos colgados sin resolver
(`cmtlwx13g0044rik16vto9iqy`, `cmtm3qi4b0001rirshc899tlc`, `cmtm4a83r001urirsx95kob96`,
`cmtmjkmkv0001riduoyequbdn`) — las 4 se dejan sin tocar, como evidencia acumulada del patrón.

## CAUSA RAÍZ REAL — Ollama SÍ estaba arriba al arrancar, pero se cayó/colgó en algún punto
posterior sin que nada lo detectara ni relanzara

La usuaria compartió los logs reales de ambos procesos (backend Node y Ollama). Primera lectura
(incorrecta, corregida por la usuaria en el momento: "sí que estaba levantado") — Ollama se
arranca SIEMPRE primero vía `iniciar-tarkor.sh`, antes que backend y frontend, así que sí estaba
arriba al empezar la sesión de esta noche. Diagnóstico correcto:

- **Log del backend** (`req-15`, `POST /turn/classify`, 07:44:20): se envía y **nunca recibe
  respuesta** — es la última petición de turno del log, sin ningún `"res":{...}` que la cierre.
- **Log de Ollama**: el proceso **vuelve a arrancar/recargar el modelo a las 07:53:42** ("Listening
  on 127.0.0.1:11434", carga del modelo Qwen2.5 1.5B, warm-up) — esto es el **reinicio manual real
  que la usuaria hizo** al ver que el turno seguía sin resolver, no un primer arranque — confirma
  que en algún punto ANTES de las 07:44:20, Ollama dejó de responder de verdad (colgado o caído),
  pese a haber arrancado bien al principio de la sesión.
- **`iniciar-tarkor.sh` explica por qué nadie lo detectó**: el script comprueba
  `curl -s -o /dev/null http://localhost:11434` **una única vez, al arrancar** — si Ollama
  respondía en ESE momento, lo da por bueno para el resto de la sesión y nunca lo vuelve a
  comprobar ni relanzar. Si Ollama se cae/cuelga más tarde (crash real, u otro proceso lo mata,
  o simplemente deja de responder tras la sesión larga de pruebas de anoche con múltiples cuelgues
  ya vistos), nada en el flujo de arranque lo nota — el backend sigue enviando peticiones a un
  puerto que ya no tiene un proceso sano detrás.
- Una vez Ollama reinició de verdad (07:53:42), la generación real tardó solo 7.5s
  (`POST /api/generate` → `200 OK` en `7.51603226s`) — el modelo/GPU/llama-server funcionan bien
  una vez el proceso está sano; nunca fue un problema de rendimiento ni de código de Tarkor.

**Lo que queda genuinamente sin resolver**: por qué Ollama dejó de responder entre el arranque de
la sesión y las 07:44:20 — no hay logs de Ollama de ESE tramo (el log compartido empieza ya en el
reinicio de las 07:53:42), así que no se puede saber si crasheó, si algo lo mató, o si quedó en un
estado colgado sin caerse del todo. Todo el trabajo de diagnóstico de esta noche sobre
`turnLock.ts`/`ollamaQueue.ts`/`entityDiscovery.ts`/`playerActionCount` sigue siendo una pista
descartable para ESTE incidente concreto (el código de Tarkor respondió como se esperaba una vez
Ollama volvió a estar sano), pero el problema de fondo — Ollama puede caerse a mitad de sesión sin
que nada lo note ni lo recupere — sigue abierto y es real.

**Mejora real a considerar** (no urgente, para otra sesión): un chequeo periódico de salud de
Ollama (más allá del check único de `iniciar-tarkor.sh` al arrancar) que relance el proceso si deja
de responder, o al menos un aviso visible en vez de que el síntoma sea "el turno nunca vuelve".

**Las 4 partidas con turnos colgados de esta noche seguirán así para siempre** (sus peticiones ya
fallaron/expiraron del lado del backend en algún punto tras el timeout interno) — no hace falta
ninguna acción sobre ellas, son simplemente partidas de prueba desechables.

## Fix real: `/turn/classify` sin `try/catch`, dejaba la petición sin respuesta para siempre
(2026-09-04)

Reproducido de nuevo en la partida `cmtmk5wh8001uriduka9v86tp` (turno "Exploro con calma.",
06:13:48 UTC): cruzando el log del backend con el de Ollama se confirmó que Ollama SÍ generó y
devolvió la respuesta con éxito (7.3s, `POST /api/generate 200`), pero el `LogEntry` de respuesta
nunca se persistió — el backend se quedó "colgado" sin nunca enviar ni datos ni error al frontend.

Causa real: `resolveClassificationForTurn` (que engloba `classifyAction`) se llamaba en
`/turn/classify` (`backend/src/routes/turn.ts`) sin ningún `try/catch` a su alrededor. Cuando el
guard de `ollamaQueue` dispara (ver comentario en `ollamaQueue.ts`, mecanismo de autorrecuperación
del 31-08), lanza un error hacia el caller — pero como nada lo atrapaba aquí, la petición HTTP se
quedaba sin `reply.send()` para siempre. El guard de cola SÍ hacía su trabajo (liberaba la cola
para los turnos siguientes, por eso el resto del backend seguía sano), pero ESA petición concreta
del frontend quedaba huérfana sin ningún aviso.

**Fijado**: `try/catch` alrededor de `resolveClassificationForTurn` en `/turn/classify`
(turn.ts:641-673) — mismo patrón que ya usaba `/turn/narrate` (log real del error con
`request.log.error`, 500 genérico "Error clasificando el turno" al cliente). No arregla la causa de
fondo (Ollama sigue pudiendo colgarse alguna vez), pero convierte un cuelgue silencioso en un error
visible e inmediato que permite reintentar sin quedarte con la pantalla congelada sin explicación.
Compilado y verificado tras el reinicio real del backend (2026-09-04): `tsc -b` limpio, 2015/2016
tests backend en verde.

## Guard genérico de duración sospechosa — cierra la familia de bug de "banda larga inventada"
(2026-09-04)

Jugando en vivo (ronda de pruebas continuas) se reprodujo por 6ª vez la misma familia de bug: "Entro
en la cueva con el cuchillo en alto, listo para lo que sea." se clasificó como banda "larga"/4320 min
(3 días) — el modelo pequeño razonó "generalmente requiere un nivel de destreza alto para atravesar",
sin ningún anclaje real. Las 5 veces anteriores (búsqueda/descanso 2026-07-20, ataque 2026-07-21,
diálogo/intención hostil/aceptación verbal 2026-07-23/30) se parchearon enumerando el vocabulario
concreto que se coló — "entrar" no encajaba en ninguno de esos regex.

**Fix real, distinto de los anteriores**: en vez de otro parche de vocabulario, un guard GENÉRICO al
final de `resolveClassificationForTurn` (turn.ts:400-427) — cualquier acción que llegue hasta ahí con
banda no-instantánea y SIN duración explícita del jugador (`mentionsExplicitDuration`) queda topada a
60 min, sea cual sea el verbo. `travel`/ataque/combate ya deciden su propia duración antes de llegar
aquí, así que no se ven afectados.

**Dos tensiones reales encontradas escribiendo el guard, ambas resueltas por el camino correcto (no
por excepciones ad-hoc)**:
1. Ampliar `REST_REGEX` con "esper" para eximir "Espero aquí..." tuvo un efecto colateral: también
   activó el guard ORIGINAL (ya existía desde julio), que igualmente capaba a 60 min — revertido.
2. La solución real: 2 tests de `Territory.control` (Grupo 3) mockeaban `classifyAction` con una
   duración de 7 días reales para simular el salto de tiempo del Reino, pero el texto de prueba
   ("Espero aquí, dejando pasar los días tranquilamente.") no mencionaba el número — corregido el
   TEXTO del test a "Espero aquí **varios días**..." (ya reconocido por `EXPLICIT_DURATION_REGEX`),
   no el código de producción. Un salto de tiempo deliberadamente largo debe declararse con un
   número, igual que ya exige el guard original desde julio.

**Regresión colateral encontrada y cerrada de paso** (no relacionada con el guard, causada por el
rebalanceo del Orco Enfurecido de esta misma sesión, ver más arriba): 2 tests de saqueo del Orco
Enfurecido (`turn.integration.test.ts`) asumían su loadout viejo de 2 objetos (Maza orca + Amuleto de
hueso) — actualizados a los 3 objetos reales actuales (Maza orca + Vendaje improvisado + Ración de
carne ahumada).

**Verificado**: `tsc -b` limpio backend, suite completa **2015/2016 tests en verde** — el único fallo
restante (`"un ataque a algo sin nombre fuerza la sugerencia de reveal..."`, espera "Múrgol" con
`Math.random` mockeado a 0 y obtiene "Zense Ceniza") confirmado preexistente vía `git stash`
(falla exactamente igual sin ninguno de los cambios de hoy). **Hallazgo nuevo sobre este flake
concreto** (antes solo anotado como "sin causa confirmada" en memoria): no parece un flake de
aislamiento entre tests — con `Math.random` fijo a 0, "el primer candidato ponderado" de la región ya
no es Múrgol, sugiere que la lista real de candidatos ambientales cambió de peso/orden por los
`capturablePct` sembrados en sesiones recientes (Gesgurio 30%, etc.) desde que el test se escribió
(2026-09-03). Pendiente de investigar la función real de ponderación (`turnResolution.ts`, sugerencia
ambiental) en otra sesión — no se tocó hoy, fuera de alcance de este guard.

## Auditoría del sistema completo de guards de banda/duración (2026-09-04, agente Explore)

Tras cerrar el guard genérico de arriba, se lanzó un agente a auditar el sistema completo de guards
deterministas de `turn.ts` (orden, colisiones, redundancia, huecos previsibles, estructura para
futuros guards) — encontró un bug real de límite que el propio guard genérico había generalizado sin
darse cuenta.

**Bug real encontrado y CERRADO**: `bandaForMinutos` (travel.ts:248-253) usaba `< 60`/`< 1440` — con
`duracionEstimadaMinutos` capado EXACTAMENTE a 60 (el propio patrón que varios guards usan, "sin
duración explícita, tope de 60 min"), el clamp final derivaba banda `'extendida'`, no `'corta'`. No
solo cosmético: `computeDuration` (timedActions.ts:48) solo trata `'instantanea'` como gratis (1 min
de ficción) — con `'extendida'`/60 min sí se crea un `CharacterTransit` real de 60 min de ficción. El
guard genérico nuevo, pensado para evitar exactamente eso ("nunca crea una espera... por una frase
corta"), producía el resultado contrario para "entrar en la cueva" y cualquier acción parecida.
**Fix**: límites cambiados a `<= 60`/`<= 1440` (límite superior inclusivo). 2 tests actualizados
(`travel.test.ts`, `panels.test.ts`) que verificaban el comportamiento viejo en el borde exacto.

**Segundo fix relacionado, mismo hallazgo del agente**: el guard genérico solo capaba el NÚMERO a 60,
dejando que `bandaForMinutos` derivara la banda — para gestos siempre-instantáneos sin verbo
reconocido ("asomarse", "agacharse", "gritar", no cubiertos por `SEARCH_INTENT_REGEX`/`REST_REGEX`),
esto seguía creando un `CharacterTransit` real de banda "corta" en vez de instantánea. **Fix**: el
guard ahora fuerza `banda = 'instantanea'` directamente — pero con una exclusión explícita nueva para
`detectsSearchIntent`/`detectsRestIntent` (esas acciones SÍ pueden durar de verdad hasta 60 min sin
ser instantáneas, es intencional desde el guard original de julio; sin la exclusión, el guard
genérico corría después y pisaba esa decisión legítima, forzándola a instantánea también — colisión
real entre dos guards de la misma cadena, encontrada revisando el código con cuidado antes de aplicar
el cambio).

**Resto del informe del agente, sin cambios aplicados (documentado para referencia futura)**:
- Los guards 5-10 (ataque/diálogo/hostil/aceptación verbal/objeto propio/combate, todos con el mismo
  patrón "si tal intent y banda≠instantánea → forzar instantánea") NO se recomienda fusionarlos — cada
  uno documenta un bug real distinto con fecha y contexto; fusionar ahorraría líneas a cambio de perder
  trazabilidad de qué patrón concreto sigue colándose en producción (el `console.warn` de cada uno es
  distinto).
- Los guards de bloqueo total (`playerActionValidation.ts`, enganchados en turn.ts:556-648) ya siguen
  el orden correcto (regex puro sin BD primero, consultas a Prisma después) y sus solapamientos ya
  están resueltos y documentados en el propio código (ej. `detectsFabricatedNpcClaim` excluye diálogo
  para no confundir una réplica citada con un nombre inventado).
- Para el próximo guard de esta familia (7º verbo que se cuele): no introducir abstracción nueva
  todavía — el patrón de comentario largo + bloque explícito es una ventaja para este archivo, no
  deuda. Si se repite mucho más, un helper de una línea (`forceInstantaneous(classification, action,
  motivo)`) reduciría 2-3 líneas por guard sin perder el comentario explicativo de cada uno.

Verificado: `tsc -b` limpio, suite completa backend **2015/2016 en verde** (mismo único fallo
preexistente de "Múrgol" de arriba, sin relación).

## Combate múltiple ya expone el desglose real de dados (2026-09-04)

Auditoría con un agente ("buscar todas las tiradas de dados sin representar en el frontend", idea
explícita de la usuaria: "como si jugaras una partida D&D... cuando tiremos los dados me gustaría
representar siempre la tirada") encontró que el turno de la jugadora en combate múltiple SIEMPRE
tira con la misma mecánica que el 1v1 clásico (mismo `rollD20`, mismo cálculo de multiplicador de
tipo/malus/bono de habilidad vía `resolveExchange`/`resolveIndependentExchange`), pero
`resolverIntercambioCompleto` (`combateMultiple.ts`) solo usaba ese resultado para construir
`exchangeBlock` (texto para el Narrador) — el objeto estructurado con los números reales
(roll/atributo/dificultad/margen) se descartaba entero. El frontend ya sabía pintarlo
(`DiceRollReveal`/`CombatExchangeBadge`, mismos componentes del 1v1), pero nunca recibía datos para
mostrar en combate de grupo.

**Fijado**: `resolverIntercambioCompleto` ahora también devuelve `display: CombatExchangeDisplay`
(mismo shape que ya usa `turnResolution.ts` para el 1v1), construido a partir del `exchange`/
`independent` real de cada rama — nuevo parámetro `atacanteEsJugador` en la firma para que el
caller decida ese flag (`combateMultipleOrquestacion.ts`, vía `actual.tipo === 'JUGADOR'`).
Propagado por `TurnoAutonomoResultado.combatExchangeDisplay` (`null` en los caminos sin tirada real:
golpe gratis, invocación, avance sin atacar) hasta `narrateAndPersistTurn`, que ahora fija una
nueva variable `combatExchangeDisplayFinal` (separada de la `combatExchangeDisplay` original —
esa sigue viniendo `const` del 1v1 clásico vía `resolveCombatExchangePhase`, no se puede
reasignar) en el bloque `if (activeCombatEncounter)`, usada en los 3 puntos donde antes solo
importaba el 1v1: animación en vivo (`onExchangeResolved`), persistencia en `LogEntry.combatExchange`,
y el `return` final del turno.

**Verificado**: 2 tests unitarios nuevos en `combateMultiple.test.ts` (`display` en ambos caminos,
independiente y no-independiente) + 1 test de integración real contra Postgres en
`combateMultipleOrquestacion.integration.test.ts` (turno real de la jugadora en un `CombatEncounter`
real expone `combatExchangeDisplay` no-nulo con roll/atributo/resultado reales). `tsc -b` limpio
backend+frontend (el frontend no necesitó ningún cambio, ya leía el campo). Suite completa backend:
**2018/2019 en verde** (mismo único fallo preexistente de "Múrgol", sin relación). Pendiente
reverificar en vivo jugando un combate múltiple real tras el próximo reinicio del backend.

## Auditoría de progresión visual: XP de personaje, XP de profesión y reputación de facción (2026-09-04)

Petición explícita de la usuaria: que SIEMPRE se pinte en el log cuando suba XP de personaje, XP de
profesión (indicando qué oficio) o reputación de facción (indicando qué facción), con color verde
para positivo y rojo para negativo. Auditoría con un agente (Explore) mapeó los 3 sistemas —
`applyXp`/`progression.ts` (personaje), `awardProfessionXp` local en `turnResolution.ts` (profesión),
`applyFactionRepDelta`/`reputation.ts` (facción, `FACTION_REP_ATTACK_DELTA=-150`/
`FACTION_REP_PEACE_DELTA=+30`) — y encontró 5 huecos donde el dato se calculaba de verdad en
backend pero nunca llegaba al frontend, o llegaba y no se pintaba:

1. **XP de recompensa de misión sin sumar al chip**: `questCompletedInfo.rewardXp` se calculaba pero
   nunca se sumaba a `questRewardXp` antes de construir el `LogEntry` de misión completada.
2. **Misión que nace ya COMPLETADA (aceptación instantánea) sin aviso en el frontend**: `aceptarMision`
   (`api.ts`) no devolvía `questCompletedInfo` en su tipo de retorno, así que aunque el backend lo
   mandara, `GameView.tsx` no podía mostrarlo ni sumar el XP.
3-4. **XP de profesión invisible siempre**: `awardProfessionXp` calculaba `xpDelta`/`newLevel`/
   `leveledUp` por oficio pero el resultado se descartaba tras aplicarse a BD — ningún campo lo
   exponía en la respuesta HTTP del turno.
5. **Reputación de facción no subía en paz al completar misión**: el bloque de misión completada
   actualizaba `WorldState.factionsStatus` pero nunca llamaba a construir el `factionRepChange` que
   el frontend ya sabía pintar (a diferencia del combate, que sí lo hacía).

**Fijado**: nuevo campo `professionXpGains: { oficio, xpDelta, newLevel, leveledUp }[]` propagado
desde `turnResolution.ts` (transacción Prisma → `NarrateAndPersistResult` → `return` final) hasta
`turn.ts` (las 2 rutas que devuelven resultado de turno) → `api.ts` (`NarrateResponse`) →
`useTurnFlow.ts`/`useCombatFlow.ts` (toman `professionXpGains[0]` como `LogEntry.professionXpGain`,
singular) → `LogPanel.tsx` (chip nuevo `+N XP <nombre de oficio>` vía `professions` catálogo, con
"(nivel X)" si subió de nivel). `questRewardXp` corregido para sumar `rewardXp` real. `aceptarMision`
ahora devuelve `questCompletedInfo` y `GameView.tsx` lo consume (log + suma de XP). El bloque de
misión completada ahora también fija `factionRepChange` con `FACTION_REP_PEACE_DELTA`.

**Verificado**: `tsc -b` limpio backend y frontend. Suite frontend completa: **192/192 en verde**.
Suite backend unitaria: **1793/1793 en verde**. Suite backend de integración: **225/226 en verde**
(único fallo: el mismo flake preexistente de "Múrgol" de la sección anterior, confirmado que falla
igual en aislamiento y que no toca ningún archivo tocado por esta auditoría — ver
`tarkor_flake_reveal_candidato_murgol_2026-09-04.md` en memoria). Pendiente reverificar en vivo
jugando: crafteo/construcción real para ver el chip de XP de profesión, una misión resuelta en paz
para ver el chip verde de reputación, y la misión de Gistera/Orco Enfurecido (aceptación instantánea)
para ver el chip de recompensa de misión — los 3 casos requieren reiniciar backend y frontend
primero.

## Habilidad "Comer/Beber": Hambre/Sed reales en el HUD, actualizadas en vivo (2026-09-04)

Petición de la usuaria: mover las barras de Hambre/Sed al HUD principal, junto a Energía.
Investigando se encontró que el sistema real era más limitado de lo que parecía: Hambre/Sed ya
existían como pool derivado del tiempo (`comidaPct`/`aguaPct`, desde `Save.lastAteAtMinutes`/
`lastDrankAtMinutes`), pintado solo en `EstadisticasPanel.tsx` y refrescado solo al cargar
partida — **nada en el motor actualizaba esos timestamps nunca dentro de una partida real**, y el
único item de agua del catálogo (Odre de agua) es una herramienta equipable que nunca se consume.

**Diseño acordado con la usuaria**: una única habilidad determinista "Comer/Beber" (no dos
separadas), clonando la arquitectura exacta de "Curar" — botón siempre visible → modal con dos
secciones (Comida/Bebida) → vista previa en vivo que bloquea seguir añadiendo al llegar al 100% →
texto de acción fijo + payload estructurado → turno resuelto sin pasar por el LLM. Comida sale de
items reales del inventario (`curaHambre` nuevo en `ItemCatalog`, aplicado a 6 consumibles reales:
raciones de carne/viaje/goirntes, pan de trigo escarlata, carne de Jusha ahumada). Bebida es una
entrada fija "Beber agua", siempre disponible sin depender de ningún item, que repone sed al 100%
de un tirón.

**Fijado**: `lastAtMinutesForGanancia` (companionSupervivencia.ts) — inversa de
`porcentajeSupervivencia`, calcula el nuevo timestamp que produce el pct objetivo tras sumar una
ganancia. `turnResolution.ts` calcula `hambre`/`sed` resultantes dentro de la transacción del
turno (mismo patrón que `energia`/`energiaMax`) y los expone en la respuesta HTTP de punta a punta
(`routes/turn.ts` → `api.ts` → `useTurnFlow.ts`/`useCombatFlow.ts`). Nuevo modal
`HungerThirstSelectionModal.tsx` (clon de `HealSelectionModal.tsx`) y nuevos `HungerBar`/
`ThirstBar.tsx` en el HUD junto a `EnergyBar`, coloreados por umbral (rojo <25%, ámbar <50%, verde
resto) igual que `ResourceBar`.

**Gotcha real encontrado verificando**: tras editar `worldCatalog.ts` con los nuevos `curaHambre`,
el test de integración fallaba con `lastAteAtMinutes` sin cambiar — la BD real de Postgres no
recoge cambios de `worldCatalog.ts` hasta correr `npm run seed-catalog` a mano; no es un bug del
código, es el mismo catálogo desactualizado que cualquier edición de `worldCatalog.ts` exige
re-seedear antes de que los tests de integración (o la partida real) lo vean.

**Verificado**: `tsc -b` limpio backend y frontend. Tests unitarios nuevos: `lastAtMinutesForGanancia`
(companionSupervivencia.test.ts, 5 casos) y `applySequentialHunger`/`applySequentialThirst`
(hungerThirst.test.ts, espejo frontend, 5 casos). 1 test de integración real (turno completo:
come una ración + bebe agua, confirma `hambre`/`sed` en la respuesta HTTP, timestamps persistidos,
inventario descontado, narración determinista). Suite completa backend: **1798 unitarios + 226/227
integración en verde** (único fallo: el mismo flake preexistente de "Múrgol", confirmado sin
relación). Suite frontend completa: **197/197 en verde**. Pendiente reverificar en vivo jugando
tras reiniciar backend y frontend: abrir el modal, comer una ración + beber agua, confirmar que el
HUD sube Hambre/Sed y el log muestra la narración determinista.

## Diario en pestañas jerárquicas Año → Estación → Día (2026-09-04)

Ya estaba anotado como nota de diseño decidida por la usuaria en la sesión de pruebas jugando en
vivo del 2026-09-03: el Diario mostraba el registro completo de la partida como una lista larga
continua, solo agrupada visualmente por "Día N" (headers sticky), sin ningún filtro real. Se pidió
reorganizarlo en pestañas jerárquicas Año → Estación → Día que de verdad filtren el contenido.

Investigando se encontró que el calendario ficticio del juego ya derivaba Estación desde
`fictionalMinutes` pero **nunca calculaba Año** (se descartaba el cociente), y que el "Resumen por
capítulos" (LLM cada 15 turnos) no tenía ninguna fecha asociada — vivía como bloque fijo aparte,
cargado por separado en `GET /saves/:id` (`chapters`).

**Diseño acordado con la usuaria**: etiquetado "Año 1 / Primavera / Día 3 de esa estación" (cada
nivel numerado dentro de su padre; el Día de la pestaña es RELATIVO a la estación, 1-30, no el día
absoluto de partida). Dentro de una Estación, solo pestañas de Día con entradas reales (sin ruido
de días vacíos). Los capítulos se fechan de verdad (`SessionSummary` gana `fictionalMinutes`) y se
intercalan dentro de la pestaña de Día que les corresponde, con estilo distintivo — no bloque fijo
aparte. La carga aparte de `chapters` en `GET /saves/:id` se elimina — el Diario se autoabastece.

**Fijado**: `yearFor`/`diaRelativoEnEstacionFor`/`calendarioFor` nuevas (worldClock.ts), junto a
`estacionFor` ya existente. `SessionSummary.fictionalMinutes Int?` nuevo (nullable — capítulos
viejos se quedan "sin fecha", no se les inventa una). `GET /saves/:id/diario` fusiona `LogEntry` y
`SessionSummary` en una sola respuesta `{ entries: DiarioItem[]; unplacedChapters: [...] }`, cada
`entries` con `year`/`estacion`/`diaRelativo` ya resueltos y un discriminador `kind: 'entry' |
'chapter'` para intercalarlos por `createdAt`. `DiarioPanel.tsx` rediseñado con 3 niveles de
pestañas locales (`useState`, no controladas desde `GameView.tsx`), reutilizando el patrón visual
de `PersonajePanel.tsx` — selecciona por defecto el Año/Estación/Día más reciente con contenido, y
cambiar de Año/Estación resetea en cascada el nivel siguiente.

**Verificado**: `tsc -b` limpio backend y frontend. Tests unitarios nuevos en `worldClock.test.ts`
(`yearFor`/`diaRelativoEnEstacionFor`/`calendarioFor`, casos límite de cruce de año/estación). 1
archivo de test de integración nuevo (`log.integration.test.ts`, 3 casos: entradas con
year/estacion/diaRelativo coherentes, capítulo fechado intercalado con `kind: 'chapter'`, capítulo
sin fecha en `unplacedChapters`) — en verde ejecutado solo y junto a `turn.integration.test.ts`.
Suite completa backend: unitaria 1807/1807, integración con contención transitoria puntual en
alguna corrida bajo carga (mismo gotcha ya documentado de Postgres/contención entre archivos, no
una regresión — repetido varias veces con solo el flake de "Múrgol" restante). Suite frontend
completa: 197/197 en verde. Pendiente reverificar en vivo jugando: abrir Diario, confirmar
pestañas Año/Estación/Día, que el día por defecto es el más reciente con contenido, y que un
capítulo generado (15+ turnos) aparece intercalado en su día real.

## Barras de habilidades múltiples General/Profesión/Reino, tipo WoW (2026-09-04)

La usuaria notó que "Comer/Beber" no aparecía en la barra de habilidades del composer — investigado,
no era un bug: la partida se creó antes de que esa habilidad existiera, y las habilidades se
persisten una sola vez sin reconciliación posterior. Aparcado ese backfill puntual, se retomó una
idea ya anotada (`tarkor_idea_barra_habilidades_fuera_combate_2026-08-29`): sustituir la barra
única y fija de siempre (`SkillBar.tsx`, solo `category: 'general'`, sin límite de slots) por un
sistema de **múltiples barras configurables** tipo hotbar de WoW, en 3 categorías: General,
Profesión, Reino (Combate sigue con su cinturón propio, sin tocar).

**Diseño acordado**: hasta 3 barras por categoría (1 base + 2 adicionales), nombre editable, 12
slots por barra, asignación por selección/drag&drop clonando el patrón ya construido de
`CombatAbilityBelt.tsx`/`CombatAbilityToggleGrid`. Navegación en una sola superficie que se
sustituye a sí misma (nunca popups anidados): botón del composer → menú de tipo (General/Profesión/
Reino/Escribir) → elegir tipo sustituye por menú de barras de ese tipo (botón Atrás en la
cabecera) → elegir barra la muestra en el HUD, con botón ⌨️ directo de vuelta al composer.

**Fijado**: tabla `SkillBar` nueva (Prisma), servicio puro `skillBars.ts` (mismo espíritu que
`combatAbilities.ts`, sin el concepto "genérica"). Endpoints nuevos en `routes/saves/skillBars.ts`
(crear/renombrar-reemplazar contenido/borrar/marcar activa). `GET /saves/:id` garantiza en lectura
que ninguna categoría llegue sin su barra base (partidas viejas como Gorhorn, reconciliación
idempotente, sin migración de datos que sembrar a mano) y expone `skillBars`/`activeSkillBarId`.
Frontend: `SkillBarMenu.tsx` (máquina de 4 pantallas sustituyendo el booleano `showSkillBar` de
antes), `SkillBarHud.tsx` (vista de barra activa, sustituye a `SkillBar.tsx`, ya eliminado),
`SkillBarEditor.tsx` (modo edición, clon de `CombatAbilityBelt.tsx` + input de renombrar).

**Verificado**: `tsc -b` limpio backend y frontend. Tests unitarios nuevos: `skillBars.test.ts`
(11 casos: saneado, categorías base faltantes, próximo slot libre). 1 archivo de test de
integración nuevo (`skillBars.integration.test.ts`, 4 casos: `GET /saves/:id` crea las 3 barras
base la primera vez e idempotente después, POST hasta el tope de 3, PATCH renombra+sanea, DELETE
bloquea la barra base y limpia `active-skill-bar` al borrar la activa) — en verde solo y junto a
otros tests de integración de `saves/`. `detail.test.ts` (unitario, mock de Prisma) actualizado con
el mock de `skillBar`. Suite completa backend: **1818 unitarios + 233/234 integración en verde**
(único fallo: el mismo flake preexistente de "Múrgol", confirmado sin relación, reproducido en
corridas repetidas con contención transitoria bajo carga que desaparece al repetir). Suite frontend
completa: **197/197 en verde**. Pendiente reverificar en vivo jugando tras reiniciar backend y
frontend: pulsar el botón de habilidades, navegar General → ver "Barra 1" ya creada sola →
seleccionarla → editar (arrastrar/activar habilidades) → confirmar que persiste tras F5 → crear
una segunda barra → renombrarla → confirmar que Atrás vuelve al menú de tipos y ⌨️ vuelve directo
al composer.

## Bug real: iniciativa ausente en el turno que ABRE combate (2026-09-04)

Hallazgo jugando: en el primer turno de un combate (el que lo abre) no se veía el badge de
iniciativa, aunque sí aparecía a partir del segundo intercambio o recargando la página. Investigado
a fondo (no confundir con [[tarkor_bug_iniciativa_ausente_reaparece_2026-08-29]], un bug distinto
ya cerrado el 2026-08-29 — este es nuevo). Backend calcula y persiste `nextInitiativeRoll`
correctamente desde siempre, incluida la emboscada (`turnResolution.ts`, arreglado 2026-08-28); el
dato SÍ llega en la respuesta HTTP del turno (`routes/turn.ts`, `NarrateResponse`). El bug era 100%
de wiring en frontend: `useTurnFlow.ts` (el turno que abre combate) nunca destructuraba ni aplicaba
`nextInitiativeRoll` al estado — solo `handleCombatTurnResolved` (`useCombatFlow.ts`, turnos DENTRO
de un panel ya abierto) lo hacía — y `openCombat()` resetea `lastInitiativeRoll` a `null` al abrir
el panel, sin que nada la repoblara para ese primer turno.

**Fijado**: `useTurnFlow.ts` gana el parámetro `setLastInitiativeRoll` (mismo setter ya usado por
`useCombatFlow.ts`, ahora compartido entre los dos hooks), destructura `nextInitiativeRoll` de la
respuesta y lo aplica junto a `setCombateIniciado` — mismo patrón exacto que el fix ya aplicado
antes para `esperandoDefensaJugador` (mismo hueco, mismo turno de apertura, auditoría 2026-08-23).

Nota aparte, aclarada con la usuaria: la petición "que todas las tiradas sean visibles" ya se
aplicó — cubre combate múltiple (ver sección "Combate múltiple ya expone el desglose real de
dados" arriba) y el resto de tiradas normales de ataque/defensa (`DiceRollReveal`/
`CombatExchangeBadge`). Este bug de iniciativa es un caso aparte no cubierto por esa auditoría
anterior (que buscaba tiradas SIN NINGÚN dato viajando al frontend; aquí el dato sí viajaba, solo
se perdía en el wiring de React).

**Verificado**: `tsc -b` limpio. 1 test unitario nuevo en `useTurnFlow.test.tsx` ("el turno que abre
combate aplica la iniciativa recibida, no solo los turnos siguientes"). Suite frontend completa:
**198/198 en verde**. Pendiente reverificar en vivo jugando: iniciar un combate nuevo y confirmar
que el badge de iniciativa aparece desde el primer intercambio, no solo desde el segundo.

## Sistema unificado de tirada de dados en vivo — todas las tiradas del juego (2026-09-04)

A raíz del bug de iniciativa de arriba, la usuaria aclaró que "tiradas visibles" significaba algo
más profundo: que el EFECTO de los dados (animación en vivo, "como en D&D... que sucede de
verdad") se viera en todas las tiradas mecánicas del juego, no solo el resultado final ya puesto en
un badge estático. Mapeo completo: ataque/defensa (1v1 y múltiple) y recolección ya animaban;
iniciativa (1v1 y múltiple), turno normal, Huir (pre/mid-combate) y Tameo/captura no.

**Diseño acordado**: combate/recolección ya tienen streaming NDJSON real (el dado gira mientras el
backend sigue trabajando); turno normal/Huir/Tameo son peticiones HTTP normales de una respuesta —
**sin añadirles streaming**, se monta el mismo componente de dado justo al recibir la respuesta ya
completa (indistinguible visualmente del streaming real). Iniciativa (1v1 y múltiple) se enriquece
en el CÁLCULO real: malus por condición física y `attributeBonus` sí entran en juego, **sin**
multiplicador de tipo (la rueda de debilidades no tiene sentido semántico cuando ambos lados
siempre tiran Destreza contra Destreza) — cambio de balance real, aprobado explícitamente.

**Fijado**:
- `frontend/src/components/DiceRoll.tsx` (nuevo) — núcleo genérico extraído de la lógica antes
  privada de `DiceRollReveal.tsx`: `DiceFace` (un lado, animación de tick), `DiceRollSingle` (un
  solo dado, sustituye a `RollBadge` cuando se anima), `DiceRollVs` (dos lados enfrentados, mismo
  layout que ya tenía combate). `DiceRollReveal.tsx` se reduce a wrapper fino sobre `DiceRollVs`.
  `GatheringDiceReveal.tsx` (recolección) mantiene su JSX propio, solo reimporta las constantes de
  cadencia desde el nuevo sitio.
- `backend/src/services/combatExchange.ts` — extraída `rollAttributeCheck` (la fórmula real de
  `rollSide`, parametrizada por el multiplicador ya calculado); `rollSide` la llama con la rueda de
  tipos, `rollInitiative` con `multiplicador=1` fijo. `InitiativeResult` enriquecido:
  `{ganador, jugador: ExchangeSideResult, npc: ExchangeSideResult}` en vez de dos números planos.
- `backend/src/services/combateMultiple.ts` — `rollInitiativeMultiple` reusa la misma función;
  `CombatienteIniciativa` gana `condicionFisica`; `IniciativaEntry` se aplana con los campos de
  `ExchangeSideResult`.
- `frontend/src/components/CombatPanel.tsx` — el badge de iniciativa (texto plano) pasa a
  `DiceRollVs` real, copy explicativo fuera del componente.
- `frontend/src/components/LogPanel.tsx` — turno normal/Huir: `entry.roll` anima con
  `DiceRollSingle` la primera vez que se ve en la sesión (`liveEntryIds`), `RollBadge` estático el
  resto (recarga, Diario, turnos ya vistos antes). `frontend/src/pages/GameView.tsx` —
  `liveRevealedIdsRef` + wrapper de `setCharacterLog` que detecta automáticamente ids nuevos por
  comparación de arrays (no hubo que tocar los 15+ call-sites que ya llaman `setCharacterLog`);
  `syncFromSave` usa el setter crudo (`setCharacterLogRaw`) para que la carga inicial nunca anime.
- `frontend/src/components/TameoModal.tsx` — bloque estático sustituido por `DiceRollVs`, mapeando
  `OpposedRollInfo` con el nuevo helper `opposedRollToSides` (`frontend/src/lib/dice.ts`) — sin
  cambios backend, `OpposedRollInfo` ya exponía los rolls crudos por separado.
- `RollBadge.tsx` se mantiene explícitamente como modo histórico/estático (Diario, recarga), no se
  elimina — comentario de cabecera actualizado documentando ese cambio de rol.

**Verificado**: `tsc -b` limpio backend y frontend. Tests backend: `combatExchange.test.ts`
(`describe('rollInitiative')` reescrito, 5 casos: gana quien saca más, NPC puede ganar, empate
gana jugador, malus por condición cambia el ganador, nunca aplica multiplicador de tipo).
`combateMultiple.test.ts` (`describe('rollInitiativeMultiple')`, +1 caso de malus por condición).
2 tests de `turn.integration.test.ts` actualizados al nuevo shape de `initiativeRoll` (antes
esperaban `jugadorTirada`/`npcTirada` planos). Suite completa backend: **1821 unitarios + 233/234
integración en verde** (único fallo: el mismo flake preexistente de "Múrgol", sin relación).
Suite frontend completa: **198/198 en verde**. Pendiente reverificar en vivo jugando: iniciativa
animada al abrir combate (con malus visible si no estás ILESO), una acción de texto libre con
tirada anima el dado antes de revelar el resultado, Huir (pre y mid-combate) igual, un intento de
Tameo anima ambos lados del "vs", y que recargar la página / ver el Diario muestra las tiradas ya
pasadas sin volver a animar.

## Ronda de fixes tras jugar en vivo: scroll a tiradas, panel adelantado, racial de NPC (2026-09-04)

Tres hallazgos reales jugando la partida de Gorhorn tras las piezas de arriba.

**1. Scroll automático a cada tirada en vivo** (`frontend/src/components/DiceRoll.tsx`) — petición
explícita: "donde se este ejecutando la tirada de dados el foco y el scroll deben apuntar a ese
elemento que noto que a veces me lo pierdo... por ejemplo en el de iniciativa en combate".
Centralizado en `DiceRollSingle`/`DiceRollVs` (se montan de cero en cada tirada nueva, cubre turno
normal/combate/iniciativa/Tameo a la vez) vía un `useScrollIntoViewOnMount` interno, sin `.focus()`
(mismo criterio ya documentado en `CombatPanel.tsx`: robar el foco en combate es más intrusivo que
útil). **Ajuste real tras la primera pasada** (captura real: el bloque de la tirada quedaba
parcialmente tapado por el header del panel) — `block: 'nearest'` no completaba el ajuste si el
elemento ya estaba parcialmente visible, y el scroll podía perder la carrera contra el
`contentScrollRef.current?.scrollTo({top:0})` que `CombatPanel.tsx` ya ejecuta al montarse. Fijado
con `block: 'center'` + `setTimeout(0)` (empuja el scroll de la tirada al tick siguiente, así gana
siempre sea cual sea el orden real de los `useEffect` de padre/hijo).

**2. Panel de combate adelantándose a la animación de iniciativa** (`frontend/src/hooks/useCombatFlow.ts`,
`handleCombatTurnResolved`) — captura real: el título "COMBATE — ATAQUE", el tinte del panel y la
ficha del rival (condición/vida) ya habían cambiado mientras el dado de iniciativa seguía mostrando
"?" en el lado enemigo. Causa: `combatAwaitingDefense`/`combatNpcStates` se aplicaban en el mismo
`setState` síncrono que `lastInitiativeRoll`, sin esperar los `2×ROLL_DURATION_MS` (10s) que tarda
`DiceRollVs` en animarse. Fijado: con una tirada de iniciativa real que mostrar
(`nextInitiativeRoll` no nulo), ese bloque de estado visual se retrasa con un `setTimeout` hasta que
la animación termina; sin tirada (turno forzado sin ella, ej. Aturdimiento) se aplica de inmediato
como siempre. Guard añadido para `finDePartida` en el mismo turno (caso límite: el `setTimeout`
tardío no debe reabrir visualmente un combate ya cerrado). 3 tests nuevos en
`useCombatFlow.test.tsx` con el patrón de fake timers ya validado (`vi.advanceTimersByTimeAsync` +
`act(async () => {})`, documentado en `tarkor_cobertura_hooks_frontend_2026-09-03`).

**3. "Sangre del Estallido" seguía usándose en combate por NPC** — reportado jugando: "el orco
enfurecido uso esta habilidad que juraría que la descatalogamos... revisa si hemos agregado la
clase guerrero para que use esas habilidades y no esa que creo que era racial". Confirmado: el Orco
Enfurecido ya tiene `clase: GUERRERO`/`especializacion: BERSERKER` real en el catálogo
(`worldCatalog.ts`), pero `npcCombatAbilitiesFor` (`backend/src/services/npcCombatAbilities.ts`)
seguía añadiendo incondicionalmente las 2 habilidades raciales activas viejas ("Sangre del
Estallido"/"Piel de Guerra") a CUALQUIER NPC con `raza`, tenga o no clase — el mismo camino que se
cerró para el JUGADOR el 2026-09-01 (sustituido por una pasiva única, `racialPassives.ts`) nunca se
tocó en el lado NPC. Decisión explícita de la usuaria: quitarlo de todo NPC, mismo criterio que el
jugador (nunca deja a nadie sin nada usable — Ataque base y Esquivar/Defenderse/Descansar son
incondicionales). `BerigRazaInfo.habilidadesRaciales` (`berigLore.ts`) se deja intacto, sigue siendo
lore/dato de referencia.

**Verificado**: `tsc -b` limpio backend+frontend. Backend: 1842/1842 unitarios + 233/234 integración
(único fallo: flake preexistente de Múrgol, sin relación — 1 fallo adicional de contención puntual
en `combateMultipleOrquestacion.integration.test.ts` en la primera pasada, no reproducido en la
segunda ni en aislamiento). 2 tests de ese archivo actualizados: el roster real de ataque del
Chamán/Opresor pasó de 5 a 4 elementos al quitar la racial, secuencia de `Math.random` mockeada
recalculada contra el orden real del catálogo (confirmado con un script de depuración desechable,
no adivinado). Frontend: 201/201 (198 + 3 nuevos). Pendiente reverificar en vivo: la tirada de
iniciativa queda centrada en pantalla sin cortes; el panel espera a que el dado termine antes de
cambiar de color/título; el Orco Enfurecido (y cualquier NPC orco/humanoide) ya no usa "Sangre del
Estallido"/"Piel de Guerra" en combate.

## Reputación de facción: solo en la decisión final, no al dejar CONVALECIENTE (2026-09-04)

Reportado jugando en vivo, con captura real: el chip "-150 Clan Serhu" aparecía en el turno que
dejaba al Orco Enfurecido CONVALECIENTE, antes de elegir Matar/Capturar/Clemente. Petición
explícita: "si elijo matar tiene que esperar a que resuelva el combate antes de restarlo, en el
turno final".

**Causa real**: `applyKillSideEffects` (`turnResolution.ts`) aplicaba `FACTION_REP_ATTACK_DELTA`
(-150) con cualquier `esGolpeDeMuerte` — que incluye tanto CONVALECIENTE como MUERTO. Rematar
después duplicaba el descuento; elegir Clemente nunca lo revertía.

**Fijado**: la reputación solo se resta cuando `nuevaCondicion === 'MUERTO'` (matar directo con
LETAL, o rematar un CONVALECIENTE — ambos son la misma decisión final). Capturar y Clemente ganan
su propio delta asimétrico (petición explícita de magnitudes: Matar -150, Capturar -100, Clemente
-50), aplicado en el endpoint real de cada decisión (`companeros.ts`/`session.ts`), nunca al golpe
que solo derrota. Capturar además gana su primer `LogEntry` propio (antes era una mutación
silenciosa, sin ningún rastro en el log) — mismo patrón que Clemente, para que el chip de
reputación tenga dónde colgarse. Helper compartido nuevo,
`applyFactionRepDeltaForResolution` (`turnResolution.ts`, exportado), usado por los 3 caminos.

**Verificado**: `tsc -b` limpio backend+frontend. Test de integración existente actualizado (dejar
CONVALECIENTE ya no resta nada, `factionRepChange: null`) + test nuevo que confirma que rematar a
MUERTO sí resta -150 de verdad. Backend: 1842/1842 unitarios + 234/235 integración (único fallo:
flake preexistente de Múrgol, sin relación). Frontend: 201/201. Pendiente reverificar en vivo:
dejar a un enemigo CONVALECIENTE no debe mover el panel de Reputación; Matar/Capturar/Clemente cada
uno con su propio chip y magnitud en el log.

## Bucle infinito de renders bloqueaba la navegación al salir de la partida (2026-09-04)

Reportado tras añadir el modal de confirmación al salir: "le doy a salir, la URL se actualiza pero
no vuelve a la selección de partida... si recargo me lleva a las partidas, sino no". Reproducido
con Playwright, consola con `console.error = ...` interceptado para capturar el stack real:
`Maximum update depth exceeded` desde el primer instante en que carga `GameView`, no solo al pulsar
Salir.

**Causa real**: `setCharacterLog` (wrapper de detección "tirada en vivo", pieza anterior de esta
sesión) era una función NUEVA en cada render — sin `useCallback`. Un `useEffect` en
`useEntityBanner.ts` la lista como dependencia (`[enciclopediaIndex, setCharacterLog, setWorldLog]`)
y la llama de vuelta al ejecutarse — sin memoizar, el efecto se disparaba en cada render, y cada
disparo forzaba otro render → bucle infinito que saturaba React lo suficiente como para que la
navegación de React Router nunca llegara a completarse visualmente (la URL SÍ cambiaba de verdad,
confirmado con `[framenavigated]` en Playwright, pero la vista se quedaba en `GameView`).

**Fijado**: `setCharacterLog` envuelto en `useCallback(..., [])`. Confirmado con Playwright
antes/después: 0 errores de "Maximum update depth" tras el fix, navegación completa hasta "Sus
partidas" en la misma ejecución.

**Verificado**: `tsc -b` limpio, 201/201 tests frontend en verde. Confirmado en vivo con
Playwright (no solo en tests) — capturas antes/después adjuntas al hallazgo. Ya no debería
reproducirse manualmente, pero si vuelve a verse "la URL cambia pero la vista no", revisar primero
la consola del navegador por "Maximum update depth exceeded" antes de asumir un bug de routing.

## Legend "Tirada de iniciativa" en el log + fix de malus de condición física (2026-09-04)

Dos hallazgos de la misma captura jugando en vivo.

**1. Legend visual**: petición explícita — distinguir en el log de narración cuál tirada es la de
iniciativa (la que decide quién actúa primero al abrir combate) del resto de tiradas de turno
normal, que comparten el mismo componente genérico (`DiceRollSingle`/`RollBadge`). Fijado en
`LogPanel.tsx`: aparece un legend "Tirada de iniciativa" cuando la entrada trae `initiativeRoll`
(señal real de que este turno, además de resolver la acción, calculó quién actúa primero —
emboscada real al abrir combate), nunca en un turno normal cualquiera con `roll` a secas.

**2. Bug real de balance, encontrado revisando la misma captura**: el Orco Enfurecido, ya GRAVE,
seguía mostrando "-2sal" en el malus de condición física de esa tirada de iniciativa — el malus de
HERIDO, no el de GRAVE (-5, `CONDICION_MALUS` en `death.ts`). Causa: `resolveCombatExchangePhase`
(`turnResolution.ts`) calculaba la iniciativa del PRÓXIMO intercambio con la condición física de
los PARÁMETROS DE ENTRADA (la de antes de este mismo golpe), en vez de la ya actualizada por el
golpe que acaba de resolverse en el propio intercambio. Mismo bug simétrico en el lado del jugador.
Fijado reutilizando `nextCondicionForAttack` (ya usada para calcular `npcTargetNewCondicion`) para
derivar la condición real de ambos lados justo antes de `rollInitiative`. El camino de "emboscada
en el turno de apertura" (sin ningún golpe previo ese mismo turno) no tenía el bug — se dejó igual.

**Verificado**: `tsc -b` limpio backend+frontend. Test de integración nuevo que reproduce el bug
real (ataca hasta dejar al Orco GRAVE, confirma malus=5 en `initiativeRoll.npc`) — confirmado que
detecta el bug de verdad revirtiendo el fix temporalmente y viendo el test fallar con `2` en vez de
`5`, luego restaurado. Backend: 1842/1842 unitarios + 125/126 integración de `turn.integration.test.ts`
(único fallo: flake preexistente de Múrgol) + flake intermitente ya visto en
`combateMultipleOrquestacion.integration.test.ts` (aleatoriedad real sin mock, no relacionado con
este cambio — confirmado reejecutando 3 veces en aislamiento, 1/3 fallos). Frontend: 203/203 (201 +
2 nuevos del legend) — de paso, `cleanup()` explícito añadido a `LogPanel.test.tsx` (sin
`globals:true` en vitest.config.ts, dos `render()` en tests distintos se acumulaban en el DOM, dio
un falso positivo real al escribir el primer test del legend). Pendiente reverificar en vivo: el
legend aparece solo en la tirada de apertura de combate, y el malus de condición física en esa
tirada coincide con la condición REAL del NPC en ese momento (GRAVE=-5, no HERIDO=-2).
