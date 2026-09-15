# Helek Sirik — Combate múltiple (varios aliados vs. varios enemigos) — APLICADO al motor

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-24, sesión conjunta autora/Claude) — **APLICADO al motor el
2026-08-25** (auditoría de lore 2026-08-25: este banner seguía diciendo "nada implementado" pese a
estar construido e integrado en producción desde el día siguiente al diseño). Real:
`CombatEncounter`/`CombatParticipant` (`schema.prisma`), iniciativa N-way (`combateMultiple.ts`),
orquestación con estado real incluida la jugadora (`combateMultipleOrquestacion.ts`), disparo real
desde `cazar.ts` (caza en grupo) y desde un ataque directo, saqueo/desuello al resolverse, y
narración ligera propia (`combateMultipleNarracion.ts`). Esta fue la pieza de infraestructura más
grande de la sesión: desbloquea `MULTIPLE`/`INVOCACION`/`COMPANERO`/`CONTROL`/`EXPULSAR` en las 34
especializaciones de `clases.md`, y es lo que permite que un compañero
(`companeros-y-supervivencia.md`) luche a tu lado en combate — aunque el compañero en sí necesitó su
propio arreglo aparte (ver nota de `Companion.attributes` más abajo).
**Objetivo individual real (2026-08-26) — APLICADO, ver § 2 reescrito**: el emparejamiento "siempre
auto-atacas al más herido, todos con objetivo válido garantizado" (`retargetBando`, § 2 original de
más abajo) se sustituyó por un sistema de "enganche" por ronda — duelo mutuo real vs. golpe gratis
sin oposición — cerrado con la usuaria jugando en vivo contra 2 cuervos. Sigue sin construir: XP de
la propia tirada de combate.

**PROVOCACION real (2026-09-14) — APLICADO**: efecto inverso a OCULTACION/EXPULSAR — en vez de
excluir a un combatiente de ser elegido como objetivo, fuerza que lo sea. 3 variantes: simple
(fuerza tu propio agro, forzando el enganche de la RONDA SIGUIENTE), margen decisivo
(`AGUANTE`+`PROVOCACION`, dispara al contragolpear con éxito), y redirección de Companion
(`durationEffectTarget: 'companion'`, sustituye YA el enganche de la ronda de un NPC que apuntara a
tu Companion). Columnas nuevas: `CombatParticipant.provocadoPorRondas`/`provocadoPorId`. Desbloquea
Guardián 16/19, Lancero 32, Especialista 28, Caballero del Valor 12/28.

**CANALIZAR real en combate múltiple (2026-09-14) — APLICADO**: mismo mecanismo ya construido para
el 1v1 clásico (`Save.pendingCanalizacion`, turnResolution.ts), portado a
`CombatParticipant.canalizando` (Json, sin `npcId` — el objetivo real es quien te tenga enganchado
esa ronda). 3 casos: empezar (consume el turno sin tirar dados), disparar (golpe diferido con
tirada real la siguiente vez que actúas, ignorando lo que se pulse ese turno, SIEMPRE con tirada
real aunque el enganche normal de la ronda diera golpe gratis), cortar (golpe decisivo recibido
mientras canalizas lo interrumpe). Desbloquea los capstones nv.40 de Tirador/Berserker/Convocador
ya sembrados en `clases.md` (Tensar al Límite, Golpe Devastador, Furia de los Elementos) también en
combate múltiple, no solo 1v1.

**MARCAR real (2026-09-14) — APLICADO**: mecanismo INVERSO a PROVOCACION — el jugador ordena a SU
PROPIO Companion que ataque preferentemente a un rival concreto, en vez de que el motor fuerce al
rival a atacar a alguien. Columnas nuevas: `CombatParticipant.marcaObjetivoRondas`/`marcaObjetivoId`
(viven en el COMPANION que recibe la instrucción, no en el objetivo marcado — al revés que
`provocadoPorRondas`). `resolverEnganchesRonda` (`combateMultiple.ts`) prioriza la marca sobre la IA
de Inteligencia normal del Companion al calcular el enganche de cada ronda nueva (misma precedencia
que PROVOCACION, por delante de `elegirObjetivoPara`); si el objetivo marcado deja de ser candidato
válido (muerto, fuera de escena), el Companion cae de vuelta a su IA normal ese turno. Solo dispara
por el camino independiente (rol utilidad) — ninguna ficha real de `clases.md` combina MARCAR con
margen decisivo. 3 rondas de duración (cifra explícita de la ficha, a diferencia de la
simplificación de 2 rondas del resto de efectos de duración). Desbloquea Domador 24 (Concentración
del Domador).

