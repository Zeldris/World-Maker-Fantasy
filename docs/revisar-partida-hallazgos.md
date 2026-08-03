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
