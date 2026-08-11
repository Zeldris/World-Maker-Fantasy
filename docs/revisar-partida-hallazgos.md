# Revisar partida — hallazgos

Registro cronológico (más antiguo arriba, añadir SIEMPRE al final) de lo que se ha encontrado cada
vez que se ejecuta el runbook de `revisar-partida.md` sobre una partida real. Objetivo: antes de
reportar algo como "nuevo", mirar aquí si ya se vio y qué se decidió — evita re-investigar lo mismo
dos veces y deja claro qué clases de fallo ya tienen detector determinista y cuáles siguen abiertas.

Cada entrada: fecha, qué se detectó (cita textual si es narración), causa raíz, y estado.

---

## 2026-08-01 — descansar no curaba + objeto médico narrado sin usarse

**Síntoma**: "descansar no funcionó, además consumió objetos sin pedirlo". Narración: *"Agarra la
cataplasma de salvia del polvo y aplica una fina capa en una herida abierta"* sin que la jugadora
lo pidiera y sin que el objeto se consumiera de verdad (seguía en el inventario).

**Causa raíz**: (1) `healCeilingFor` excluye a propósito INCAPACITADO/MUERTO de la curación por
descanso — **decisión de diseño confirmada, no es bug**, se queda así. (2) La narración alucinó el
uso de un objeto real sin que `detectMedicalItemUse` lo hubiera detectado en la acción del jugador.

**Estado**: FIJADO. `hasFalseItemUse` (narrador.ts) — post-hoc, por frase: verbo de consumo + nombre
real de un objeto médico/de energía que no se detectó usado este turno → reintento. Ver
`tarkor_curacion_incapacitado_y_objeto_falso_2026-08-01.md` (memoria).

---

## 2026-08-01 — el orco ya muerto "volvió a aparecer"

**Síntoma**: "el orco que metí volvió a aparecer". Con el Orco Enfurecido `MUERTO`+`saqueado` desde
hacía varios turnos, "Exploro la zona" narró: *"una mirada al oeste revela un conjunto de huellas
recientes... Gorhorn reconoce el paso de un orco — probablemente el Orco Enfurecido."*

**Causa raíz**: puramente narrativo (DB correcta). `npcSceneBlockFor` ya instruye "no lo narres
como amenaza activa... nunca un encuentro nuevo" para NPCs ya resueltos, pero el modelo la ignoró.

**Estado**: FIJADO. `hasResurrectedDeadNpc` (narrador.ts) — vocabulario de presencia activa/reciente
("huellas recientes", "reconoce el paso de", "sigue vivo", "reaparece"...) + nombre del NPC en la
misma frase → reintento. Ver `tarkor_npc_muerto_resucita_narracion_2026-08-01.md`.

**Efecto secundario descubierto al investigar** (no era solo narrativo): `agresivoSlugsInScene`
(turnResolution.ts) tampoco miraba `condicionFisica` — un NPC muerto podía reabrir
`pendingCombatNpcSlugs`/`combateIniciado` DE VERDAD, no solo en el texto. Ver siguiente entrada.

---

## 2026-08-01 — auditoría completa de `pendingCombatNpcSlugs` ("al reiniciar me empieza en combate")

**Síntoma**: "me pasa muchas veces que al reiniciar la partida me empieza en combate".

**3 causas raíz independientes, las 3 arregladas**:
1. `/saves/:id/restart` nunca limpiaba `pendingCombatNpcSlugs`/`pendingNpcAttack` — un combate sin
   cerrar de la partida ANTERIOR sobrevivía entero al reinicio.
2. `agresivoSlugsInScene`/`shouldForceCombat` (turnResolution.ts) no miraban `condicionFisica` — un
   NPC ya muerto podía reabrir combate de verdad si su alias seguía en `sessionFacts` recientes
   (mismo mecanismo que la entrada de arriba).
3. `GET /saves/:id` reconstruía `combateIniciado` desde el campo persistido sin filtrar por
   `saqueado` — última línea de defensa que tampoco existía.

**Estado**: FIJADO, las 3. Ver `tarkor_pendingcombatnpcslugs_auditoria_2026-08-01.md`. 424 tests
backend en el momento del fix.

---

## 2026-08-01 — arma equivocada en narración (dos rondas)

**Síntoma ronda 1**: Ataque Básico (mano principal garantizada por diseño) narrado con el arma
secundaria: *"le clava su cuchillo de hielo sílice"* llevando el hacha en la principal.

**Síntoma ronda 2** (misma partida, turno distinto): "Tajo Horizontal" (real de categoría HACHA)
narrado igual con el cuchillo: *"Gorhorn lanza su cuchillo de hielo sílice en un tajo amplio..."*

**Causa raíz**: el contextBlock "ARMA DEL PERSONAJE" lista las dos armas equipadas juntas sin decir
cuál usa ESTE golpe — con dos igual de válidas a la vista, el modelo elige mal.

**Estado**: FIJADO, las 2 rondas. Ronda 1: hint explícito solo para Ataque Básico (única tier con
mano garantizada por diseño). Ronda 2: `weaponCategoryForRealAbilityName` (weaponAbilities.ts) hace
el camino inverso nombre-de-habilidad → categoría → mano exacta, para cualquier real de categoría
no-dualWield. Ver `tarkor_arma_equivocada_narracion_2026-08-01.md`. 425 tests backend.

---

## 2026-08-01 — narración autocontradictoria (esquiva + sangra en la misma frase)

**Síntoma**: mismo turno de "Tajo Horizontal" de arriba: *"pero este esquiva fácilmente, dejando
una línea de sangre fría donde la hoja rozó su armadura."* — dice fallo (esquiva) e impacto
(sangre) en la misma frase, sea cual sea el resultado mecánico real.

**Causa raíz**: `hasFalseCombatHit` no lo detecta — su lista de palabras busca "rastro de
sangre"/"sangrando"/"sangra por", no "línea de sangre" (hueco de vocabulario, no de lógica).

**Estado**: FIJADO (2026-08-02, "ponte con todo"). `COMBAT_HIT_LEAK_REGEX` (narrador.ts) amplía la
lista con `l[ií]nea de sangre`. Test nuevo en `narrador.test.ts`.

---

## 2026-08-01 — narración de combate anticipada en el turno de aceptar la misión de Gistera Koh

**Síntoma**: al decir "Yo me encargaré de tu perseguidor" (sin haber pulsado Combatir todavía, sin
ningún intercambio mecánico este turno), la narración describe un choque real: Gorhorn lanza el
cuchillo, acierta, el orco huye cojeando — y dos turnos después el jugador vuelve a atacar al mismo
orco como si nunca se hubiera ido. **Confirmado en dos partidas seguidas** (mismo patrón el
2026-07-31 y el 2026-08-01) — deja de parecer casualidad del modelo.

**Causa raíz**: sin investigar a fondo todavía — candidato: falta un contextBlock que dirija
explícitamente la narración del turno de aceptación hacia "promesa a futuro", no "choque ya
resuelto", ya que `combateActivo`/`exchangeHappened` son `false` este turno (no hay grounding
determinista que lo contradiga, a diferencia del resto de fixes de hoy).

**Estado**: FIJADO (2026-08-02, "ponte con todo"). Nueva función `hasPrematureCombatResolution`
(narrador.ts), mismo patrón que `hasFalseCombatHit` — se activa con el flag `combatNotYetResolved`
(`npcsInScene.length > 0 && !exchangeHappened && executeTargets.length === 0`, la misma condición
que ya disparaba el contextBlock de aviso) calculado en turnResolution.ts. Si la narración describe
de todos modos un golpe conectado/un enemigo huyendo herido, se reintenta. Tests nuevos en
`narrador.test.ts`.

---

## 2026-08-01 — Hagar aparece de la nada y responde en vez de Gistera Koh

**Síntoma**: en el turno "Me acerco y le digo: 'Quién eres y qué buscas?'" (dirigido a la orca sin
nombre que se acerca corriendo, la futura Gistera Koh), tras la presentación real de Gistera Koh la
narración añade, pegado a lo mismo: *"Jajaja, quién lo diría, un día me encuentro a alguien valiente
lo bastante como para preguntarle a una orca marcada qué busca. Soy Hagar, minero de hielo sílice
del Clan Helsig..."* — un segundo personaje, sin relación con la escena, respondiendo como si él
fuera a quien se le preguntó. Hagar es un NPC "fuera del grafo v1" (vive en Cristal Helado, a
cientos de km) que solo debería aparecer si la partida lo trae de forma expresa.

**Causa raíz CONFIRMADA (no es solo narrativo, es mecánico)**: el alias de Hagar (`"hagar"`, 5
letras, entra en la tolerancia a erratas de `matchNpcAliases`) está a distancia Levenshtein 2 de
"**lugar**" (l→h, u→a) — una de las palabras más comunes del castellano. El primer hecho de sesión
de la partida ("...lo que sugiere que este **lugar** ha sido escenario de conflictos recientes")
lo contiene, y como los `sessionFacts` no caducan en esta partida (van todos en la ventana), Hagar
queda mecánicamente "en escena" (`npcsInScene`) desde el turno 1 y DURANTE TODA LA PARTIDA. Mismo
patrón exacto que el bug histórico "presas"~"brasas" (`docs/revisar-partida.md` § 3.7).

Verificado end-to-end con `detectNpcsInScene` real (no simulado) contra el estado exacto de la
partida en ese turno: devuelve `[Hagar]` — ni rastro de Gistera Koh (ella se gestiona aparte, fuera
de `npcsInScene`, ver el "encuentro guionizado" de `turnResolution.ts`). Como no hay objetivo citado
entre comillas, `dialogueTarget = dialoguePartners[0]` (turnResolution.ts:960) cae en Hagar por ser
el único NPC mecánicamente detectado — de ahí que le tocara "contestar" a él.

**Efecto secundario, más grave que el narrativo**: al estar permanentemente en `npcsInScene`, Hagar
también puede colarse como `candidateAttackTarget` (`npcsInScene[0]`) en cualquier turno de ataque
SIN objetivo citado entre comillas. Confirmado en la propia partida: su `NpcState` quedó con
`energia: 89` (nunca se toca ese campo salvo dentro de un intercambio de combate real resuelto
contra él, `turnResolution.ts` ~1670) tras el primer intento de "Tajo Horizontal" (turno sin comillas,
que además narrativamente fue un fallo) — ese intercambio se resolvió mecánicamente contra Hagar,
no contra el Orco Enfurecido, y solo no se notó porque fue un fallo (`condicionFisica` no cambia en
un fallo). Con más mala suerte, un turno de ataque sin comillas podría haber dañado/matado a un NPC
que ni siquiera está en la escena, dejando al enemigo real intacto.

**Fix propuesto (no aplicado todavía)**: mismo patrón ya usado para el bug histórico "hierro"~
"hiero" (`ATTACK_FUZZY_EXCLUSIONS`, npcScene.ts) — una lista de exclusión de palabras comunes que
nunca deben colar por tolerancia a erratas dentro de `matchNpcAliases` (empezando por `"lugar"`).
Alternativa más ancha: subir el umbral de longitud de la rama de tolerancia a erratas de 5 a 6+
letras (afecta a más alias, a revisar cuántos quedarían excluidos del todo).

**Estado**: FIJADO (2026-08-02, "ponte con todo"). `NPC_ALIAS_FUZZY_EXCLUSIONS` (npcScene.ts) —
`'lugar'` (y `'remato'`/`'remata'`/`'rematar'`/`'remate'`/`'rematan'`/`'rematamos'`, ver el hallazgo
del Múrgol más abajo) quitadas de la tolerancia a erratas de `matchNpcAliases`. Tests nuevos en
`npcScene.test.ts` (incluye uno confirmando que Hagar SÍ se sigue detectando por su alias real).

---

## 2026-08-01 — "Los Restos de Maktor" enlazado al saquear (CONFIRMADO con captura)

**Síntoma**: el texto determinista de saqueo — *"Gorhorn rebusca entre los restos y se hace con lo
siguiente: Maza orca, Amuleto de hueso."* — se renderiza en el frontend con "los restos" convertido
en un pin 📍 clicable a **"Los Restos de Maktor"**, una ubicación real del núcleo jugable (ruinas
del propio clan de Gorhorn) que no tiene NADA que ver con este saqueo (el combate fue contra un Orco
Enfurecido del Clan Serhu en la Hondonada del Eco). Confirmado con captura de pantalla de la usuaria.

(Primer intento de investigar esto, más arriba en este mismo documento, buscó mal — miró si el
Narrador con LLM mencionaba "Maktor" en el texto, y como el saqueo ya es 100% determinista desde
ayer, no encontró nada. El bug no está en la narración, está en el enlazado de texto clicable del
frontend.)

**Causa raíz CONFIRMADA**: `worldCatalog.ts:74`, la ubicación `restos-de-maktor` tiene el alias
`'los restos'` — elegido porque "ya es inequívoco por sí solo" (comentario del propio catálogo,
línea 73). Pero el propio motor de saqueo (`turnResolution.ts:1339-1340`) usa la frase fija
`"rebusca entre los restos"` para CUALQUIER saqueo del juego, de cualquier NPC, en cualquier
ubicación — contiene el alias exacto. El linker de texto clicable del frontend (`enciclopediaIndex.ts`)
lo encuentra y lo convierte en pin, sin mirar si tiene sentido en contexto. 100% reproducible: pasa
en TODOS los saqueos de la partida, no es un caso puntual — simplemente no se había mirado el
render visual hasta ahora, solo el texto plano del log.

**Fix propuesto (no aplicado)**: quitar `'los restos'` de los aliases de `restos-de-maktor` (se
queda con `'restos de maktor'`/`'ruinas de maktor'`, ya inequívocos de verdad) — es exactamente el
mismo criterio de "nunca un alias genérico sin calificador" que ya documenta
`docs/nuevo-elemento-catalogo.md` § 1, aplicado esta vez a una ubicación en vez de a un objeto/NPC.

**Estado**: FIJADO (2026-08-02, "ponte con todo"). Quitado `'los restos'` de los aliases de
`restos-de-maktor` (`worldCatalog.ts`) — se queda con `'los restos de maktor'`/`'ruinas de maktor'`.
Hallazgo lateral al arreglarlo: el propio archivo fuente YA tenía este alias corregido de una pasada
anterior (junto con `agujas-iman` y `campamento-serhu`, ver más abajo), pero nunca se había subido a
la base de datos local con `npm run seed-catalog` — el bug seguía reproduciéndose en partida por
eso, no porque el código estuviera mal. `territorios-clan-goshg` sí necesitaba el arreglo de verdad
(ver hallazgo de "Ciénaga Troncal" más abajo). `seed-catalog` corrido y verificado contra Postgres.