**AREA real (2026-09-14) — APLICADO**: genuinamente distinto de MULTIPLE (`objetivoExtraFor`,
exactamente un extra aleatorio) — 3 variantes reales, todas con UNA sola tirada, nunca tirada
individual por rival:
- **Ofensivo**: dispara por margen decisivo (mismo gate que MULTIPLE/EXPULSAR), alcanza a TODOS los
  vivos del bando contrario al defensor con `objetivosExtraFor` (generalización de
  `objetivoExtraFor` sin tope de cantidad). Desbloquea Opresor 32/36 (Runa de Sujeción, Grieta de
  Voluntad).
- **Defensivo**: dispara por margen decisivo (contragolpea con éxito, `AGUANTE`+`AREA`), activa
  `CombatParticipant.areaDefensaPorRondas` sobre quien la usó. Mientras viva, `redirigirPorAreaDefensiva`
  (`combateMultipleOrquestacion.ts`) redirige CADA golpe dirigido a un aliado propio (enganche
  principal Y golpes gratis de otros pretendientes esa misma ronda) hacia el protector, que se
  defiende con su propia tirada — con varios protectores activos a la vez, gana el de mayor
  iniciativa (decisión explícita de la usuaria, evita reparto ambiguo). Desbloquea Instintivo 28
  (Instinto de Reserva).
- **Persistente**: dispara por camino independiente (utilidad, "si ganas la tirada"), activa
  `CombatParticipant.areaTrampaPorRondas` sobre quien la coloca. Mientras viva, `resolverIntercambioCompleto`
  refuerza CUALQUIER contragolpe con éxito de su dueño (`defensor_contragolpea`, mismo margen
  decisivo de siempre) con `iniciativaForzada` a su favor — ATURDIMIENTO real, sin necesitar que la
  habilidad de defensa de ESE turno lo lleve explícito (ATURDIMIENTO en sí sigue siendo solo
  informativo para la narración en combate múltiple, igual que el resto del motor). Desbloquea
  Supervivencia 32 (Trampa Improvisada).

**Maestro Arquero/Ballestero real (2026-09-14) — APLICADO**: 12 fichas sembradas (12/19/24/28/32/36
por rama) reutilizando motor ya existente de DEBILIDAD/CONTRA/AUMENTO/MULTIPLE/CANALIZAR — sin
piezas de motor nuevas, trabajo de siembra pura. Solo el capstone 40 (CANALIZAR+LETAL combinado)
sigue sin construir, sin precedente real en `clases.md` de cómo resolver el "golpe letal diferido".

**`durationEffectTarget:'both'` real (2026-09-14, Domador 32, Grito Animal) — APLICADO**: tercer
valor del campo (junto a `'self'`/`'companion'`, 2026-09-09) — a diferencia de `'companion'`
(excluye al atacante, el efecto se REDIRIGE), `'both'` aplica el MISMO `ActiveEffect` a AMBOS a la
vez: jugador Y Companion, con la misma tirada. Combinado con `AREA` ofensivo para el tramo alto de
ATURDIMIENTO de la ficha ("si la diferencia es 12, a todos") — mismo criterio de simplificación que
el resto del catálogo, solo el tramo más alto.

**Alfa de la Manada real (2026-09-14, Domador 40, capstone) — APLICADO**: pasiva pura, sin turno de
combate que resolver. `maxSlotsDomadorFor` (`companionSupervivencia.ts`) amplía el slot garantizado
de Domador de 1 a 2 con nivel 40; `Companion.esAlfa` (columna nueva) marca cuál de los 2 es el Alfa,
asignable vía `POST /saves/:id/companeros/:companionId/alfa` (exclusivo — elegir uno desmarca
cualquier otro). El buff real (`alfaDeLaManadaBonusFor`) es PERMANENTE, no un `ActiveEffect` con
duración por turnos: +2 voluntad a AMBAS bestias con los 2 slots cubiertos, +2 fuerza extra solo al
Alfa — se recalcula en cada lectura de atributos del Companion (`datosVivosDe`,
`combateMultipleOrquestacion.ts`), antes de aplicar los `ActiveEffect` temporales normales.

**AUMENTO real, camino independiente (2026-09-15) — APLICADO**: hasta ahora `AUMENTO`/`DEBILIDAD`
solo se construían cuando `margenDecisivo` (camino ataque/defensa, `resolveExchange`) — el camino
independiente (`rol:'utilidad'`, `utilityTriggered`) nunca los tocaba, `margenDecisivo` se quedaba
siempre `false` ahí por construcción. Nueva variable `atacanteAumentoUtilidadDisparado`
(`combateMultiple.ts`) amplía el gate: `(margenDecisivo || atacanteAumentoUtilidadDisparado) &&
durationEffectMagnitude/Turns poblados` — solo para AUMENTO, nunca DEBILIDAD (ninguna ficha real de
`clases.md` debilita a un aliado desde utilidad). El objetivo del AUMENTO sigue resolviéndose igual
que siempre (`durationEffectTarget:'companion'`, sin selección de aliado real — el motor de combate
múltiple no tiene ningún mecanismo de "elegir un aliado cualquiera", solo el Companion propio fijo).
Desbloquea Guardián 32 (Valor Compartido) y Especialista 36 (Grito Improvisado).

**PROVOCACION variante Companion desde el lado defensor + bug real corregido (2026-09-15) —
APLICADO**: Sacrificio del Valiente (Caballero del Valor 40, capstone) es la MISMA variante
"redirige golpe de aliado" que Grito de Coraje, pero disparada desde el lado DEFENSOR con margen
decisivo (`AGUANTE`+`PROVOCACION`, `rol:'defensa'`) en vez del atacante/utilidad — nuevo gate
`defensorProvocarCompanionRedirect` simétrico a `provocarCompanionRedirect`. Al sembrarla se
descubrió un bug real preexistente: `defensorProvocacionDisparada` (variante margen decisivo,
Bastión Personal/Guardia de Asta/Postura Firme) exigía `atacanteRecibeGolpe`, que a su vez exige
`ATAQUE` en la habilidad de DEFENSA — pero ninguna de las 4 fichas reales de esta variante lo lleva
(solo describen "provocas al atacante", nunca un contragolpe físico), así que el camino de margen
decisivo de PROVOCACION nunca había disparado en la práctica desde que se sembró (sin test que lo
cazara). Corregido separando `defensorGanaPorMargen` (margen puro a favor del defensor,
`exchange.resultado === 'defensor_contragolpea'`, sin exigir ATAQUE) del contragolpe de daño real
(`atacanteRecibeGolpe`, que SÍ sigue exigiendo ATAQUE) — el disparo de PROVOCACION usa el primero.

**LIMPIAR real (2026-09-15, renombrado de RETIRAR) — APLICADO**: el nombre original ("retirarse")
inducía a pensar en huir del combate — el sistema de HUIDA real es independiente (`combatLore.ts`,
tirada de Destreza), nunca pasó por este `AbilityEffect`. Renombrado en el propio enum de Prisma
(migración `ALTER TYPE ... RENAME VALUE`, mismo patrón ya usado para ATENCION→PROVOCACION). Motor
nuevo: `removeWorstDebilidad` (`activeEffects.ts`) — a diferencia de `decrementActiveEffects`
(decrementa TODOS por turno) o el vaciado total al curar, esta es la única función del motor que
quita un `ActiveEffect` CONCRETO: el DEBILIDAD (`magnitude < 0`) de mayor magnitud negativa entre
los activos, dejando el resto intacto. Dispara por camino independiente (rol utilidad, mismo gate
que MARCAR/AREA persistente/OCULTACION en ese camino) — quien la usa se limpia A SÍ MISMA, nunca al
rival. Sin ningún DEBILIDAD activo, se pierde en silencio (mismo criterio de "sin candidato válido"
del resto del motor). Desbloquea Caballero del Valor 16/32 (Manto de Purificación, Purga de Honor)
— cierra la especialización completa (8/8).

**DEBILIDAD desde utilidad + AUMENTO-a-uno-mismo real (2026-09-15) — APLICADO**: mismo mecanismo
que AUMENTO-Companion (`atacanteAumentoUtilidadDisparado`), nueva variable
`atacanteDebilidadUtilidadDisparada` amplía el gate para DEBILIDAD — pero recae sobre el RIVAL de
este intercambio (nunca un aliado), mismo lado que PROVOCACION/MARCAR en el camino independiente.
De paso se descubrió que AUMENTO-a-uno-mismo (sin `durationEffectTarget`) YA funcionaba desde el
cierre de AUMENTO-Companion (`atacanteTambienRecibeEfecto` es `true` por defecto sin Companion
target) — 2 fichas llevaban el comentario "sigue sin motor" desactualizado. 19 fichas sembradas de
golpe: Guerrero (Golpe de Control tronco 8, Grito de Guerra/Grito tenebroso Berserker 12/16,
Instinto Berserker 36), Asesino Tóxico completo 8/8, Segador Maldito completo 8/8, Segador
Ilustrado completo 8/8, Segador Parca 5/8 (Toque de la Parca/Marca de la Guadaña), Druida Aullador
4/8 (Llamada Feroz/Aullido Ancestral). Grieta Elemental (Convocador 24, DEBILIDAD+MULTIPLE sobre 2
atributos a la vez) se dejó fuera a propósito — excede el alcance de un solo `ActiveEffect`.