---

## 2026-08-01 — "Clan Serhu" enlaza al Campamento aunque nadie esté ahí

**Síntoma**: cualquier mención de "Clan Serhu" en la narración (p. ej. "una orca marcada del Clan
Serhu", "guerrero Serhu deshonrado" — hablando de la AFILIACIÓN de un personaje, no del sitio) se
enlaza como pin 📍 al "Campamento del Clan Serhu", una ubicación real y concreta donde nadie de la
escena actual está.

**Causa raíz CONFIRMADA**: `worldCatalog.ts:83`, la ubicación `campamento-serhu` tiene entre sus
alias `'clan serhu'` y `'los serhu'` — frases que suenan específicas pero en la práctica se usan
todo el rato para describir DE QUIÉN es alguien, no DÓNDE está. El enlazador de texto clicable del
frontend (`enciclopediaIndex.ts`) hace matching literal por substring/palabra, sin mirar contexto —
mismo mecanismo exacto que causó el bug de "Los Restos de Maktor" de la entrada de arriba, y la
misma familia (aunque por un camino distinto, sin fuzzy de por medio) que el bug histórico de
Torgash/Ulkha via "Serhu" en `matchNpcAliases` (backend, ya documentado en `docs/revisar-partida.md`
§ 3) — la lección de aquel bug (alias multi-palabra con el nombre de una facción es site de colisión
segura) no se aplicó todavía a este alias de ubicación.

**Fix propuesto (no aplicado)**: quitar `'clan serhu'`/`'los serhu'` de los aliases de
`campamento-serhu` — se queda con `'campamento serhu'`/`'campamento del clan serhu'`/
`'el campamento'`, que sí hablan inequívocamente del SITIO, nunca de la afiliación de alguien.

**Estado**: FIJADO (2026-08-02, "ponte con todo"). El código fuente ya no tenía `'clan serhu'`/
`'los serhu'` (arreglado en una pasada anterior a esta sesión) — el bug seguía viéndose en partida
solo porque nunca se había sembrado en la base local (mismo hallazgo que "Los Restos de Maktor" de
arriba). `seed-catalog` corrido y verificado.

**Reproducido de nuevo (2026-08-01, partida reiniciada)**: misma frase exacta ("...en dirección a
la Ciénaga Troncal, perdiéndose pronto entre la maleza.") vuelve a enlazar mal — este SÍ necesitó
arreglo real de código (a diferencia del resto de esta entrada, `'la cienaga'`/`'la ciénaga'` seguían
en el archivo fuente). **FIJADO (2026-08-02)**: quitados de los aliases de `territorios-clan-goshg`
— se queda con `'cienaga troncal'`/`'ciénaga troncal'`/`'territorios del clan goshg'`/`'clan goshg'`,
ninguno prefijo de otro. `seed-catalog` corrido y verificado.

---

## 2026-08-01 — el tiempo de ficción no avanza durante el combate (por diseño, pero se siente roto)

**Síntoma**: reportado como "una de las cosas más graves". En la partida reiniciada, 14 turnos
seguidos (esquivar, atacar, usar habilidad, saquear ×2, rematar) quedan clavados en exactamente
"Día 1, 08:20" — ni un minuto de ficción avanza en todo el combate.

**Causa raíz — es diseño explícito, no bug de datos**: cualquier turno clasificado como banda
"instantánea" (ataque, diálogo, saqueo, rematar, aceptar una petición verbal — ver
`turnResolution.ts`/`turn.ts`, las redes de seguridad que fuerzan banda a "instantanea") usa
`computeDuration` → `{ minutos: 0 }` (`timedActions.ts:43`), a propósito, para que un solo golpe no
"cueste" tiempo de ficción. El problema es el efecto acumulado: una pelea de varios intercambios
seguidos no avanza el reloj NADA, cuando en la ficción debería llevar al menos unos minutos.

**Fix propuesto (no aplicado, es una decisión de diseño, no solo un bug)**: darle un suelo pequeño
(1-2 min) a los turnos de combate/diálogo en vez de 0 fijo, para que una pelea larga sí acumule
minutos reales de ficción sin dejar de sentirse "instantánea" turno a turno.

**Estado**: FIJADO (2026-08-02, "ponte con todo"). `computeDuration` (timedActions.ts) usa
`{ minutos: 1 }` en vez de `{ minutos: 0 }` para banda "instantánea" — un combate largo ya acumula
minutos reales de ficción en vez de quedarse clavado. Test nuevo en `timedActions.test.ts`.

---

## 2026-08-01 — narración de ambientación repetida sin progreso tras el combate ("bucle")

**Síntoma**: tras rematar al Orco Enfurecido, 4 turnos seguidos del jugador ("avanzo por una salida"
→ "Continuo por la cueva" → "Continuo hasta llegar a la siguiente localización" → "Busco enemigos a
mi alrededor") narran casi lo mismo (viento, olor a arcilla húmeda, luego olor a hierba seca) sin que
la ubicación cambie de verdad (`currentLocation` sigue siendo "La Hondonada del Eco" los 4 turnos) ni
aparezca nada nuevo — dan XP pero no aportan progreso real.

**Causa raíz (probable, no tan confirmada como las de arriba)**: el jugador nunca nombró un destino
concreto en el texto libre (ningún alias de `pozo-cauce-viejo`/`pilares-rotos`, los dos destinos
reales conectados a Hondonada del Eco) — el matcher determinista de viaje (`travel.ts`) exige un
nombre real para disparar, así que sin él el motor solo rellena con ambientación genérica, turno
tras turno, sin ningún gancho de contenido nuevo (`selectDiscoveries` no tenía nada más que ofrecer
en esta región/momento).

**Efecto secundario menor detectado de paso**: dos hechos de sesión casi duplicados seguidos
("El Orco Enfurecido ha sido derrotado y ahora está herido, ~50/100 de salud" / "El Orco Enfurecido
ahora está herido, ~50/100 de salud") — el filtro de similitud de `appendSessionFacts` no los
consideró lo bastante parecidos para descartar el segundo.

**Estado**: PARCIALMENTE FIJADO (2026-08-02, "ponte con todo"). El efecto secundario concreto (los 2
hechos casi duplicados) SÍ se arregló — `DUPLICATE_THRESHOLD` (worldFacts.ts) bajado de 0.7 a 0.65
(la pareja real de esta partida medía 0.69, justo por debajo del umbral viejo). Test nuevo en
`worldFacts.test.ts`. La causa raíz principal (frases de movimiento vagas — "avanzo por una salida",
"continuo por la cueva" — no disparan ni el matcher de viaje ni `detectsSearchIntent`, así que no
hay ningún gancho determinista que darle al Narrador) sigue sin un fix de código: sería un cambio de
contenido/UX especulativo (p. ej. nudge hacia los destinos reales) sin poder probarlo en vivo antes
de aplicarlo — se deja anotado para decidir con calma, no forzado bajo esta pasada.

**Actualización (2026-08-03)**: la parte de "no encontrar nuevos enemigos en las zonas" de la queja
original que motivó esta entrada queda cubierta por un sistema nuevo, ver
[16-poblacion-dinamica.md](16-poblacion-dinamica.md) — los encuentros ambientales ahora se
ponderan por población real (`WorldPopulation`, hasta ahora dato semilla nunca leído) y se filtran
por región, así que cazar mucho una especie en una zona la hace de verdad más rara ahí y matar
NPCs con nombre propio también depleciona la población de su raza; una especie puede extinguirse
de verdad.

**Actualización (2026-08-03), causa raíz principal FIJADA**: petición explícita de la usuaria
("con prompts tipo 'Avanzo a la siguiente zona'... que no te quedes encerrado en un bucle infinito
que no lleva a nada"). `travel.ts` gana `detectsVagueMovementIntent` — "avanzo"/"prosigo"/"me
adentro" solos, o "sigo"/"continúo" acompañados de una palabra de desplazamiento ("por &lt;lugar&gt;",
"camino", "adelante", "zona", "hasta llegar"...) — acotado para no confundir "sigo mirando"/
"continúo hablando" (no es movimiento) ni el idiom "continúo por ahora". `resolveTravel` prueba
primero el destino nombrado de siempre; si no hay ninguno Y el texto es movimiento vago, mira las
salidas reales desde la ubicación actual (`destinationsFrom`): con **exactamente una**, viaja ahí
sin ambigüedad real que resolver (el modelo sigue sin elegir nunca la ruta); con **2 o más**, no
adivina — `turnResolution.ts` añade un aviso reforzado forzando al Narrador a preguntar
explícitamente cuál de los caminos reales elige, en vez de narrar ambientación genérica otra vez.
Cualquiera de los dos casos rompe el bucle en como mucho 2 turnos (viaje inmediato, o pregunta →
el jugador nombra uno real → matchea). IMPLEMENTADO+VERIFICADO (`travel.test.ts`, tsc + 456/458
tests, los 2 que fallan son pre-existentes y no relacionados), pendiente confirmar en vivo. La
causa raíz de las frases de movimiento vagas queda así fijada — antes se documentaba como
"especulativo, sin poder probarlo en vivo"; con el nuevo detector y el fallback de salida única/
pregunta explícita, deja de ser especulativo.

---

## 2026-08-01 — "Las Agujas Imán" partido en dos, esta vez en el propio texto del jugador

**Síntoma**: la propia acción del jugador, "Avanzo a las Agujas Iman", se renderiza como "Avanzo a
[📍 Las Agujas Imán] Iman" — el pin se traga solo parte del nombre y deja "Iman" suelto repetido
justo después, igual que pasó con "Ciénaga Troncal" pero esta vez en el bloque "TU ACCIÓN", no en
la narración del Narrador.

**Causa raíz CONFIRMADA — mismo mecanismo exacto que el bug de "Ciénaga Troncal" de arriba**:
`worldCatalog.ts:106`, la ubicación `agujas-iman` tiene el alias `'las agujas'`, que es un PREFIJO
LITERAL de `'las agujas imán'`/`'agujas imán'` (aliases más específicos de la misma ubicación). El
enlazador (`enciclopediaIndex.ts`) escanea el texto de izquierda a derecha y usa el primer match que
encuentra en cada posición — como "las agujas" empieza a matchear 3 caracteres antes que "agujas
imán", gana él aunque sea menos específico, dejando "Imán"/"Iman" fuera del pin como texto suelto.
El comentario del propio archivo ("alternativa larga-a-corta para que gane la coincidencia más
específica") solo ordena la alternancia POR POSICIÓN — no evita que un alias corto que empieza antes
gane a uno más largo y específico que empieza después.

**Confirma que es un patrón sistémico, no un caso aislado**: van ya 2 ubicaciones con exactamente el
mismo tipo de colisión (alias corto = prefijo de uno más específico de la misma entidad) —
`ciénaga-troncal`~`la ciénaga` (dentro de `territorios-clan-goshg`) y ahora `agujas-iman`~`las agujas`.
Cualquier ubicación cuyo nombre completo empiece con un alias corto ya registrado por separado es
candidata al mismo bug — merece una pasada por TODO `worldCatalog.ts` buscando este patrón, no solo
arreglar estos dos.

**Fix propuesto (no aplicado)**: quitar `'las agujas'` de los aliases de `agujas-iman` (igual que se
propuso quitar `'la ciénaga'`/`'la cienaga'` de `territorios-clan-goshg`) — ya se queda con
`'agujas iman'`/`'agujas imán'`/`'rocas imantadas'`/`'piedras negras'`, todos inequívocos sin ser
prefijo de otro alias de la misma entidad.

**Estado**: FIJADO (2026-08-02, "ponte con todo"). Quitado `'las agujas'` de los aliases de
`agujas-iman` (`worldCatalog.ts`) — se queda con `'las agujas iman'`/`'las agujas imán'`.
`seed-catalog` corrido y verificado contra Postgres.

---

## 2026-08-01 — "el cuerpo del múrgol" al decapitar al Orco Enfurecido

**Síntoma**: turno final de combate, "Remato a Orco enfurecido, asestándoles el golpe de gracia
final." → *"Gorhorn golpea con fuerza al orco, acabando con él de un último puñetazo que hace
temblar la arcilla. El cuerpo del **múrgol** permanece inerte en el suelo, sin reacción alguna."*
El Múrgol es el ganado lanudo e inofensivo de los clanes de las Llanuras — no pintaba nada en este
combate. `WorldState`/`SessionFact` incluso registró un hecho aparte, "Múrgol muerto", generado por
la extracción de hechos de ese mismo turno.

**Causa raíz CONFIRMADA (misma familia que el bug de Hagar/"lugar" de arriba)**: el verbo **"Remato"**
— el que usa CUALQUIER acción de rematar/decapitar en el juego — está a distancia Levenshtein 2 de
"**rebano**" (uno de los alias del Múrgol: r-e-m-a-t-o vs r-e-b-a-n-o, 2 sustituciones). Verificado
ejecutando `matchNpcAliases`/`detectNpcsInScene` reales contra el turno exacto: el Múrgol entra en
`npcsInScene` solo por la palabra "Remato", sin que el jugador lo mencione ni esté cerca. Al entrar
en escena, su bloque de contexto ("PERSONAJE EN ESCENA: Múrgol... dócil, gregario...") se manda al
Narrador junto al del Orco, y el modelo mezcló las dos fichas al escribir el cadáver.

**Sin daño mecánico esta vez** (el Múrgol no tenía `NpcState` previo, así que no pudo "ejecutarse"
de verdad — solo contaminó el contexto de texto), pero es más grave que el de Hagar en alcance: como
"Remato" es el verbo fijo de cualquier decapitar/rematar del juego, esta colisión se repetirá SIEMPRE
que se remate a un enemigo, no es un caso puntual de esta partida.

**Fix propuesto (no aplicado)**: mismo patrón que el resto de esta familia — añadir "remato" (y
variantes: rematar/remata/rematé...) a una lista de exclusión de palabras que nunca deben colar por
tolerancia a erratas contra alias de un solo NPC, o quitar "rebano"/"rebaño" de la rama de tolerancia
a erratas (dejarlos solo como substring exacto, ya son bastante largos y específicos para no
necesitar fuzzy).

**Estado**: FIJADO (2026-08-02, "ponte con todo"). `NPC_ALIAS_FUZZY_EXCLUSIONS` (npcScene.ts,
compartido con el fix de Hagar/"lugar" de arriba) — `'remato'`/`'remata'`/`'rematar'`/`'remate'`/
`'rematan'`/`'rematamos'` quitadas de la tolerancia a erratas de `matchNpcAliases`. Tests nuevos en
`npcScene.test.ts` (incluye uno confirmando que el Múrgol SÍ se sigue detectando por su alias real).

---

## 2026-08-03 — auditoría "revisa todos los MD" (sincronización lore↔código) + "y el resto de zonas están bien?" (posiciones del mapa)

Dos pasadas de auditoría de solo lectura pedidas explícitamente por la usuaria, cruzando los 8
documentos de `docs/rpgtarkor/` y el mapa real de Azgaar (`docs/map/Helek_World.map`) contra el
código actual.

**Hallazgo 1 — alias nativo del Campamento Serhu nunca llegó al código**: `docs/rpgtarkor/areas.md`
documenta desde su redacción original que "el nombre del poblado es **Karot Veku** en lengua común
**Colmillo Ceniza**", pero `worldCatalog.ts` (`campamento-serhu`) solo tenía `'campamento del clan
serhu'` como alias — confirmado por `git log` que nunca existió en ningún commit. Detectado por la
propia usuaria jugando ("juraría que le habíamos puesto un alias").
**Estado**: FIJADO. Añadidos `'karot veku'`/`'colmillo ceniza'` a los aliases, re-sembrado el
catálogo y confirmado en Postgres.

**Hallazgo 2 — resto de la auditoría de lore↔código**: ubicaciones, NPCs con nombre propio, fauna/
flora e items de las Llanuras del Viento Rojo, todos en sincronía con `worldCatalog.ts`/
`berigLore.ts`. Único detalle informativo (no bug): `berigLore.ts` usa el slug `orcos-cienaga-troncal`
(variante racial/visual) mientras que `worldPopulation.ts`/`population.ts` usan `orcos-cienaga` —
dos sistemas independientes que no necesitan compartir slug, pero es una inconsistencia de nombres
a tener en cuenta si algún día se cruzan.
**Estado**: sin acción necesaria.

**Hallazgo 3 — bug de signo en la calibración del mapa (`LLANURAS_OFFSET_Y`)**: el offset de Y del
núcleo de Llanuras (`frontend/src/data/map.ts`) se despejó con el signo cambiado — el propio nodo
ancla (Campamento Serhu) no reproducía su propio punto de referencia real en Azgaar, quedando
proyectado 10 km más al sur de lo que la calibración pretendía. Error uniforme sobre los 12 nodos
del núcleo, no se notaba porque las posiciones relativas entre ellos seguían intactas.
**Estado**: FIJADO (`185.10536193847656 - 5` en vez de `+ 5`) — verificado que la proyección de
Campamento Serhu ahora reproduce el ancla exacta. `tsc -b` limpio en frontend.

**Hallazgo 4 — El Cruce de las Cenizas no llega a la frontera real con El Margen Silencioso**:
motivado por la usuaria ("a mi no me cuadró porque debería estar mucho más al sur, en la frontera
con el Margen Silencioso"). `docs/13-escala-del-mundo.md` § 2.2 (escrito 2026-07-18, antes de que
existiera el mapa real de Azgaar) asumía que el núcleo v1 era "su esquina suroccidental" dentro de
la región completa de Llanuras. Al proyectar las coordenadas del núcleo (ya con el signo corregido)
sobre el polígono real de Azgaar, el núcleo entero cae en la zona **norte-central** de la región,
no en la esquina suroeste — quedan **~90 km** de llanura sin detallar hasta el borde real dibujado
de El Margen Silencioso.
**Estado**: FIJADO documentalmente, sin tocar el mapa de Azgaar ni las coordenadas del núcleo (ambos
correctos en sí mismos — es la prosa de 2026-07-18 la que quedó desfasada por un mapa que no
existía todavía cuando se escribió). `areas.md` y `docs/13-escala-del-mundo.md` actualizados: el
Cruce de las Cenizas sigue siendo el límite del núcleo JUGABLE, pero el límite FÍSICO con El Margen
Silencioso queda más al sur, en el tramo "existe pero sin detallar" que la propia doc ya reservaba.

---

## 2026-08-03 — análisis completo backend/frontend (mejoras y huecos sin cubrir)

Auditoría de solo lectura pedida explícitamente ("análisis completo... buscando mejoras o huecos
que aún no hemos cubierto"), seguida de "arregla todo". Tres hallazgos, los tres arreglados:

**1. ~10 servicios de lógica pura sin ningún test** — `worldClock.ts` (avance de tiempo ficticio),
`baseAttack.ts`, `requisitos.ts`, `characterSummary.ts`, `secondaryAttributes.ts`, `retrieval.ts`
(solo las funciones puras), `itemTaxonomy.ts`, `classAbilities.ts`, `protectedFacts.ts`,
`discovery.ts` (solo `detectsSearchIntent`/`coreRegionOf`) — todos con ramas reales y cero
cobertura, pese a la cultura de testing ya establecida en el resto del proyecto.
**Estado**: FIJADO — 10 archivos de test nuevos (58 tests), `tsc --noEmit` limpio, `vitest run`
515/517 (los 2 que fallan son los mismos pre-existentes de siempre, sin relación).

**Hallazgo colateral real, encontrado escribiendo el test de `requisitos.ts`**: `Attribute` (7
jugables, dice.ts) y `SecondaryAttribute` (9 narrativos, secondaryAttributes.ts) comparten la clave
`'inteligencia'` desde el rediseño de atributos a 7 (antes, Inteligencia era puramente secundaria).
`checkRequisitos` (`atributo in attributes`) mira SIEMPRE primero el bloque jugable, así que un
requisito `{ inteligencia: N }` NUNCA puede leer el atributo secundario — `crafting.ts` (receta del
contraveneno de salvia y ceniza, tier 2) documenta expresamente la intención de comprobar la
Inteligencia SECUNDARIA, pero en la práctica siempre comprueba la PRIMARIA. Hoy es inofensivo para
Gorhorn (sus dos valores de Inteligencia coinciden, ambos 10), pero es una trampa latente para
cualquier personaje futuro donde diverjan. **No se ha arreglado** (es una decisión de diseño —
¿debería "Inteligencia" seguir existiendo como atributo secundario aparte, ahora que es jugable? —
no solo un bug de código) — documentado con un test explícito en `requisitos.test.ts` para que quien
lo toque no lo redescubra por sorpresa.

**2. Código muerto confirmado**: `isConsumibleSlot` en `backend/src/services/equipment.ts` —
duplicado exacto de `frontend/src/lib/equipSlots.ts` (que sí se usa desde `GameView.tsx`), nunca
llamado desde ningún sitio del backend, sin test.
**Estado**: FIJADO — función borrada del backend (la del frontend se queda, es la real).

**3. Sin `ErrorBoundary` de React**: cualquier fallo al renderizar dejaba la app entera en pantalla
en blanco, sin aviso ni forma de recuperarse salvo recargar a ciegas.
**Estado**: FIJADO — `frontend/src/components/ErrorBoundary.tsx` nuevo, envuelve toda la app en
`main.tsx` (fuera de `SessionProvider`, para capturar fallos también ahí) — pantalla de aviso con
botón "Recargar" en vez de blanco.

Verificación final: `tsc --noEmit`/`tsc -b` limpios en ambos, `oxlint` sin warnings en ambos,
`vitest run` completo backend (515/517) y frontend (18/18).

**Actualización 2026-08-03 (misma sesión, continuación) — el hallazgo colateral SÍ se arregló**:
la usuaria confirmó explícitamente "inteligencia es un atributo primario", resolviendo la
ambigüedad de diseño de arriba. Investigando más a fondo salió que no era una simple ambigüedad:
`frontend/src/types.ts` YA tenía `SecondaryAttribute` correcto (con `'sigilo'`, sin `'inteligencia'`)
desde el rediseño de atributos a 7 (2026-07-29) — es `backend/src/services/secondaryAttributes.ts`
el que se quedó con la lista vieja, nunca actualizado en aquella sesión (confirmado también por el
propio comentario de `npcScene.ts`: "sigilo bajó a secundario"). Efecto real: la barra de "Sigilo"
en Estadísticas llevaba desde 2026-07-29 mostrando 0 para Gorhorn (el JSON guardado nunca tenía esa
clave), mientras un `inteligencia` residual y ya sin sentido ocupaba su sitio.
**Estado**: FIJADO — `secondaryAttributes.ts`/`startingSecondaryAttributes.ts`/comentario de
`crafting.ts` corregidos (sigilo en vez de inteligencia), tests actualizados, `docs/rpgtarkor/
personajes.md` anotado con el intercambio de categorías, y la única partida real existente en la
DB local (Gorhorn) migrada a mano (`UPDATE` sobre `secondaryAttributes`) para que ya tenga
`sigilo: 5` en vez del `inteligencia: 10` residual. Verificado: `tsc`/`oxlint`/`vitest` limpios
(516/518 backend, 18/18 frontend).

---

## 2026-08-07 — "no aparece ningún recurso" recolectando en la Hondonada del Eco

**Síntoma**: la usuaria, probando el pop-up nuevo de recolección (Minar/Talar), reportó que en la
Hondonada del Eco no aparecía ningún recurso ni opción de Explorar.

**Causa raíz**: `WorldPopulation.distribucion` se siembra SIN artículo ("Llanuras del Viento
Rojo"), pero `Location.region` siempre lo lleva completo ("Las Llanuras del Viento Rojo") —
comparar uno contra otro directamente (`distribucion[region]`) fallaba en silencio para 3 de las 5
regiones reales del mundo (Llanuras del Viento Rojo, Margen Silencioso, Meseta del Orden — las
otras dos, Cristal Helado y Ciénaga Troncal, no llevan artículo y "funcionaban" por coincidencia).
Confirmado consultando la DB local real: las 3 filas `WorldPopulation` tipo `RECURSO` existían con
población > 0, pero nunca pasaban el filtro de región.

**Alcance real, más allá del síntoma reportado**: el mismo patrón roto vivía en dos sitios más,
ambos silenciosos porque son sugerencias opcionales sin ningún error visible si no encuentran nada:
la ponderación de encuentros ambientales por población real (`turnResolution.ts`, función de
2026-08-03, rota desde que se construyó) y quién aparece al interrumpirse un viaje largo
(`travelInterruption.ts`, función de 2026-08-05) — en este último, además INVERTIDO: los NPCs sin
fila de población colaban con un peso por defecto, mientras los que sí tenían datos reales quedaban
descartados por el propio bug.

**Estado**: FIJADO. `stripRegionArticle` (`population.ts`) nueva, aplicada en los 3 sitios
(`recolectar.ts`, `turnResolution.ts`, `travelInterruption.ts`). 2 tests de
`travelInterruption.test.ts` tenían el mismo error en su propio mock (clave con artículo) —
corregidos también. Verificado: `tsc` limpio, 678 tests backend en verde. Sigue sin commitear.

## 2026-08-07 — "hielo sílice" narrado sin venir a cuento en combate (Orco Enfurecido)

**Síntoma**: dos turnos seguidos de combate (08:18 y 08:19 de la misma partida) mencionan "hielo
sílice" sin relación con el arma o habilidad usada — 08:18: *"Gorhorn lanza un tajo certero pero el
Orco Enfurecido esquiva con una agilidad sorprendente, dejando un rastro de hielo sílice en su
piel"* (atacando con el hacha, no con el cuchillo de hielo sílice — y además se contradice: dice
"esquiva" pero luego narra una marca en la piel). 08:19, con una habilidad de furia/racial sin
relación con hielo: *"en un destello de hielo sílice, derriba a Orco Enfurecido..."*.

**Causa raíz**: sin confirmar — parece el modelo local enganchándose a un objeto del inventario
(el cuchillo de hielo sílice está equipado como arma secundaria) sin relación con la acción real,
más que un bug determinista con causa raíz clara. La frase de 08:18 no dispara `hasFalseCombatHit`
(el vocabulario "rastro de hielo sílice" no coincide con `COMBAT_HIT_LEAK_REGEX`, pensado para
"rastro de sangre").

**Estado**: PENDIENTE, sin arreglar — un solo caso no basta para diseñar un detector nuevo sin
riesgo de falso positivo (mismo criterio que la "maza mal atribuida" de la auditoría 2026-07-31).
Si se repite, anotar aquí el segundo caso para diseñar el detector con confianza.

## 2026-08-07 (continuación) — objetos recién recolectados "sin categorizar" en el Inventario

**Síntoma**: capturas de pantalla del panel de Inventario mostrando "Piedra (3)" y "Leña de
matorral de cuerno" duplicados — una vez bien agrupados bajo "RECURSOS" (con icono real) y otra
vez bajo "SIN CATEGORIZAR" (icono de caja genérica).

**Causa raíz**: NO son filas duplicadas de verdad (confirmado consultando la DB: 4 filas reales
`InventoryItem`, todas con `catalogSlug` correcto, de 2 recolecciones reales distintas hechas
~7 minutos aparte). Es un fallo de categorización: `InventoryItem` no guarda ninguna columna
`tipo` — se calcula al vuelo en `GET /saves/:id` (`detail.ts`) vía join con `ItemCatalog`. Ningún
sitio del motor de turnos que crea un objeto NUEVO (saqueo/crafteo/despiece/producción/recolección)
mandaba `tipo` en su respuesta inmediata — el frontend agrupa por `item.tipo` (InventarioPanel.tsx),
así que cualquier objeto recién conseguido caía en "sin categorizar" hasta la próxima recarga
completa de la partida, momento en el que `detail.ts` sí lo resuelve bien. Mismo patrón exacto que
ya se arregló DOS VECES antes para `equipSlot` (2026-07-30) y `effectKey` (2026-08-06) — `tipo` se
quedó fuera en ambos arreglos.

**Estado**: FIJADO. `tipo` añadido a `NewInventoryItemInfo` (turnResolution.ts, los 5 sitios que
crean objetos) y a `NpcItemInScene`/`buildNpcInScene` (npcScene.ts, saqueo) y al endpoint de
recolección (`recolectar.ts`) — hardcodeado a `'RECURSO'` en despiece/recolección (siempre lo son
por diseño), tomado del catálogo cuando está disponible en saqueo/crafteo, `null` en objetos
narrativos sueltos sin `catalogSlug` (producción/newItem del modelo). Verificado: tsc limpio en
los dos lados, 678 tests backend + 18 frontend en verde. Sigue sin commitear.

## 2026-08-07 (continuación) — la recolección no acumula, crea una fila nueva cada vez

**Síntoma**: mismo screenshot de arriba, tras el primer arreglo — ya categorizado bien, pero
"Piedra (3)" y "Leña de matorral de cuerno" seguían apareciendo DOS veces cada uno en vez de sumar
a "Piedra (6)".

**Causa raíz**: `POST /saves/:id/recolectar/confirmar` creaba siempre una fila `InventoryItem`
nueva, sin comprobar si el jugador ya tenía una pila del mismo `catalogSlug` a la que sumar. El
propio proyecto ya tiene el patrón correcto para esto (cantidad en el nombre, `quantityOf`/
`baseNameOf` de `ingredients.ts`, usado por crafteo/construcción para CONSUMIR) — nunca se aplicó
en sentido contrario (ACUMULAR) en la recolección nueva.

**Estado**: FIJADO. `confirmar` ahora busca una fila existente sin equipar del mismo `catalogSlug`
antes de crear; si existe, suma la cantidad y actualiza su nombre en vez de crear una fila nueva
(también dentro de una misma petición, si dos selecciones distintas producen el mismo objeto).
Respuesta extendida con `updatedItems` (mismo patrón que `removedInventoryItemIds`/
`updatedInventoryItems` ya resuelve para crafteo/construcción) para que el frontend actualice la
pila existente en su estado local en vez de solo añadir. Verificado: tsc limpio, 679 tests backend
(+2 nuevos) + 18 frontend en verde. Sigue sin commitear.

**Nota**: las 4 filas ya creadas en la partida real de la usuaria ANTES de este arreglo (2×
"Piedra (3)", 2× "Leña de matorral de cuerno") no se fusionan solas — el fix solo evita NUEVOS
duplicados. Pendiente: preguntar si quiere que se fusionen a mano en su partida actual, o dejar que
se auto-corrija la próxima vez que recolecte cada uno (se sumará sobre una de las dos filas
existentes, quedando 3 en vez de 2 hasta que se recoja una tercera vez).

## 2026-08-07 (continuación) — consumir un objeto médico/de energía no lo quitaba del inventario

**Síntoma**: "he consumido una ración de comida y no ha desaparecido del inventario" — la usuaria
confirmó que ya le había pasado lo mismo antes en combate.

**Causa raíz**: grave, y llevaba ahí desde que existe el sistema de fatiga (2026-07-29).
`detectMedicalItemUse`/`detectEnergyItemUse` (itemReference.ts) decidían correctamente el efecto
mecánico (curar hasta X / restaurar N de energía) según qué objeto real nombraba la acción, pero
**ningún sitio del motor de turnos borraba ni reducía la fila `InventoryItem` correspondiente** —
el efecto se aplicaba, el objeto se quedaba para siempre, reutilizable sin límite. Confirmado
contra la DB real: "Raciones de viaje" y "Cataplasma de salvia del polvo" de la partida de la
usuaria, ambas con `curaEnergia`/`curaHasta` reales en catálogo, `slot: null`, nunca borradas.

**Estado**: FIJADO. Los dos detectores ahora devuelven también el `id` real de la fila que
matcheó (antes solo el valor derivado). Dentro de la transacción, revalidado contra
`freshInventoryRows` (mismo criterio anti-carrera del resto del archivo) y consumido de verdad:
borra la fila si era la última unidad, reduce el sufijo de cantidad si quedan más (`quantityOf`/
`baseNameOf`, mismo patrón que crafteo/construcción). Verificado: tsc limpio, 682 tests backend
(+7 nuevos) + 18 frontend en verde. Sigue sin commitear.

## 2026-08-07 (continuación) — el modal de "qué equipar" no mostraba ninguna estadística

**Síntoma**: "al equipar cuando eliges que poner no estan saliendo las stats de lo que llevas
equipado y de lo que puedes equipar".

**Causa raíz**: confirmado en el código — `DetailModal.tsx`, rama `slotManager`, nunca renderizaba
`statBonuses` ni para el objeto puesto ahora mismo ni para ninguna de las opciones candidatas
(a diferencia de la ficha de un objeto suelto y de las tarjetas del panel de Inventario, que sí lo
hacen). Imposible comparar qué conviene equipar sin recargar mentalmente qué bonus tenía cada cosa.

**Estado**: FIJADO. Añadidos los mismos badges de `statBonuses` (`+N Atributo`) que ya usa el resto
de la UI, tanto en la tarjeta de "puesto ahora mismo" como en cada fila de opción candidata.
Verificado: tsc -b limpio, 18 tests frontend en verde. Sigue sin commitear.

## 2026-08-07 (continuación) — consumibles equipados "no salen en el inventario": SIN REPRODUCIR

**Síntoma**: "los consumibles que me equipo por alguna razón al tenerlos equipados no salen en el
inventario".

**Investigado, no confirmado como bug de código todavía**: `InventarioPanel.tsx` agrupa TODO
objeto con `slot` no nulo (equipado, sea el tipo que sea) en su propia sección "Equipados" arriba
del todo — por diseño explícito, no debería desaparecer, solo cambiar de sección. La validación de
ranura (`equipSlotFamily`, equipment.ts) y el catálogo real (`equipSlot: 'CONSUMIBLE_1'` en
`racion-viaje`/`cataplasma-salvia`) se revisaron y son correctos. En la partida real de la usuaria,
en el momento de revisar, NINGÚN consumible estaba equipado (`slot: null` en ambos) — no se pudo
verificar el síntoma contra datos reales.

**Estado**: NO ES BUG — confirmado con capturas de pantalla completas (sin cortar por scroll):
"Raciones de viaje" y "Cataplasma de salvia del polvo" SÍ aparecen bajo "Equipados", justo al
principio de la sección, con el mismo badge "E" que el resto de objetos equipados. La primera
captura que dio pie a esta investigación estaba cortada por el scroll — no llegaba a mostrar el
principio de la sección "Equipados" (tampoco se veía "Arnés de cuero", equipado desde el inicio de
la partida, lo que ya lo delataba). El código funciona exactamente como está diseñado.

**Lo que SÍ era un bug real, visible en esa misma captura completa**: TODOS los objetos bajo
"Equipados" mostraban el mismo icono de espadas cruzadas, sin importar qué fueran de verdad
("Raciones de viaje", "Cataplasma de salvia del polvo" o "Tótem Maktor" equipados salían con
icono de arma). Causa: `ItemGrid` (InventarioPanel.tsx) forzaba el icono de arma para CUALQUIER
objeto con `slot` no nulo, en vez de usar `itemIcon(item.category)` como ya hace con los objetos
sin equipar. Mismo patrón roto en la ficha de detalle de un objeto suelto (`DetailModal.tsx`,
rama `item`).

**Estado**: FIJADO en los dos sitios — el icono ahora siempre refleja la categoría real del
objeto (arma/ropa/consumible/medicinal/cosmético...), tanto equipado como no; el badge "E" ya
existente sigue siendo la única señal de "está equipado". El paperdoll (`EquipoPanel.tsx`) no
tenía este problema — ahí el icono es intencionalmente el de la RANURA (consumible/casco/...),
diseño distinto y correcto. Verificado: tsc -b limpio, 18 tests frontend en verde. Sigue sin
commitear.

## 2026-08-07 (continuación) — Minar/Talar sin ningún límite: recolección indefinida sin moverse

**Síntoma**: "puedo darle a minar y que salga todo el rato 3 de piedra y añadir toda la piedra que
quiera indefinidamente dandole a la habilidad... recoger recursos en una misma zona ilimitadamente
sin tener que moverme de ella".

**Diagnóstico**: la población SÍ bajaba de verdad (confirmado contra la DB real: 500→477 tras
varias recolecciones, coincidiendo exacto con lo que había en el inventario) — no era un pozo
infinito, pero con 500-600 de población y sin ningún coste por uso (Minar/Talar son deterministas,
sin turno ni tirada), en la práctica se sentía indistinguible de infinito: se podía pulsar la
habilidad tan rápido como se quisiera, sin moverse, sin límite entre intentos.

**Decisión (consultada con la usuaria, opción recomendada elegida)**: cooldown real por fuente, no
solo un coste de tiempo — cada fuente recuerda cuándo se recolectó por última vez de verdad; hasta
que no pasa un tiempo real fijo, esa fuente concreta no vuelve a ofrecerse aunque le quede
población. Además, petición explícita de la usuaria en el mismo mensaje: "deberiamos tambien
añadir un texto de narracion (quizas que no dependa de la AI) para dejar escrito los recursos que
se han recoletado".

**Estado**: FIJADO. `WorldPopulation.lastHarvestedAt` nuevo (migración manual aplicada), cooldown
de 30 min reales (cifra de partida, ajustable) comprobado en el MISMO guard atómico que la
población (`poblacion: {gte}` + `OR: [{lastHarvestedAt: null}, {lastHarvestedAt: {lt: cutoff}}]`)
— dos selecciones de la misma fuente en una sola petición no se bloquean entre sí (el cooldown solo
se comprueba la primera vez que se toca esa fuente en la petición). El pop-up distingue "no hay
nada aquí" de "está agotado por ahora, vuelve más tarde". Registro escrito determinista añadido:
al confirmar una recolección con éxito, se crea un `LogEntry` real ("Gorhorn recolecta en la zona:
Piedra (3)...") sin pasar por Ollama ni por el Narrador, más un hecho de sesión para que el propio
Narrador lo sepa más adelante si hace falta. Verificado: tsc limpio en los dos lados, 685 tests
backend (+13 en recolectar.test.ts) + 18 frontend en verde (con `--no-file-parallelism` para
esquivar un flake preexistente de los tests de integración compartiendo Postgres real, sin
relación con este cambio). Sigue sin commitear.

## 2026-08-08 — repetición literal de la ambientación de "mañana" (`entorno.ts`)

**Síntoma**: 3 de las 4 veces que tocó franja "mañana" en la misma sesión (08:57, 09:57, 09:58,
10:28) salió la frase idéntica: *"El sol de la mañana pega bajo y de lado, alargando cada sombra
sobre la arena."*.

**Causa raíz confirmada leyendo el código**: `generateSurroundings` (`entorno.ts`) elige con
`Math.random()` puro, sin memoria del turno anterior, sobre una banca de solo 2 frases por franja
horaria para "mañana" — con 2 opciones y tiradas independientes, repetir 3 de 4 veces es
simplemente lo esperable estadísticamente (nunca se comprueba si coincide con lo último mostrado).
A diferencia de la narración de combate (que sí tiene anti-repetición con reintento, ver
`tarkor_antirepeticion_reintento_2026-07-31`), esta ambientación determinista no tiene ningún
mecanismo equivalente — tiene sentido, nunca hizo falta hasta que la banca por franja se quedó tan
pequeña.

**Fix propuesto, no aplicado todavía**: pasar el texto de la última ambientación mostrada (fácil de
tener a mano, ya se persiste como `LogEntry` de canal MUNDO) y volver a tirar si `pick(...)` repite
exactamente la frase de terreno o de franja anterior — mismo espíritu que el anti-repetición de
combate, más barato aquí porque no hace falta ni una llamada a Ollama (es solo re-tirar el dado
determinista). Alternativa más simple todavía: ampliar la banca de "mañana" (y revisar si alguna
otra franja se ha quedado igual de corta) de 2 a 4-5 frases, que ya bajaría mucho la probabilidad
de repetir sin tocar la lógica.

**Estado**: PENDIENTE — encontrado revisando la partida, sin aplicar fix a falta de luz verde.

## 2026-08-08 — errores gramaticales sueltos del modelo en narración de combate/exploración

**Síntomas concretos** (mismo tramo de partida, turnos ya narrados por el modelo, no por texto
determinista):
- 08:19: *"...en un destello de hielo sílice, **derriba a** Orco Enfurecido con una patada..."* —
  falta la contracción "al" (debería ser "derriba **al** Orco Enfurecido"). El mismo turno reincide
  además en el "hielo sílice" fuera de lugar ya registrado más arriba (mismo caso de siempre, no
  cuenta como tercer caso nuevo — es la misma frase de la misma sesión ya vista).
- 09:57: *"Bebe un poco de agua de la **cantea** que lleva atada a la muñeca..."* — "cantea" no es
  una palabra española real (probablemente cruce/alucinación con "cantimplora").
- 10:58: *"...su mirada **escanean** el entorno..."* — discordancia número sujeto/verbo ("su
  mirada", singular, con verbo en plural).
- 08:22 (más dudoso, a vigilar si se repite): *"Gorhorn clava su hacha... en el torso del orco,
  quien esquiva con una parada rápida y salvaje."* — mezcla en la misma frase un impacto directo
  ("clava... en el torso") con una esquiva, ambiguo/contradictorio según se lea.

**Causa raíz**: calidad de redacción del modelo local suelto, no un bug de código determinista con
un patrón claro y barato de detectar (a diferencia de anacronismo/npc-muerto/golpe-falso/repetición
de vocabulario, que sí tienen detectores deterministas con reintento). Un corrector gramatical
genérico sería una pieza nueva de infraestructura (otra pasada de detección + reintento, o una
segunda llamada a un modelo corrector) — no trivial, y con riesgo de falsos positivos si el
detector es simplista (regex de concordancia en español no es fiable en general).

**Estado**: PENDIENTE, registrado para tener referencia si se repite el patrón. No se propone fix
de código todavía — a decidir si merece la pena invertir en un corrector gramatical determinista/
con reintento o se acepta como ruido ocasional del modelo actual.

## 2026-08-08 (continuación) — "orca enfurecida"/"el Orco Enfurecido" en el mismo párrafo

**Síntoma**: 08:16, mismo combate: *"Gorhorn se gira bruscamente hacia **la orca enfurecida** que
acaba de aparecer... pero **el Orco Enfurecido** ya está a menos de diez pasos..."* — femenino y
masculino para el mismo NPC en la misma frase/párrafo.

**Causa raíz confirmada leyendo el catálogo**: de los 13 NPC con nombre propio de `worldCatalog.ts`
(sin contar fauna), solo **uno** tiene `genero` puesto — Gistera Koh, arreglada el 2026-08-07
precisamente por este mismo bug (`tarkor_genero_npc_gistera_koh_2026-08-07`). "Orco Enfurecido" es
inequívocamente masculino (nombre, bio: "él mismo", "orco") pero se quedó fuera de aquel arreglo —
sin `genero`, `generoHintFor` (`npcScene.ts`) no añade ninguna pista de género al prompt, así que el
modelo queda libre de mezclar "orco"/"orca" a su aire.

**Alcance real más allá del síntoma reportado**: mismo hueco en el resto del roster con género
inequívoco por bio — al menos Guerrero orco rezagado, Oficial/Soldado de patrulla de la Concordia
(a confirmar si son ambiguos por diseño o no), General Vrask Ombra, Kael Dorn, Hagar, Torgash
(masculinos); Terk'ikar Ulkha, Archimagistrada Yovenne Tal, Sella Marn (femeninos). Dos plantillas
SÍ son ambiguas por diseño a propósito (alias con las dos formas): "Cazador/a Serhu" y "Peregrino/a
de los Túmulos" — a esas NO hay que ponerles `genero` fijo.

**Estado**: PENDIENTE. Fix de patrón ya validado (mismo que Gistera Koh) — añadir `genero: 'M'`/`'F'`
a cada NPC inequívoco del catálogo (empezando por Orco Enfurecido, el caso confirmado) y reseed. Sin
aplicar todavía, a falta de luz verde y de confirmar caso a caso cuáles son plantillas ambiguas.

## 2026-08-08 (continuación) — "Un pequeño raposa": género de artículo + animal inventado

**Síntoma**: 10:58, *"Un pequeño raposa, asustada, desaparece entre los matorrales de cuerno."*

**Dos problemas distintos**:
1. Gramatical: "raposa" es femenino ("la raposa") — debería ser "**una** pequeña raposa", no "un".
2. De grounding: "raposa" no existe en ningún sitio del catálogo/lore (`grep` sin resultados) — la
   fauna real y establecida de Las Llanuras del Viento Rojo es Aullador Rojo, Buitre Cenizo,
   Canizor, Corredor de Cauce, Corretolvas, Cruzavientos, Gargantúa de Ceniza, Múrgol, Rondador de
   Brasas, Salamandra de Escoria — ninguna es un equivalente de "zorro". El modelo se inventó un
   animal genérico del mundo real en vez de usar el roster real, el mismo tipo de fallo que ya se
   prohíbe explícitamente para materiales de arma/armadura (`narrador.ts`) pero nunca se extendió a
   fauna.

**Estado**: PENDIENTE. Sin detector/regla determinista todavía — a decidir si se extiende la misma
instrucción de "usa solo lo ya establecido" (hoy limitada a materiales) también a fauna/animales.

## 2026-08-08 (continuación) — "buscar presas" no conecta nunca con un encuentro real

**Síntoma**: 3 turnos seguidos (09:58, 10:28, 10:58) de "buscar presas"/"cazar" en la misma sesión
no produjeron nunca un encuentro real — solo prosa ambiental repetitiva y, en el último, un animal
inventado que desaparece sin más (ver hallazgo anterior). Ninguno enganchó con combate real pese a
que la fauna itinerante SÍ tiene población real y activa en esa región ahora mismo (confirmado en
el volcado: Cruzavientos/Corredor de Cauce/Gargantúa de Ceniza/Múrgol con `WorldPopulation` > 0).

**Causa raíz, leyendo el código**: por diseño (`harvest.ts`: *"el 'cazar' en sí lo resuelve el
combate"*) cazar debería derivar en un combate real contra fauna del catálogo, pero el único puente
hacia eso es la "sugerencia ambiental de encuentro" (`turnResolution.ts` ~L1191) — genérica, dispara
solo un 25% de las veces en CUALQUIER turno con la escena vacía (nada que ver con que el jugador
esté cazando de verdad), y es puramente opcional para el modelo ("úsala solo si encaja, ignórala si
no"). No hay ningún detector que reconozca "estoy intentando cazar" y refuerce/obligue a que el
encuentro sugerido sea real y del roster — así que en una racha de mala suerte con la tirada del
25% (o si el modelo decide ignorar la sugerencia), cazar se queda en pura ambientación sin salida,
indistinguible de "no funciona".

**Estado**: FIJADO (2026-08-08). Nueva habilidad general "Cazar" (mismo patrón que Minar/Talar):
abre `HuntSelectionModal` con la fauna real con población activa en la región actual
(`GET /saves/:id/cazar`), checkboxes sin cantidad (una especie es "sí/no", no hay stock que
repartir). Diseño de la resolución, decidido con la usuaria en la propia conversación:
- Una ÚNICA presa "muy débil" (nivel ≤ nivel del jugador − 2, mismo umbral que la banda "Fácil" de
  `difficultyHintFor`) ofrece una tirada de caza limpia SIN combate — % = `capturablePct` de
  catálogo (dato ya sembrado desde 2026-07-29 y sin ningún caller hasta hoy, pensado explícitamente
  para esto) + la destreza del personaje, tope 90. Si sale bien: narración determinista (sin IA,
  mismo criterio que recolectar.ts), la presa queda MUERTA sin pelear, población depleciona de
  verdad (`decrementPopulationOnDeath`).
- Elegir varias presas a la vez, o una sola que no sea lo bastante débil, o que la propia tirada de
  caza limpia falle: SIEMPRE combate real. Corrección de diseño importante hecha a media
  implementación: la primera versión abría el combate ella misma (escritura directa de `NpcState`/
  `pendingCombatNpcSlugs`, sin narración) — la usuaria corrigió: "cazar sí que fuerza una narración
  cuando eliges objetivos y esa narración inicia el combate". La versión final NO escribe nada de
  combate en el backend para este caso: solo valida y devuelve un `actionText` con los nombres
  citados entre comillas (p. ej. "Salgo a cazar y ataco a 'Múrgol', 'Corredor de Cauce'."), y el
  FRONTEND lo manda por el turno normal (`handleSubmit`) — la narración real y el
  `shouldForceCombat`/`detectNpcsInScene` ya existentes abren el combate exactamente igual que si
  el jugador lo hubiera escrito él mismo, sin duplicar ninguna lógica de combate nueva.
- Solo se admite una presa por ESPECIE por petición (no cantidad) — `NpcState.scope` es
  `Location.id` para una `PLANTILLA`, dos individuos de la misma especie a la vez en el mismo sitio
  violarían `@@unique([saveId, npcId, scope])` sin un rediseño mayor del modelo de encuentros.
  Combinar varias especies distintas no tiene ese problema y es justo lo que pide "combate contra
  tantos enemigos como selecciones de la lista".

Verificado: tsc limpio en los dos lados, 1379 tests backend (+8 en `cazar.test.ts`) + 18 frontend
en verde. Sigue sin commitear.

## 2026-08-08 (continuación) — género inconsistente de "Orco Enfurecido" ("la orca enfurecida"/"el Orco Enfurecido" en el mismo párrafo)

**Causa raíz confirmada**: de los 13 NPC con nombre propio de `worldCatalog.ts`, solo Gistera Koh
tenía `genero` puesto (arreglo de 2026-08-07) — nunca se propagó al resto del roster con género
inequívoco por bio.

**Estado**: FIJADO. `genero` añadido a los 6 casos con señal textual explícita en su propia bio
(nunca por heurística de nombre, mismo criterio ya establecido para este campo): Orco Enfurecido,
Guerrero orco rezagado, Mercader de paso, Hagar, Torgash → 'M' ("Orco de..."); Terk'ikar Ulkha →
'F' ("Orca del Clan Serhu"); Archimagistrada Yovenne Tal → 'F' (el propio título ya es la forma
femenina). Dejados SIN tocar a propósito: Cazador/a Serhu y Peregrino de los Túmulos (ambiguos por
diseño, alias con las dos formas), y Oficial/Soldado de patrulla, General Vrask Ombra, Kael Dorn,
Sella Marn (razas Goirnte/Nabieus sin ningún sustantivo de especie con género gramatical en su bio,
ni "él"/"ella" explícito — poner algo aquí sería adivinar, no leer un dato ya establecido).
`npm run seed-catalog` reejecutado para aplicar los cambios a la partida real. Verificado: tsc +
1379 tests backend en verde. Sigue sin commitear.

## 2026-08-08 (continuación) — "Un pequeño raposa": animal inventado fuera del roster

**Estado**: FIJADO. La instrucción ya existente que prohíbe inventar materiales de arma/armadura
(`narrador.ts`, `fixedInstructions`) se amplió con la misma regla para fauna: "usa solo fauna ya
establecida en este mundo... nunca un animal mundano del mundo real que no exista aquí (zorro,
ciervo, conejo, lobo, oso...)". El error de artículo/género ("un" en vez de "una") no tiene detector
determinista propio — con la fauna ya acotada al roster real por la nueva habilidad "Cazar" (ver
arriba) y este recordatorio de prompt, el caso concreto reportado no debería volver a darse.

## 2026-08-08 (continuación) — repetición literal de ambientación de "mañana": FIJADO

**Estado**: FIJADO (visto arriba como PENDIENTE, resuelto en la misma sesión). `generateSurroundings`
(`entorno.ts`) ahora recibe el texto del último `LogEntry` de canal MUNDO (`routes/entorno.ts` ya lo
leía para el corte por `timeLabel`) y reintenta hasta 5 veces si la tirada repite la misma frase
literal — sin bucle infinito: si de verdad no hay alternativa (banca de 1 sola frase, caso
`SIN_UBICACION`), acepta la repetición en vez de insistir para siempre. Verificado con test nuevo
(`entorno.test.ts`) que fuerza la coincidencia y comprueba el reintento, más el caso sin alternativa.

## 2026-08-08 (continuación, partida reiniciada) — capacidad de inventario por filas, no por cantidad

**Síntoma reportado**: "tengo 9 piedras y cuentan como 1 en el inventario" — la usuaria lo señaló
como error.

**No es un bug**: es la decisión de diseño explícita de la propia usuaria del 2026-08-07 ("el
inventario va a ser por slots y dependerá en parte de los stats de fuerza y constitución... un
slot = una fila de InventoryItem, no peso" — `inventoryCapacity.ts`). Una pila de 9 piedras es UNA
fila (`"Piedra (9)"`), así que cuenta como 1 slot a propósito, igual que en muchos RPG donde
apilar el mismo recurso no cuesta hueco extra. Confirmado que el código hace exactamente lo que se
pidió entonces, no lo que se podría estar esperando ahora al verlo en juego.

**Estado**: PENDIENTE de decisión — no se ha tocado nada. Si la usuaria prefiere que la cantidad
apilada SÍ cuente (p. ej. 9 piedras = 9 de los N slots), es un cambio de mecánica real a decidir
explícitamente, no un fix de bug.

## 2026-08-08 (continuación) — "Cazar" narró la presa ya atrapada sin combate mecánico real

**Síntoma**: "Salgo a cazar y ataco a 'Corretolvas'" abrió combate real (Corretolvas ILESO en la
base de datos, ningún golpe dado todavía — tirada de Destreza "Éxito con coste" fue la
clasificación genérica de la acción libre, no un intercambio de combate), pero la narración dijo
*"lanzando una astuta trampa que atrapa al Corretolva... Con el Corretolva ya inmovilizado, decide
registrar su cuerpo para encontrar algo útil"* — un desenlace que el turno todavía no había
decidido. Mecánicamente correcto (`CombatPanel` sí mostraba Corretolvas ILESO); la PROSA
contradecía esa mecánica.

**Causa raíz**: ya existía el detector exacto para esta clase de bug —
`hasPrematureCombatResolution`/`combatNotYetResolved` (2026-08-02, mismo hueco con vocabulario de
golpe/huida: "acierta", "huye cojeando"...) — pero su lista de palabras nunca cubría vocabulario de
captura/inmovilización, porque la habilidad "Cazar" no existía todavía cuando se escribió.

**Estado**: FIJADO. `PREMATURE_COMBAT_REGEX` ampliado con `atrap(a/ó)/atrapad[oa]`,
`inmoviliz(a/ó)/inmovilizad[oa]`, `captur(a/ó)/capturad[oa]`. Test nuevo con el texto real de este
bug. Verificado: 1380 tests backend en verde.

**Hallazgo colateral, no relacionado, no arreglado (un solo caso)**: la misma narración incluyó
*"coge la lanza corta de caza esgrimida por Hagar"* — Hagar es un NPC real del catálogo (amigo de
Gorhorn en Cristal Helado) que no tiene NINGUNA relación con esta escena ni con ese objeto
concreto; parece una alucinación pura del modelo tirando de un nombre real del lore sin venir a
cuento. Un solo caso no basta para diseñar un detector sin riesgo de falso positivo (mismo criterio
que el resto de esta lista) — anotado por si se repite.

## 2026-08-08 (continuación) — imagen ausente en la ficha de combate (sí sale en la narración)

**Síntoma**: la ficha de "Información" del enemigo en `CombatPanel` mostraba el placeholder
genérico (⚔️) para Corretolvas, mientras la MISMA especie sí mostraba su imagen real bajo la
narración del diario, unos párrafos más abajo en la misma pantalla.

**Causa raíz confirmada**: Corretolvas (como buena parte de la fauna) solo tiene subida la imagen
de su variante de sexo (`corretolvas-macho-banner.png`), no una imagen "neutra" en
`corretolvas-banner.png` — así que `fauna.imageUrls.banner` es `null` para estas especies. Este
hueco exacto ya se encontró y arregló el 2026-07-24 para el banner que aparece bajo la narración
(`mentionedEntityBanner.ts` § `resolveBannerUrl`, con su propio comentario citando el mismo bug con
Múrgol) — pero `CombatPanel.tsx` (escrito 4 días después, 2026-07-28) nunca se actualizó con el
mismo fallback: leía `imageUrls.banner` a secas, tanto en la ficha ampliada del enemigo como en la
miniatura del selector de objetivo.

**Estado**: FIJADO en los dos sitios de `CombatPanel.tsx` (ficha ampliada + miniatura del
selector), con el mismo fallback ya validado: variante de sexo → imagen base. Verificado: tsc -b
limpio, 18 tests frontend en verde. Nota: el mismo hueco podría existir en algún otro sitio del
panel de Enciclopedia que no se ha barrido a fondo — no reportado por la usuaria, fuera de alcance
de esta pasada.

## 2026-08-08 (continuación) — posible reaparición de la escena de Gistera Koh sin nombrarla

**Síntoma**: tras rematar al Orco Enfurecido, "Explorar la zona" narró: *"Una orca marcada del
Clan Serhu se acerca a Gorhorn con agitación, contando que algo la persigue"* — casi calcado a la
escena de introducción de Gistera Koh (misma partida, unos turnos antes), pese a que los hechos de
mundo ya establecen que "Gistera Koh se marchó hacia la Ciénaga Troncal... no volverá a aparecer".

**Por qué las redes de seguridad existentes no lo cazan**: la exclusión de Gistera Koh
(`tarkor_gistera_koh_despedida_2026-08-01`) opera sobre su `Npc` real — aquí el modelo no la
nombra, solo repite la misma escena con una orca sin nombre, así que ninguna detección por slug la
alcanza. `isTooSimilarToLast` tampoco, porque compara solo contra el texto del turno INMEDIATAMENTE
anterior, no contra hechos de varios turnos atrás.

**Estado**: PENDIENTE, sin fix — un solo caso, sin patrón determinista barato evidente (¿comparar
contra TODOS los hechos de sesión, no solo el último turno? riesgo real de falsos positivos con
escenas genuinamente similares pero no repetidas). Anotado para vigilar si se repite.

## 2026-08-08 (continuación) — capacidad de inventario: bug real confirmado, no solo percepción

**Corrección sobre el hallazgo anterior** ("capacidad de inventario por filas, no por cantidad —
NO ES BUG"): la usuaria matizó — "un slot pero lo que se acumule en él cuenta como slot... sino es
que podemos tener inventario infinito". No pedía cambiar "1 fila = 1 slot visual" (eso se queda
igual), sino que la CANTIDAD acumulada dentro de esa fila pese contra el tope, cosa que el código
no hacía: `recolectar.ts` comprobaba `InventoryItem.count()` (filas) contra `selections.length`
(número de selecciones, ni siquiera la cantidad pedida) — una vez existe una pila ("Piedra (1)"),
seguir recolectando solo incrementa su cantidad sin crear fila nueva, así que ninguno de los dos
números subía nunca. Inventario realmente sin límite para cualquier recurso ya poseído, confirmado
como bug real, no solo una decisión de diseño ya tomada.

**Estado**: FIJADO. Nueva `totalInventoryUnits()` (unidades reales sumando `quantityOf` de cada
fila, no 1 por fila) en `inventoryCapacity.ts` (backend y frontend, mismo criterio de duplicado a
propósito que el resto de fórmulas de esa carpeta). `recolectar.ts` ya no rechaza la petición
entera si no cabe (esto NO cambió: sigue "coger lo que se pueda", mismo criterio que el tope de
`HarvestYield.cantidad`/población) — ahora topa la cantidad real añadida por el espacio libre
REAL en unidades, dentro del propio bucle, restando lo ya usado a medida que se procesa cada
selección. `InventarioPanel.tsx` y el contador del pop-up de recolección (`HarvestSelectionModal`
vía `GameView.tsx`) también corregidos para mostrar unidades reales, no filas — antes mostraban
p. ej. "5/40" con 38 piedras acumuladas en 1 sola fila, mintiendo sobre cuánto quedaba libre de
verdad. Verificado: tsc limpio en los dos lados, 1386 tests backend (+4 en `inventoryCapacity.test.ts`,
+2 nuevos en `recolectar.test.ts`) + 18 frontend en verde.

## 2026-08-08 (continuación) — Cazar ofrecía cualquier presa de la región, sin detección real

**Síntoma**: el pop-up de Cazar mostraba cualquier especie con población real en TODA la región
(p. ej. "Las Llanuras del Viento Rojo" puede tener miles de individuos, `worldPopulation.ts`), sin
importar el punto exacto donde estuviera el jugador ni si de verdad había rastro de ella ahí ahora
— "podría pelear/cazar cualquier presa en cualquier zona". Petición explícita: mismo patrón que
Minar/Talar/Saqueo — detección determinista de lo que hay AHORA, con cantidades realistas ("2
Múrgol, 8 Corretolvas, 1 Gargantúa"), pudiendo no encontrar nada, como al buscar recursos.

**Diseño implementado**:
- Mismo flujo en dos pasos que recolección: `GET /saves/:id/cazar` comprueba primero si ya se
  "localizó" fauna en esta visita (hechos de sesión, reutilizando `detectHarvestSourcesInScene` de
  harvest.ts sin cambios — los mismos alias de despiece sirven para detectar fauna en escena); si
  no hay nada localizado, `puedeExplorar: true` en vez de la lista completa.
- `POST /saves/:id/cazar/explorar` — determinista salvo por una tirada real de qué se encuentra
  (nunca gasta turno): hasta 3 intentos, cada uno con un 35% de no encontrar nada (para que "no
  encuentras nada" sea un resultado real) y, si no falla, una tirada ponderada por población real
  (mismo peso ya usado por la sugerencia de encuentro ambiental, `pickAmbientEncounterCandidate`)
  sobre los candidatos reales de la región. Si las 3 fallan, no se localiza nada y no se escribe
  ningún hecho de sesión (se puede reintentar).
- La CANTIDAD mostrada ("avistados") nunca es la población mundial real (cientos o miles) ni una
  tirada que haya que recordar aparte — se deriva de `capturablePct` de catálogo (ya curado a mano
  por especie: 80 para Múrgol/dócil-común, 10 para Cruzavientos/Gargantúa/rara-peligrosa) dividido
  entre 10, topado por la población real restante — así baja sola a medida que se caza de verdad,
  sin inventar ni persistir un contador nuevo.

**Estado**: FIJADO. Verificado: tsc limpio en los dos lados, 1420 tests backend (+11 nuevos en
`cazar.test.ts`: `avistadosFor`, `rollSightings`, GET con/sin localización, POST /explorar con
éxito/fallo) + 18 frontend en verde. `HuntSelectionModal.tsx` ahora tiene el mismo botón "Explorar"
que `HarvestSelectionModal` y muestra "×N avistados" por especie. Sigue sin commitear.

## 2026-08-08 (continuación) — Hagar alucinado por SEGUNDA vez, ahora con NpcState real corrompido

**Síntoma**: en dos turnos de la partida real (uno narrando que Gorhorn coge una lanza "esgrimida
por Hagar", otro narrando "Gorhorn se gira hacia Hagar, quien lo observa con ojos preocupados")
Hagar apareció sin venir a cuento — vive en Cristal Helado, fuera del núcleo jugable actual, sin
ninguna relación con la Hondonada del Eco. Peor aún: el `NpcState` de Hagar en la partida real
quedó con `condicionFisica: HERIDO` y `energia: 89` — no solo una alucinación narrativa, un
intercambio de combate real (contra el Orco Enfurecido) le aplicó daño A ÉL en vez de al enemigo
de verdad.

**Causa raíz confirmada** (reproducido con `matchNpcAliases` contra los hechos reales de la
partida): esto es la MISMA clase de bug ya documentada y arreglada una vez el 2026-08-02 —
"lugar"~"hagar" (Levenshtein 2) — pero con una palabra NUEVA no cubierta entonces:
**"hablar"~"hagar" (Levenshtein 2: b→g, l→a)**. El propio bio de catálogo del Orco Enfurecido ya
dice *"ataca al primer contacto sin intentar hablar"* — un hecho de sesión con esa frase basta para
colar a Hagar en `npcsInScene` durante TODA la partida a partir de ahí (`kind: 'PRINCIPAL'` lo hace
candidato en cualquier sitio, sin ninguna acotación por región).

**Estado**: FIJADO. `'hablar'` añadido a `NPC_ALIAS_FUZZY_EXCLUSIONS` (npcScene.ts) — comprobado
que ninguna conjugación real (habla/hablo/hablan/hablando/etc.) está de verdad a distancia ≤2 de
"hagar" (solo el infinitivo lo está), así que no hace falta excluir más que esa forma. Test nuevo
con el texto real del bio de Orco Enfurecido. El `NpcState` corrompido de Hagar en la partida real
se ha borrado (nunca estuvo realmente en la escena). Verificado: 1422 tests backend en verde.

## 2026-08-08 (continuación) — fauna sin arma pierde su ataque real en combate ("el orco lanudo")

**Síntoma**: un Múrgol (fauna dócil, cuadrúpedo lanudo, `ataqueNatural`: "Topetazo torpe con su
cornamenta ramificada, casi siempre sin intención real de dañar") se narró repetidamente como
*"el orco lanudo"*/*"orco enmarañado"* dando *"zarpazos"* — confundiendo su especie (fauna vs. una
persona orca) Y su forma de atacar (garras en vez de cornamenta).

**Causa raíz confirmada leyendo el código**: `baseAttackFor` (baseAttack.ts) SÍ calcula bien la
descripción real ("Topetazo torpe...") cuando no hay arma — pero `npcCombatAbilitiesFor`
(npcCombatAbilities.ts) construía el objeto `NpcCombatAbility` sin ningún campo `description`,
descartándola en el acto. El único dato que llegaba después al Narrador
(`exchangeNarrationBlock`/`PendingNpcAttack`, turnResolution.ts/combatExchange.ts) era el NOMBRE de
la habilidad — siempre literalmente **"Ataque base"**, idéntico para cualquier especie desarmada,
sin ninguna pista de cómo ataca de verdad esta en concreto. Sin nada que agarrar, el modelo cayó en
vocabulario genérico de combate orco (mucho más presente en el resto de la partida) en vez de usar
el dato real ya calculado y disponible.

**Alcance real**: afecta a CUALQUIER combatiente sin arma cuyo nombre de habilidad no sea ya
descriptivo por sí mismo — todas las habilidades de clase/raciales SÍ tienen nombre propio
("Puño de Hierro", "Furia de Maktor"), así que el hueco real es sobre todo fauna sin arma
(la mayoría del bestiario) usando el "Ataque base" genérico.

**Estado**: FIJADO. `description` añadido a `NpcCombatAbility` (npcCombatAbilities.ts) y
propagado en los 6 sitios que construyen una (Ataque base, habilidad de clase, racial de
ataque/defensa, racial de fauna, Esquivar/Defenderse genéricos) — nunca se pierde de nuevo.
`exchangeNarrationBlock`/`PendingNpcAttack.abilityDescription` (combatExchange.ts/
turnResolution.ts) ahora la incluyen junto al nombre en el contexto que recibe el Narrador. Test
nuevo reproduciendo el caso real del Múrgol. Verificado: tsc limpio, 1422 tests backend + 18
frontend en verde.

**Hallazgos colaterales de la misma partida, sin arreglar (criterio de "un solo caso, sin patrón
barato" de siempre)**:
- El Orco Enfurecido (bio: "ataca al primer contacto sin intentar hablar", AGRESIVO) se narró
  suplicando piedad ("¡No me mates, te lo ruego!") y retrocediendo defensivamente — contradice de
  frente su propia caracterización ya establecida. Un solo caso.
- "El metal partierto"/"la maza partierta" — palabra inventada (ni "partido" ni ninguna forma real
  española), aparece dos veces con género distinto en el mismo combate. Ruido del modelo, sin
  patrón claro que detectar.
- Un turno de esquiva simple concedió +500 XP (vs. los +25 habituales de cada intercambio) — el
  modelo decide libremente cuándo marcar un "hito" (descubrimiento/objetivo), y aquí pareció
  sobrevalorar una esquiva normal como logro mayor. Sin forma barata de validar "¿de verdad merecía
  esto un hito?" contra ningún dato mecánico real — se deja como observación, no como bug con fix.

## 2026-08-08 (continuación, partida reiniciada) — el modelo podía autoconcederse hito "capitulo" (500 XP, el tope absoluto)

**Síntoma confirmado**: el "+500/+525 XP en un turno normal de combate, justo al subir de nivel"
observado ya DOS veces en dos partidas distintas (visto antes como simple observación, "el modelo
decide libremente cuándo marcar un hito") resultó ser un bug real y serio, no solo una rareza del
modelo.

**Causa raíz confirmada leyendo el código**: `narrador.ts` § `HitoTipo` (el tipo que usa el propio
JSON del modelo) ya documenta la intención: *"'capitulo' no está aquí porque ese lo emite el
backend, no el modelo"* — pero `JSON.parse(text) as NarrationResult` es una ASERCIÓN de tipo, no
una validación real; TypeScript no protege nada en tiempo de ejecución. `turnResolution.ts` hacía
`if (narration.hito) hitos.push(narration.hito)` sin comprobar el valor contra nada — si el modelo
alucinaba igualmente la cadena `"capitulo"` en su JSON (probablemente por haberla visto mencionada
en el propio prompt/instrucciones), se aceptaba sin más. `xpForHitos` se queda con el máximo de
todos los hitos del turno (500, el tope absoluto reservado para cerrar un capítulo entero de la
historia) — un simple "ataco a un buitre" podía llevarse esa recompensa entera.

**Estado**: FIJADO. Lista blanca explícita en `turnResolution.ts`
(`HITOS_QUE_PUEDE_PROPONER_EL_MODELO = ['descubrimiento', 'objetivo_menor', 'objetivo_mayor']`) —
"capitulo" solo puede entrar ahora vía `chapterDue` (`claimChapterIfDue`, determinista, ya
existente, nunca decidido por el modelo). Sin test unitario dedicado (misma limitación de siempre:
esta lógica vive dentro de la función gigante `narrateAndPersistTurn`, no exportada ni testeada por
separado — se confirma jugando en vivo). Verificado: tsc limpio, 1424 tests backend en verde.

## 2026-08-08 (continuación) — hueco de gerundios en los detectores de golpe prematuro/fantasma

**Síntoma**: "Salgo a cazar y ataco a 'Buitre Cenizo'" (primer turno del combate, sin ningún
intercambio mecánico todavía — `NpcState` real del Buitre quedó en GRAVE, no MUERTO) se narró como
*"Gorhorn... da un fuerte golpe con la hacha, **atravesando** el cuello del ave... El buitrón cae
al suelo..."* — el mismo tipo de contradicción narración-vs-mecánica que `hasPrematureCombatResolution`
ya detecta (y que se acababa de ampliar ese mismo día para "atrapa"/"inmoviliza"), pero esta vez el
verbo SÍ estaba en la lista (`atraves[oó]|atraviesa`) en sus formas de pasado/presente, nunca en
gerundio (`atravesando`).

**Alcance real**: el mismo hueco existía en potencia para CUALQUIER verbo de las dos listas
(`COMBAT_HIT_LEAK_REGEX`/`PREMATURE_COMBAT_REGEX`) — "golpeando", "hiriendo", "rebanando" tampoco
estaban cubiertos, solo sus formas en pasado/presente.

**Estado**: FIJADO. Gerundios añadidos a las dos listas (`golpeando`, `impactando`, `hiriendo`,
`atravesando`, `rebanando`). Tests nuevos con el texto real del bug en las dos funciones. Verificado:
1424 tests backend en verde.

**Hallazgos colaterales de la misma partida, sin arreglar (un solo caso cada uno, mismo criterio de
siempre)**:
- Antes de derrotar y saquear al Orco Enfurecido, la narración le hizo empuñar "la maza orca" a
  Gorhorn — un objeto que no entra al inventario hasta el saqueo, varios turnos después.
- Tras matar y saquear al Orco Enfurecido, un turno posterior de "Uso 'Cataplasma de salvia del
  polvo'" narró que Gorhorn le aplicaba el ungüento AL PROPIO Orco Enfurecido (ya muerto y
  saqueado) en vez de a sí mismo — variante nueva de la familia "NPC muerto tratado como si
  siguiera presente" (`hasResurrectedDeadNpc`), pero con vocabulario de curación en vez de señales
  de presencia activa; su regex actual no lo cubre y ampliarlo con un solo caso arriesga falsos
  positivos legítimos ("recordó cuando le aplicó una cataplasma a X").

## 2026-08-08 (continuación) — "+525 XP" seguía viéndose: pendiente de reiniciar backend, no bug nuevo

**Importante para no confundir**: esta ronda mostró OTRA VEZ el mismo "+525 XP en un ataque normal,
justo al subir de nivel" que se acababa de fijar (ver entrada anterior, "el modelo podía
autoconcederse hito capitulo"). Comprobado por timestamp real (`LogEntry.createdAt`): la partida se
jugó con el backend todavía sirviendo el código de ANTES del fix — no hay forma de que un proceso
Node ya arrancado recoja un cambio de archivo sin reiniciar. No es una recaída del fix, es la propia
usuaria quien reinicia el backend cuando le toca (nunca esta sesión de Claude) — quedará resuelto en
la próxima partida tras reiniciar.

## 2026-08-08 (continuación) — Gistera Koh reaparece sin nombrarse, tercera vez confirmada

**Síntoma**: tras rematar al Orco Enfurecido, la narración volvió a describir "una orca marcada del
Clan Serhu, sin nombre revelado... con prisuebas [sic], jadeante" — y más tarde en el mismo log,
otra vez: "el hocico húmedo de una orca Serhu... algo invisible persigue su silueta". Es la MISMA
escena de introducción de Gistera Koh, reciclada palabra por palabra, pese a que el hecho de sesión
ya dice que se marchó para siempre. Ya se había visto una vez antes (2026-08-08, ronda anterior) y
se dejó como PENDIENTE por ser un solo caso — con esta ronda van 3 apariciones confirmadas.

**Por qué la protección existente no lo cazaba**: `gisteraSeHaMarchado` (turnResolution.ts) ya
excluye a Gistera Koh de `npcsInScene` por SLUG desde el 2026-08-01 — pero el texto nunca dice
"Gistera Koh", así que ninguna detección por nombre/slug puede alcanzarlo.

**Estado**: FIJADO. Nuevo detector `hasGisteraReencuentroSinNombrar` (mismo patrón que
`hasResurrectedDeadNpc`) — exige mención del clan ("orca... Serhu") Y vocabulario de
persecución/huida A LA VEZ en la misma narración (nunca cada uno por separado, para no disparar con
una mención neutra y legítima de Ulkha/Torgash — también "del Clan Serhu", pero siempre nombrados y
sin huir de nada). Activo solo cuando `gisteraSeHaMarchado` ya es cierto. Tests nuevos con las 2
variantes reales observadas + caso negativo de Ulkha. Verificado: tsc limpio, 1428 tests backend +
18 frontend en verde.

## 2026-08-11 — pruebas por API tras el rediseño de combate (fuera de combate a propósito)

Tras terminar el rediseño de combate (rol ataque/defensa/utilidad, ver plan `melodic-riding-
shannon`), la usuaria pidió expresamente "prueba todo, no solo combate" — ronda de pruebas contra
el backend real (dos partidas nuevas de Gorhorn) hablando directo con la API (`curl`), sin frontend.
4 hallazgos, ninguno arreglado todavía (pendiente decidir orden con la usuaria).

**1. Narración de inventario alucinada al "revisar el equipo"**. Acción libre "Reviso mi equipo y
observo con calma el terreno..." (banda instantánea, sin combate) narró: *"notando que el cuchillo
de hielo sílice y el tótem Maktor son los únicos objetos que lleva consigo en este viaje"* — el
inventario real tenía 8 objetos (hacha, cuchillo, tótem, arnés, pantalones, capa, raciones,
cataplasma). Mismo defecto de fondo que la familia "golpe falso"/"objeto falso" ya cerrada en
combate (`hasFalseCombatHit`/`hasFalseItemUse`), pero esta ruta narrativa genérica (fuera de
combate, sin acción de objeto detectada) no tiene ningún detector post-hoc equivalente.
**Estado**: FIJADO (2026-08-11) — nuevo detector `hasFalseInventoryReview` (narrador.ts), mismo
patrón que la familia golpe/objeto falso, wireado en el reintento y en `runDetectors`.

**2. Viaje fantasma con destino inventado**. "Salgo de la hondonada y camino hacia el norte,
alejándome del orco" (sin nombrar ningún destino real de los conectados a la ubicación actual) —
`classification`/`travel` vuelven `travel: null` (no hay viaje mecánico, correcto: "norte" no es
ningún alias real) pero la narración de todos modos describe el desplazamiento como si hubiera
ocurrido: *"Gorhorn sale de la hondonada, caminando firme hacia el norte..."*. Confirmado que
`currentLocation` no cambia tras el turno — el jugador cree que se movió y no es así. Mismo patrón
de fondo que el hallazgo 1 (narración sin grounding determinista que la contradiga cuando no hay
ningún objeto/NPC/golpe real de por medio que comprobar).
**Estado**: FIJADO (2026-08-11) — nuevo detector `hasFalsePhantomTravel` (narrador.ts) +
corrección post-hoc en `turnResolution.ts` (mismo patrón que `hasFalseTravelClaim`), que reescribe
la narración si el modelo afirma haber salido de la ubicación actual sin ningún viaje mecánico
resuelto.

**3. Una fuente de recolección "desaparece" si se descubre junto a otra en el mismo turno**.
Explorando minería en Los Pilares Rotos con `POST /saves/:id/recolectar/minero-llanuras/explorar`
aparecen 2 fuentes reales (Roca y Veta de hierro, las dos con `WorldPopulation` > 0 en esa región) —
pero al reabrir el panel (`GET /saves/:id/recolectar/minero-llanuras`) solo "Roca de Los Pilares
Rotos" sigue localizada; la veta de hierro ya no aparece, como si nunca se hubiera descubierto.
Confirmado leyendo la tabla `SessionFact` directamente: solo se guardó *"Gorhorn localiza roca de
los pilares rotos en la zona."* — el hecho de la veta nunca llegó a persistirse.

**Causa raíz confirmada**: `appendSessionFacts` (`worldFacts.ts`) descarta un hecho nuevo si su
`similarity` contra uno ya existente (`seen`, incluye los del MISMO turno) supera
`DUPLICATE_THRESHOLD` (0.65) — pensado para cazar parafraseos casi idénticos del mismo hecho (ver
el fix de 2026-08-02 que bajó el umbral de 0.7 a 0.65). `similarity` es solapamiento de palabras sin
pesos: *"Gorhorn localiza roca de los pilares rotos en la zona."* vs *"Gorhorn localiza veta de
hierro de los pilares rotos en la zona."* comparten 9 de 11 palabras (toda la plantilla fija
"Gorhorn localiza ... en la zona" + "de los pilares rotos") → similarity ≈ 0.82, muy por encima del
umbral, aunque las dos frases hablen de entidades completamente distintas (roca vs. veta de hierro).
Cualquier lote de 2+ hechos generados con la misma plantilla en el mismo turno es candidato al mismo
bug — no es exclusivo de recolección, es un defecto de la métrica de similitud en sí.
**Estado**: FIJADO (2026-08-11) — nueva `factSimilarity` (worldFacts.ts) dedicada a este chequeo:
quita stopwords y compara solo las palabras de contenido (Jaccard), en vez de la `similarity`
compartida con `isTooSimilarToLast` (narrador.ts) que comparaba solapamiento plano de plantilla
completa. "Roca" y "veta de hierro" de los pilares rotos ya se guardan como hechos distintos.

**4. La descripción de "Descansar" promete algo que la mecánica no cumple**. Su texto in-game dice
*"Se detiene donde esté, monta un vivac breve y descansa para recuperar fuerzas — sin necesitar
volver a un lugar conocido."* (`startingAbilities.ts`), pero la curación real
(`restSucceeds`/`isValidRestLocationKind`, `death.ts`/`turnResolution.ts`) solo se activa si
`currentLocation.kind` es `'refugio'` o `'asentamiento'` — en cualquier otro tipo (p. ej. Los
Pilares Rotos, `kind: 'hito'`) el descanso narra recuperación pero no cura ni un punto de energía,
sin ningún aviso de por qué. Confirmado con prueba de control: mismo texto exacto de acción, mismo
personaje, en Hondonada del Eco (`refugio`) sí curó energía al máximo (30→86); en Los Pilares Rotos
(`hito`) no cambió nada.
**Estado**: FIJADO (2026-08-11) — rediseño de dos tramos acordado con la usuaria (no era ninguna de
las dos opciones planteadas inicialmente): descansar en cualquier sitio cura de verdad, pero con
tope GRAVE; solo en refugio/asentamiento real el tope sube a HERIDO. `healCeilingFor` (death.ts)
pasa a recibir `restAttempted`/`restInValidLocation` en vez de un único booleano, y el texto de la
habilidad (`startingAbilities.ts`) ahora describe los dos tramos en vez de prometer curación total
en cualquier sitio.

**Confirmado funcionando bien en esta ronda** (no hace falta re-probarlo): equipar/desequipar con
validación de ranura y familia de 6 huecos de consumible; resincronización de habilidades de arma
al cambiar de arma equipada; viaje con destino real nombrado explícitamente; techo de curación de
Descansar (energía llena, condición tope en HERIDO — por diseño, `healCeilingFor`); puntos de
atributo bajo 6 peticiones `POST /saves/:id/attribute-points` simultáneas de verdad (el `SELECT ...
FOR UPDATE` aguanta, sin puntos perdidos); tope máximo de atributo sin consumir el punto; recarga de
partida estable (`GET /saves/:id` idéntico en dos lecturas seguidas); `POST /saves/:id/restart`
limpio (XP/nivel/condición/ubicación reseteados, sin combate colgado).

**Nota de metodología, no un bug**: llamar a `/turn/narrate` directamente después de una acción de
banda "extendida" (viajes largos) sin pasar por el protocolo real duplica el procesamiento — el
propio `/turn/classify` ya crea el `CharacterTransit` y dos `LogEntry` ("se pone a ello...") y
devuelve sin narrar; el frontend real (`GameView.tsx`) nunca llama a narrate en ese caso, solo
sondea `GET /saves/:id` cada 30s hasta que el worker de fondo (`worldTick.ts`) resuelve el tránsito
solo. Confirmado narrando manualmente de todos modos: el worker, al no encontrar el tránsito ya
finalizado, lo reprocesó una segunda vez (dos narraciones de llegada distintas para el mismo viaje).
Como el frontend real jamás toma ese camino, no se cuenta como hallazgo de producto — se deja
anotado aquí para no repetir el mismo rodeo la próxima vez que se pruebe por API.

**Pendiente para otra ronda** (no probado todavía): misión completa (aceptar→cumplir), crafteo,
enciclopedia, reino/construcción.

## 2026-08-11 (continuación) — misiones "conseguir X" nunca se cierran si el objeto viene de Minar/Talar/Desollar/Cazar

**Síntoma**: creada a mano una misión de prueba ACTIVA con `targetItemName: 'Piedra'`
(`rewardXp: 77`), y recolectada Piedra de verdad vía `POST /saves/:id/recolectar/confirmar`
(el flujo real que usa el botón de Minar en el juego) — la misión se queda `ACTIVA` para siempre,
`xp` no sube nada. El mismo objeto conseguido por saqueo/crafteo narrado sí la habría cerrado.

**Causa raíz confirmada leyendo el código**: el cierre determinista de misión "conseguir Z"
(`turnResolution.ts`, bloque `createdItemNames.length > 0` → `tx.quest.updateMany` por
`targetItemName`) vive DENTRO de `narrateAndPersistTurn` — solo se ejecuta cuando el objeto se
crea a través del flujo de turno normal (`/turn/narrate`: saqueo, despiece narrado, crafteo,
`newItem` del modelo). Los endpoints deterministas nuevos del rediseño de profesiones
(`recolectar.ts` § `/saves/:id/recolectar/:oficio/confirmar`, y por el mismo motivo
`cazar.ts` § `/saves/:id/cazar/confirmar`) crean `InventoryItem` en su propia transacción,
totalmente aparte de `turnResolution.ts` — ninguno de los dos comprueba ni actualiza `Quest` en
ningún momento (confirmado: cero referencias a `quest`/`Quest`/`targetItemName` en los dos
archivos). El crafteo (`services/crafting.ts`) SÍ sigue pasando por `narrateAndPersistTurn`, así
que no le afecta — el hueco es específico de los dos endpoints deterministas de recolección/caza
introducidos el 2026-08-07/2026-08-08.

**Alcance real**: cualquier misión futura del tipo "consígueme N de X" donde X sea algo que se
obtiene recolectando (mineral, madera, piel/despiece) o cazando quedará imposible de completar por
el camino normal del jugador — solo se cerraría si, por casualidad, ese mismo objeto también se
consigue alguna vez por saqueo/crafteo/narración libre.

**Estado**: FIJADO (2026-08-11) — bloque de cierre extraído a `closeItemQuests` (exportada de
`turnResolution.ts`), llamada también desde `recolectar.ts` § `confirmar` dentro de su propia
transacción. `cazar.ts` no se tocó en esta ronda (sin caso de prueba real que lo dispare todavía).

## 2026-08-11 (continuación) — el objeto recién crafteado sale "sin categorizar" (regresión parcial del fix de 2026-08-07)

**Síntoma**: prueba de control tras el hallazgo anterior — craftear "Bloque de piedra tallada"
(receta real, `STONE_BLOCK_RECIPE`, consume 5 Piedra) vía turno normal (`/turn/narrate`, sin pasar
por ningún endpoint dedicado). El objeto se crea bien (`removedInventoryItemIds` quita la piedra
consumida, `newInventoryItems` trae el bloque nuevo), pero con `"tipo": null` — pese a que el
catálogo real (`ItemCatalog` en Postgres, confirmado consultado directamente) sí tiene
`tipo: 'MATERIAL'` para `bloque-piedra-tallada`. Mismo síntoma exacto que el bug ya cerrado el
2026-08-07 ("objetos recién recolectados sin categorizar en el Inventario"), pero esta vez con un
objeto CRAFTEADO, no recolectado.

**Causa raíz confirmada leyendo el código**: no es un problema de datos (el `seed-catalog` está al
día) — es estructural. `catalogBySlug` (`turnResolution.ts:1669`) se construye SOLO a partir de los
`catalogSlug` que el inventario del jugador YA tenía ANTES de este turno (`inventoryCatalogSlugs`,
línea 1653) — por diseño correcto para su uso original (matchear ingredientes que el jugador ya
posee, `canCraft`/`planCraftConsumption`). El bloque que arma la respuesta del objeto CRAFTEADO
(líneas 2758-2760) reutiliza ese MISMO mapa para mirar `equipSlot`/`effectKey`/`tipo` del
`recipe.resultCatalogSlug` — pero el resultado de una receta es, por definición, algo que el
jugador normalmente NO tenía antes de craftearlo, así que `catalogBySlug.get(resultCatalogSlug)`
es casi siempre `undefined` y los tres campos caen a `null`. El propio comentario de la línea 2751
ya advierte la limitación de origen ("`catalogBySlug` (arriba) solo trae los catalogSlug que el
jugador YA tenía en inventario") pero el código de más abajo no lo tuvo en cuenta al reutilizar el
mismo mapa para el resultado.

**Por qué el fix de 2026-08-07 no lo cazó**: aquel fix añadió `tipo` a los 5 sitios que crean
objetos nuevos (saqueo/crafteo/despiece/producción/recolección) tomándolo "del catálogo cuando está
disponible" — crafteo SÍ quedó dentro de esa lista, pero la fuente de la que lee (`catalogBySlug`)
tiene este hueco estructural que un objeto recién crafteado activa casi siempre (solo se libraría si
el jugador ya tuviera otra unidad del mismo resultado en inventario antes de craftear esta).

**Efecto real**: cualquier objeto recién crafteado aparece en el panel de Inventario como "SIN
CATEGORIZAR" (icono genérico) hasta la próxima recarga completa de la partida, momento en el que
`GET /saves/:id` sí lo resuelve bien vía join — mismo efecto visual que el bug de 2026-08-07, pero
todavía vivo para el camino de crafteo.

**Estado**: FIJADO (2026-08-11) — nuevo `resultCatalogRowFor` (turnResolution.ts), resolver
memoizado que consulta el `resultCatalogSlug` directamente por `worldId_slug` contra `ItemCatalog`,
en vez de reutilizar `catalogBySlug` (que se queda tal cual para ingredientes).

## 2026-08-11 (continuación) — segunda tanda: reino, capítulo, muerte definitiva, despiece (sin bugs nuevos)

Continuación de la ronda de pruebas por API ("sigue haciendo pruebas... hasta que yo te mande
parar"). Sin hallazgos nuevos en esta tanda — todo lo probado se comporta como está diseñado, se
deja constancia para no reprobarlo sin necesidad:

- **Fundación de reino** (`POST /saves/:id/reino/fundar`): guard "sin Ayuntamiento" (400) correcto;
  bajo 3 peticiones EN PARALELO de verdad para la misma partida, solo una funda de verdad (nombre
  bloqueado "Maktor" para Gorhorn, confirmado), las otras dos devuelven el 400 limpio ya documentado
  (auditoría 2026-08-07) en vez de un 500 — la `Faction` creada aparece bien en la Enciclopedia con
  `discovered: true` desde el primer instante, tal como se diseñó.
- **Progresión de capítulo** (`chapterSummary.ts`, cada 15 turnos): forzado el umbral (14 acciones
  sembradas + 1 turno real de por medio) — dispara exactamente UN `SessionSummary` (`chapterNumber:
  1`, resumen coherente con lo ocurrido) y el hito "capitulo" (+500 XP, subida de nivel real),
  sin duplicar. `attributePointsGained: 0` en la subida a nivel 2 es correcto (`ASI_LEVELS` de
  `progression.ts` no incluye el nivel 2 — D&D solo da puntos en niveles concretos).
- **Fin de partida por muerte definitiva** (`endedAt`): con `endedAt` puesto a mano, `/turn/classify`
  responde 409 "Esta partida ha terminado" tal como documenta `docs/14-combate-y-muerte.md` § 4.4;
  `POST /saves/:id/restart` limpia `endedAt`/`condicionFisica`/`deathCount` correctamente.
- **Despiece (Desollar) — inconcluso, no reproducido**: creado a mano un `NpcState` de fauna
  (Buitre Cenizo) `INCAPACITADO`+`saqueado:false` en la ubicación actual, pero
  `GET /saves/:id/recolectar/desollador-orcos-llanuras` no lo ofrece como candidato.
  `carcassCandidatesFor` (`recolectar.ts`) depende de `detectNpcsInScene`, que a su vez mira
  menciones recientes en `sessionFacts` — un `NpcState` creado directamente en la BD, sin ningún
  turno narrado que mencionara al Buitre, no tiene ningún hecho de sesión del que colgar la
  detección. Probable comportamiento correcto (el despiece exige que el cadáver siga "en escena" de
  verdad, no solo que exista su fila), pero no se pudo confirmar sin narrar un combate real —
  pendiente de reprobar jugando en vivo en vez de por API directa.

## 2026-08-11 (continuación) — tercera tanda: sesión (pausa/cancelar/huir), habilidades generales, construcción, validación de creación

**Confirmado funcionando bien** (sin hallazgos): pausar/reanudar partida (`busyUntil` se alarga
exactamente lo pausado, probado con un tránsito real y ~5s de pausa real); cancelar un tránsito
activo (borra la fila + dobla como aviso en el diario, 404 limpio si no hay nada que cancelar);
huir antes de que empiece un combate (`POST /saves/:id/combat/flee`, tirada real, limpia
`pendingCombatNpcSlugs` en éxito, 404 limpio sin combate pendiente); CRUD de habilidades "general"
(crear, editar, borrar) con el guard real (no solo de frontend) contra editar/borrar habilidades
`isStarting`/`isDynamic` y contra crear con `category:'combate'` a mano.

**Bug real: `POST /saves` solo valida 3 de ~10 campos requeridos — cualquier otro campo ausente
revienta con 500 genérico en vez de un 400 claro**. Investigación en varios pasos: primero pareció
un problema de `attributes` (`{}` vacío, o solo 3 de las 7 claves reales, devolvían
`{"error":"Error interno del servidor"}` con HTTP 500), pero aislando campo a campo (probado con
`attributes` completo y sano de sobra, quitando solo un campo cada vez) se confirmó que el mismo
500 salta igual si falta CUALQUIERA de `characterOrigin`, `introCharacterText` (confirmados
directamente) — y por el mismo patrón de código, presumiblemente también `characterArchetype`,
`characterMotivation`, `portraitInitial`, `introWorldText` (todos destructurados de `CreateSaveBody`
y usados sin comprobar más abajo). La causa raíz real: el guard de la ruta
(`if (!worldSlug || !characterName || !attributes)`) solo cubre 3 de los ~10 campos del body —
el resto se usa tal cual, sin ningún `?.`/valor por defecto, en algún punto de la lógica de creación
(probablemente un campo `String` no-nulo de Prisma recibiendo `undefined`). Mismo patrón de fondo
ya documentado y arreglado una vez en `POST /saves/:id/attribute-points` (auditoría 2026-07-28:
"`attribute` solo se validaba a nivel de TypeScript, nunca en runtime") — aquí sigue sin cerrar, y
en el punto de entrada más importante de todos (crear personaje). **Sin corrupción de datos**
(confirmado en varias variantes: ninguna fila `Save` a medias queda en la BD tras el 500 — todo
vive en una sola transacción que revierte limpia), así que el impacto real es un mensaje de error
opaco/genérico en vez de uno útil — el formulario real de creación de personaje siempre manda todos
los campos hoy, así que en la práctica no se ha visto disparado jugando normal; el riesgo es de cara
a cualquier cliente futuro (API pública, script de importación, etc.) que no replique exactamente
el formulario actual.
**Estado**: FIJADO (2026-08-11) — `validationErrorFor` (creation.ts) cubre ahora los ~10 campos
`string` no opcionales de `CreateSaveBody`, además de validar `attributes` con las 7 claves reales
(mismo `VALID_ATTRIBUTES`/patrón ya usado en
`progression.ts`) — todo devuelto como 400 con mensaje claro antes de tocar nada más.

**Construcción (campamento base) — confirmado funcionando bien**: `Building` de la receta más
simple (`CAMPAMENTO_RECIPE`, banda "larga" → resuelto en diferido por `worldTick.ts`, protocolo
correcto de solo `classify` + esperar, sin narrar a mano, aprendido en la tanda anterior). El
edificio se creó bien (`status: 'ACTIVO'`, descripción real de la receta) y los 3 materiales
(leña/piedra/piel) se consumieron correctamente del inventario — sin rastro del bug de "sin
categorizar" de crafteo (no aplica: `Building` no es `InventoryItem`, no pasa por `catalogBySlug`).

## 2026-08-11 (continuación) — cuarta tanda: calidad de narración (petición explícita: "buscar mejoras... qué es necesario mejorar para que la narración sea de calidad")

Cambio de enfoque a petición de la usuaria: no solo lógica/mecánica, sino la PROSA en sí. Partida
nueva y limpia (`cmsoha1m200crrivbf59nvap9`) dedicada solo a esto, varios turnos leídos con
atención en vez de solo comprobados por su efecto mecánico.

**1. "Golpe fantasma" reproducido con vocabulario que SÍ debería estar cubierto — posible fallo del
reintento, no del detector**. Turno de combate real: acción "Descargo un golpe... contra 'Orco
enfurecido'", tirada mecánica real `resultado: 'ataque_falla'` (el ataque del jugador falla limpio,
`combatExchangeDisplay` lo confirma, ningún lado recibe daño — `condicionFisica` real del jugador Y
del NPC se quedan ambos en ILESO). La narración, sin embargo, dice: *"Gorhorn descarga su hacha...
en el orco, **quien se retuerce bajo el impacto** pero no cede."* — describe un impacto conectado
que la mecánica dice que no ocurrió. Lo notable: esto NO es un hueco de vocabulario nuevo — 
`COMBAT_HIT_LEAK_REGEX` (narrador.ts) YA incluye `impact[oó]` explícitamente, y `combatBothMissed`
(turnResolution.ts:1432, con un comentario que describe LITERALMENTE este mismo caso — "el
intercambio resolvió 'ataque_falla'... pero la narración describió un golpe limpio de todos modos",
arreglado el 2026-07-31) debería haber sido `true` aquí (ni el jugador ni el NPC reciben golpe este
turno). El detector debería haber disparado un reintento. Sin acceso a los logs del proceso en vivo
(este backend corre en una terminal de la usuaria, no capturado por esta sesión) no se puede
confirmar si: (a) el reintento se disparó y el modelo repitió una variante parecida en el segundo
intento también (límite real del sistema: un solo reintento, sin garantía de que el modelo pequeño
no insista), o (b) hay algún otro hueco no identificado en cómo se computan
`exchangeHappened`/`npcAttackHits`/`jugadorRecibeGolpe` para este resultado concreto tras el
rediseño de combate de esta misma sesión (aunque el camino de código parece ser el mismo
`resolveExchange` de siempre, sin tocar). **Estado**: PENDIENTE de diagnóstico — antes de tocar
código, comprobar en los logs reales del backend (`request.log`/stdout) si `hasFalseCombatHit`
llegó a disparar un reintento en este turno concreto; si sí, el problema es de fondo (reintento
único insuficiente contra un modelo local pequeño) y no tiene arreglo determinista fácil.

**2. Descolocación de tono: una acción explícitamente pacífica se narra como confrontacional**.
Acción: *"Levanto las manos vacías y le hablo con calma a 'Orco enfurecido': '¿Podemos hablar? No
busco pelea.'"* — inequívoca (manos vacías, calma, "no busco pelea"). Narración: *"Gorhorn se
planta frente a la figura y **le exige que hable**, sin apartar la mirada."* — "exige" y "sin
apartar la mirada" describen una postura confrontacional/desafiante, lo contrario del tono pedido.
No hay ningún detector determinista para esto (a diferencia de golpe/objeto/viaje falso, que
comprueban HECHOS mecánicos concretos) — el tono es más difícil de verificar por regex, pero es
justo el tipo de cosa que rompe la inmersión: el jugador escribe una acción con una intención clara
y el personaje "hace" otra cosa distinta en la narración. **Estado**: sin detector posible con el
enfoque actual (regex sobre hechos, no sobre tono) — candidato a instrucción de prompt más
explícita ("si el jugador especifica un tono/actitud concreto en su acción, la narración debe
reflejar ESE tono, no uno inventado") más que a un fix de código determinista.

**3. Diálogo sin atribuir, pegado sin transición al final de la narración**. Mismo turno que el
punto 2: tras un monólogo largo de Gistera Koh, la respuesta termina en seco con
`"¡Calla! ¿Hablar? ¡No me toques!"` sin ninguna acotación (nadie dice "gruñe el orco" ni similar) ni
transición de escena — el lector tiene que inferir que el hablante cambió del todo (de Gistera al
Orco Enfurecido). Se repite el patrón en otro turno (respuesta de Gistera mezcla comillas simples y
dobles para lo que parece ser la misma línea continua de diálogo, sin motivo aparente). Es un
defecto de forma/legibilidad, no de coherencia de hechos — ningún detector actual lo cubre.
**Estado**: sin arreglar, candidato a instrucción de prompt ("cuando cambie el hablante dentro de
la misma narración, dilo explícitamente — nunca dos líneas de diálogo seguidas sin acotación
cuando son de personajes distintos").

**Confirmado como buena señal de calidad** (no son bugs, se documentan porque contradicen la
sospecha inicial al leerlos):
- Uso correcto de lore profundo: la narración de Gistera Koh mencionó "la caída del Ketg"/"la casta
  de Ketg" sin que el jugador lo mencionara antes — parecía un nombre inventado a primera vista,
  pero es un término real y específico de `docs/rpgtarkor/areas.md`/`npcs.md` (el usurpador
  histórico que fundó la casta gobernante del Clan Serhu). Buena señal: el modelo está usando lore
  de fondo real, no solo lo que está en el contexto inmediato del turno.
- Continuidad física correcta: en el turno de combate del punto 1, describe "el metal partido
  chirría" — coherente con que el arma equipada es literalmente el "Hacha de guerra rota".
- El guardarraíl determinista de `condicionFisica` funcionó bien de fondo: el modelo propuso
  `"condicionFisica": "GRAVE"` para el jugador en el turno de ataque fallido (sin ninguna causa
  mecánica real, un salto de ILESO a GRAVE sin pasar por HERIDO) — `nextCondicionFisica` lo
  descartó correctamente y el valor persistido se quedó en ILESO. La mecánica está bien blindada
  incluso cuando el texto se equivoca; el problema de esta tanda es solo de PROSA, no de estado real
  del personaje.

**Recomendación general para la usuaria**: de los 3 hallazgos, el (1) es el único con un camino de
arreglo claro y determinista (si se confirma que el reintento sí se disparó y aun así falló, subir
a 2 reintentos como tope antes de aceptar, o añadir una frase de "última instancia" más agresiva al
prompt del segundo intento). Los (2) y (3) son de una familia distinta — calidad de prosa/tono que
no se puede cazar con una lista de palabras prohibidas, porque no hay ninguna palabra "equivocada"
en sí (a diferencia de "sangra"/"impacto"), es la interpretación completa del tono/estructura la que
falla. Si se quiere mejorar esa familia de forma sistemática, el camino más realista es reforzar el
prompt del Narrador con instrucciones más explícitas sobre tono-reflejado-en-la-acción y
atribución-de-diálogo, más que seguir añadiendo detectores post-hoc — la lista de detectores ya
cubre bien los casos de "hecho mecánico contradicho", pero tono/forma es un problema categóricamente
distinto.