**CURAZION real (2026-09-15) — APLICADO**: primera pieza de esta sesión que exigió motor
GENUINAMENTE nuevo, no solo un gate sobre infraestructura ya existente — no había ningún mecanismo
para mejorar la condición física DENTRO de un combate (solo fuera, con objetos/descanso).
`oneStepBetterThan` (`death.ts`) — inverso exacto de `oneStepWorseThan` ya existente, tope en ILESO
(MUERTO nunca mejora por esta vía). Simplificación consciente: el texto de cada ficha real varía
("roba vida al golpear", "transmuta el daño recibido en energía", "recupera energía y se cura")
pero todas comparten el mismo núcleo mecánico — mejorar un escalón la condición física de quien
dispara CURAZION, mismo criterio que AUMENTO/DEBILIDAD (una magnitud fija). 3 variantes de disparo:
**vampirismo** (`ATAQUE`+`CURAZION`, margen decisivo, mismo gate que MULTIPLE/EXPULSAR/AREA
ofensiva — Sed de Vida/Último Suspiro), **transmutación defensiva** (`CURAZION` sola, rol defensa,
dispara cuando el golpe SÍ conecta — `defensorRecibeGolpe`, a diferencia de AREA/PROVOCACION
defensivas que disparan al contragolpear — Robo de Vitalidad/Alquimia Vital), y **camino
independiente/utilidad** (Segunda Oportunidad, sin ningún golpe de por medio). Desbloquea Segador
Parca 8/8 (especialización completa), Segador Transmutador 32 (Alquimia Vital), Especialista 40
(Segunda Oportunidad, cierra 8/8).

**REFLEJAR real (2026-09-15) — APLICADO**: última pieza de la familia "efectos de duración sin
motor" (RETIRAR/CANALIZAR/CURAZION/REFLEJAR, ver comentario histórico de `schema.prisma`) —
`worstDebilidadOf` (`activeEffects.ts`, extraída de `removeWorstDebilidad` para poder leer el
DEBILIDAD ANTES de quitarlo) captura el DEBILIDAD de mayor magnitud negativa de quien dispara
REFLEJAR (camino independiente/utilidad), lo quita de su propia lista, y el orquestador lo
reconstruye tal cual (mismo atributo/magnitud/turnos) como DEBILIDAD nuevo sobre el RIVAL de ese
intercambio — sin decrementar ese mismo turno (llega "a plena fuerza" al rival, mismo criterio que
`nuevoEfectoAtacante`/`nuevoEfectoDefensor`). Sin ningún DEBILIDAD propio activo, se pierde en
silencio, mismo criterio que LIMPIAR. Desbloquea Segador Transmutador 16/28 (Espejo Maldito, Espejo
de Poder) — sube la especialización de 3/8 a 5/8.

**CONVERSION-sobre-debilidad real (2026-09-15) — APLICADO**: choque de nombre deliberado con el
CONVERSION ya existente desde 2026-08-24 (elige el atributo del golpe, SIEMPRE combinado con
`ATAQUE` en las 7 fichas reales que lo usan así) — esta variante nueva va SOLA (Transmutación
Menor) o combinada con `REFLEJAR` (Transmutación Mayor/Equilibrio Roto), nunca con `ATAQUE`, así
que distinguir por `!effects.includes('ATAQUE')` es seguro, sin colisión real posible. 2 funciones
nuevas en `activeEffects.ts`: `bestAumentoOf` (simétrica a `worstDebilidadOf`, el AUMENTO de mayor
magnitud positiva) y `removeActiveEffect` (quita un `ActiveEffect` concreto por referencia,
extraída de `removeWorstDebilidad` para compartirla). 3 variantes: **transmutación propia**
(Transmutación Menor) — el DEBILIDAD propio de mayor magnitud negativa se invierte en signo y se
reconstruye como AUMENTO sobre sí misma; **transmutación rival** (Transmutación Mayor) — el
AUMENTO y el DEBILIDAD del RIVAL se capturan, se quitan, y se reconstruyen con el signo invertido
sobre el mismo rival ("y viceversa", ambos a la vez); **Equilibrio Roto** (capstone) reutiliza el
mismo mecanismo que Transmutación Mayor — "invierte TODOS los efectos activos" se simplifica a "el
mejor/peor de cada tipo", mismo criterio de simplificación que el resto del catálogo. Desbloquea
Segador Transmutador 19/36/40 — cierra la especialización 8/8, y con ella Segador la clase entera
(Parca/Maldito/Ilustrado/Transmutador, las 4 al completo).

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

## 2. Quién ataca a quién — objetivo individual real (2026-08-26, APLICADO)

*Sustituye por completo el diseño original de este punto (emparejamiento automático, "todos
atacan a alguien, redecidido cada turno") — se quedó corto en cuanto se jugó de verdad: contra 2
cuervos, cada uno resolvía un intercambio contestado completo contra ti, sin que hubiera ninguna
noción de "solo uno es tu objetivo real, el otro te pega gratis". Diseño cerrado con la usuaria
jugando en vivo, algoritmo puro en `combateMultiple.ts § 2b` (`resolverEnganchesRonda`), enganchado
al motor real en `combateMultipleOrquestacion.ts`.*

- **"Enganche" por ronda, no por turno**: todos (tú, aliados, enemigos) tiran iniciativa cada
  ronda; en ese orden, quien TODAVÍA no sea objetivo de nadie elige a quién atacar. El primer
  reclamo sobre un objetivo dado gana — un segundo/tercer pretendiente al MISMO objetivo no le
  "roba" el duelo al primero, se queda con un **golpe gratis** contra él (ver más abajo).
- **Ser elegido cancela tu propia elección**: si ya elegiste atacar a alguien y DESPUÉS otro te
  reclama a ti como objetivo, tu ataque anterior se cancela — pasas a defenderte de quien te
  reclamó, un **duelo real** entre los dos (da igual quién eligió a quién; dentro del duelo,
  golpea primero quien tenga más iniciativa). Esto puede encadenarse más de un nivel: si a su vez
  quien te reclamó es reclamado por alguien más tarde, ambos os quedáis sin nadie atacándoos esa
  ronda — solo el último eslabón de la cadena llega a duelo real.
- **Golpe gratis**: quien no acaba en un duelo mutuo —porque nadie lo eligió y él tampoco pudo
  enganchar a nadie (su objetivo ya estaba ocupado en otro duelo), o porque es el sobrante de un
  grupo impar— mete un golpe gratis, sin oposición real, contra quien quiera: impacto garantizado,
  sin tirada de defensa del objetivo. `AGUANTE`+`MULTIPLE` es la única forma de defenderse de
  verdad de uno de estos (sin ninguna habilidad real sembrada con ese efecto combinado todavía).
- **Elección de la jugadora**: mismo criterio "nombre citado entre comillas" que el resto del
  turno — con fallback al primer enemigo vivo. Se fija al empezar la ronda (nunca a mitad), porque
  ningún intercambio de la ronda puede resolverse en firme hasta saber si su elección cancela a
  alguien que, en la cola, actuaría antes que ella. Sin cambio de flujo visible para ella: su
  turno real sigue resolviendo la ronda entera de una sentada, en la misma llamada.
- **Aliados y enemigos** siguen auto-eligiendo (nunca microgestión) con el mismo criterio de
  Inteligencia de siempre:
  - **Inteligencia alta** → objetivo inteligente: prioriza rematar a quien esté más cerca de caer
    (`GRAVE`/`CONVALECIENTE`), o concentra fuego sobre el más herido del bando contrario.
  - **Inteligencia baja** → objetivo aleatorio entre los vivos del bando contrario, sin ninguna
    lógica.
  - Da un uso táctico real a Inteligencia en combate que hoy no tiene (hoy es sobre todo
    `ANALISIS`/utilidad) — un enemigo "cabecilla" o "brujo" con Inteligencia alta se vuelve
    tácticamente más peligroso que un "recluta"/bestia con Inteligencia baja, no solo
    numéricamente más fuerte.
- **Compañeros**: siguen esta misma lógica automática (como un NPC) — su propia postura de
  combate (Agresivo/Defensivo/Capturador/Clemente) sigue aparcada, sin diseñar.

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
- **Lógica de emparejamiento/retargeting por turno** — APLICADO originalmente como `retargetBando`
  (`combateMultiple.ts`); **sustituido 2026-08-26** por el sistema de enganche por ronda de § 2
  (`resolverEnganchesRonda`) — `retargetBando` sigue existiendo en el archivo pero ya no lo usa la
  orquestación real.
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
