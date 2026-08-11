# Ampliar lore — checklist persistente

Registro cronológico (más antiguo arriba, añadir SIEMPRE al final) de qué se ha añadido en cada
sesión de "ampliamos lore" (ver `docs/ampliar-lore.md` para el runbook) y qué queda pendiente de
llevar a código. La sección "Pendiente de código" es la que importa entre sesiones — la lista de
tareas de una conversación no sobrevive al cierre de la sesión, este archivo sí.

---

## Pendiente de código (acumulado, revisar antes de cerrar cada pasada)

- **3 zonas de las ruinas Nabierus siguen sin `Location`** (La Ciudad Hundida, El Archivo Cegado,
  El Observatorio Roto) — contenido futuro explícito (tras un terremoto sin fecha fijada aún), no
  deben entrar al grafo hasta que se decida cuándo ocurre ese evento. Las otras 16 zonas de la
  tercera ampliación ya están implementadas (ver sesión "séptima pasada" más abajo). Cuando se
  añadan, cuelgan de `dunas-ahogadas` o `vientre-del-engano` (ver docs/13-escala-del-mundo.md §
  2.2ter).
- ~~**`npm run reindex-lore` y `npm run seed-catalog` sin correr todavía**~~ — **superado** (ver
  sesiones octava a undécima más abajo): la usuaria sí corrió `seed-catalog` con backend/DB reales
  tras esta nota, lo que permitió detectar y arreglar en vivo el bug de `iniciar-tarkor.sh` (no lo
  corría solo), el de las líneas de ruta invisibles, y el de `seed-catalog` sin `delete` de rutas
  viejas (undécima pasada). Este entorno de Claude Code sigue sin Node/DB propios, pero eso ya no
  bloquea nada: la propia usuaria cierra el ciclo de verificación jugando.
- **Tono de Ulkha/Torgash frente a "la casta de Ketg" (detectado en la sexta pasada, sin resolver)**:
  sus bios/chunks los describen como personalmente razonables ("fría en el cálculo y cálida en el
  trato", "prefiere pactar a duelar"), mientras que el lore de gobierno de Serhu (añadido
  2026-08-05) describe la casta de Ketg —de la que ambos son miembros confirmados— como un régimen
  de miedo sin exilio ni compasión. Se ha dejado así a propósito (institución opresiva, individuos
  con matices) en vez de decidir en silencio que hay que endurecerlos — revisar con la usuaria si
  el tono actual sigue encajando o si conviene ensombrecerlos.

---

## Pendiente de dataset (acumulado, revisar antes de cerrar cada pasada)

*(Sección nueva 2026-08-11, ver `docs/ampliar-lore.md` § 1.7.)* El narrador fine-tuneado
(`docs/fine-tuning-ia-local.md`) aprendió de ejemplos generados con el lore de su momento — un
cambio de fondo en vocabulario, tono o nombres puede dejar ejemplos ya entrenados desalineados con
el mundo actual, sin que nada lo avise solo. Cuando una sesión de "ampliamos lore" cambie algo así
de notable, se anota aquí (qué cambió y desde qué sesión) — no implica regenerar el dataset de
inmediato, solo dejar constancia para cuando se decida.

Sin entradas todavía.

---

## Sesión 2026-08-05 — personalidad orca general + Clan Serhu

- **Personalidad y valores de la raza orca** (`razas.md` § Orcos — Hijos del Estallido, nuevo
  bloque "Personalidad y valores"): directos, paciencia corta (su mayor fuente de mala fama
  externa), rara vez mienten pero ocultan la verdad sin conflicto moral, honor/fuerza sin odio
  (buscan redención, no venganza), rango social irrelevante frente a honor/fuerza/respeto
  ganado (de ahí que las hembras, más listas y con más dotes de mando, lideren como Terk'ikar).
  Sin rencor racial general — excepto contra los Goirntes, vistos como amenaza a destruir, no raza
  a la que culpar. Único pueblo de Berig dispuesto a tratar con cualquier otra raza que muestre
  honor/fuerza/liderazgo/entereza/respeto, a diferencia del aislamiento habitual entre razas-Semilla.
  Un favor a un orco crea una deuda de honor real. Nueva frase de Kekta transmitida a los jóvenes:
  *"Un orco es fuerte y debe demostrarlo, pues solo los fuertes vencen al odio y luchan por la
  libertad."*
- **Clan Serhu, mecanismo de control Goirnte** (`areas.md` § Clan Serhu, nuevo sub-bloque "La
  casta de Ketg"): gobierno interno por miedo, no honor — desviación calculada, no espontánea.
  Envíos mensuales de armas Goirnte (de mejor factura que su propia herrería, mediocre — ver
  corrección justo abajo) usados para someter a otras tribus orcas y en incursiones contra los
  Faerus de El Margen Silencioso — explica por primera vez por qué la confianza real de los
  Faerus fue siempre con los Maktor, nunca con los Serhu (dato ya existente, sin motivo hasta
  ahora). Verificado con la usuaria: el poder desde Ketg es una **casta cerrada** con disputas
  internas (no una dinastía única sin ruptura de 64 generaciones) — Ulkha es la ganadora más
  reciente de esa disputa, no necesariamente descendiente directa de Ketg.
- **Corrección + "Oficios por clan" (mismo día, tras corrección de la usuaria)**: los Serhu SÍ
  tienen herrería propia — la frase inicial de arriba ("nunca desarrolló herrería propia") era
  incorrecta y ya está corregida en `areas.md`. Lo real: trabajan materiales que no son los
  correctos para lo que ofrece su tierra y sin la destreza necesaria, así que su propia Arena
  Imán (mineral ya existente en `flora-fauna.md`/`worldCatalog.ts`, comprada en bruto por
  herreros Goirntes) casi nunca se trabaja en casa — alimenta sin que ellos lo noten su propio
  complejo de inferioridad frente a los Goirntes. Nuevo bloque comparativo en `razas.md` §
  Orcos ("Oficios por clan"): Helsig los mejores tallando mineral (hielo sílice abundante),
  Goshg los mejores en madera (Trepadores Ocaso abundantes), Serhu/Llanuras mediocres en ambos
  pero especializados (sin ser los mejores de Berig) en desuello y peletería — coherente con
  su vida de pastoreo y caza.
- **Segunda corrección de alcance (mismo día)**: la comparativa Helsig/Goshg/Serhu de arriba es
  SOLO entre clanes orcos, nunca frente al resto de razas de Berig — ningún orco alcanza la
  sofisticación de una fragua Goirnte o un taller Ilvenar (raza más joven de Helek Sirik, nacida
  por accidente de la magia salvaje, no diseñada por una Semilla); su fuerte es la variedad de
  materiales que trabajan, no la profundidad del proceso. Los Faerus quedan fuera de esta
  jerarquía a propósito: seres instintivos sin afán de crecimiento material, rivales dignos a
  destruir con honor o aliados de los que aprender, no comparables en esta escala. Añadido al
  mismo bloque "Oficios por clan" de `razas.md`.

---

## Sesión 2026-08-05 (continuación) — historia de Gistera Koh, gobierno orco, tótems, ritos

- **Historia completa de Gistera Koh y El Orco Enfurecido** (`npcs.md` #13/#14, reescritos por
  completo — sustituyen la versión "reto a duelo de honor" del 2026-07-28): Uhuld Koh, artesano
  Serhu, la adoptó a los 10 años tras encontrarla desorientada en el desierto (origen de ella
  sigue sin revelar, a propósito). Uhuld tramaba en secreto liberar a los orcos del yugo Goirnte;
  delatado por sus propios hermanos de confianza, los Goirntes pagaron a 3 guerreros Serhu para
  matarlo. Sus últimas palabras invocan a los Maktor — es la razón real de que Gistera confíe en
  Gorhorn al reconocer el símbolo en su tótem. El Orco Enfurecido es el mismo guerrero que le dio
  el golpe de gracia a Uhuld y persigue a Gistera por su cuenta desde entonces, sin orden de nadie.
  *(Corrección tras un primer repaso: se me había quedado fuera el final — en cuanto Gorhorn
  acepta ayudarla, Gistera parte sola hacia la Ciénaga Troncal y hace amistad con el Clan Goshg;
  si la partida lleva a Gorhorn allí, puede reencontrarla y reclutarla como compañera. Ya añadido
  a `npcs.md` #13.)* Además: los otros dos guerreros se llevan el cadáver de Uhuld para hacerlo
  desaparecer — negarle el rito funerario (ni velado ni recordado) es un castigo real de la casta
  de Ketg contra quien la desafía, práctica exclusiva de los Serhu, no del resto de clanes orcos
  (`npcs.md` #13 + `areas.md` § "La casta de Ketg").
- **Tótems de clan**: corregida la definición (`razas.md` § Orcos) — un tótem es ante todo una
  insignia/bandera de costumbres y honor, no "los muertos hechos madera" sin más (esa era una
  simplificación de la versión anterior). Su uso funerario es real pero es UN uso, no el único:
  al morir un orco se quema el cuerpo y se deja un tótem en el sitio — más grande y decorado solo
  si murió con honor (duelo, cacería ritual), nunca por clase social. Reconciliado con Los
  Túmulos del Honor (`areas.md`): tótem de madera sobre montículo de piedra, no "entierro" a
  secas — arreglado el verbo que contradecía la cremación.
- **Tótem/emblema de cada clan confirmado**: Maktor = colmillo mellado con marca de garras de
  Canizor (ya establecido, solo confirmado). Serhu = cabeza de Gargantúa de Ceniza tallada
  (nuevo) — herencia compartida de antes del golpe de Ketg, frente al colmillo propio que los
  Maktor adoptaron después por el vínculo de Tevya.
- **El camino a guerrero** (`areas.md`): la cacería ritual de Corredores de Cauce a los 10 años
  decide el oficio de toda una vida — quien la supera es guerrero reconocido de adulto, quien no
  pasa a labores de clan y no se entrena para la guerra.
- **Gobierno y asamblea** (`areas.md`): los clanes orcos se rigen por una asamblea abierta a todo
  orco libre (estilo democracia/senado), con la Terk'ikar teniendo la última palabra — respetada
  porque la cultura orca asume que sus jefas son las más inteligentes y las que mejor van a velar
  por todos (no siempre cierto en la práctica). El golpe de Ketg no solo cambió quién manda en
  los Serhu: destruyó esta asamblea entera, sustituida por la casta cerrada ya documentada.
- **Frecuencia de las incursiones Serhu** (pendiente desde ayer, ahora resuelto en parte): no son
  frecuentes, ~1 cada 5 meses, forzadas por presión Goirnte, casi siempre misiones suicidas con
  poco o ningún logro real — un segundo mecanismo de control de población Serhu además del cerco
  social. Sigue sin fecha de inicio exacta (dejado a propósito).
- **Liderazgo actual de Helsig y Goshg** (`areas.md`) — **nombres confirmados por la usuaria**:
  Helsig, Terk'ikar **Brenka** + su pareja la Kort'ikar **Solgra** (ambas hembras). Goshg,
  Terk'ikar **Doshka** + su hermano menor el Kort'ikar **Dulgren**.
- **Descendencia de Krugo y Tevya** (`areas.md` § Historia profunda): tienen 5 hijos propios: la
  hija mayor continúa el linaje Maktor. Kekta muere de vieja y nombra sucesor antes de irse.
- **Cocina y dieta orca** (`razas.md`): omnívoros pero sobre todo carnívoros, ahumado/secado por
  necesidad en la llanura seca. Helsig comen aún más carne/pescado (frío exige calorías). Goshg
  comen relativamente menos de los 3 pero han desarrollado la mayor variedad de platos, gracias a
  los recursos de la ciénaga.
- **Idioma orco nombrado**: **Kektira** (en honor a Kekta) — la lengua propia de campamento/ritual
  frente al Kerost de cara a forasteros.

**Pendiente de código**: ver sección de arriba (bios de Gistera/Orco Enfurecido en
`worldCatalog.ts`; nombres de Helsig/Goshg sin ficha técnica todavía, no urgente).

**Pendiente de código**: ninguno todavía — es lore puro (razas.md/areas.md), sin tocar
`worldCatalog.ts`, `loreChunks.ts` ni ninguna cifra de `worldPopulation.ts`. Si en esta misma
sesión se acaba tocando algo con equivalente técnico (p. ej. si se decide fechar las incursiones
Serhu-Faerus en la cronología, o si se detalla más la casta de Ketg con nombres propios), añadirlo
aquí antes de cerrar.

---

## Sesión 2026-08-03 — historia orca profunda + cronología del mundo

Primera sesión con este formato. Resumen de lo escrito (detalle completo en los propios `.md`, no
repetido aquí):

- **Historia orca profunda** (`areas.md` § Los clanes orcos): los 4 primeros orcos (Kekta, Tevya,
  Megug, Kegoht) → fundación de Tarkurok/Maktor → guerra Goirnte → golpe de Ketg (nace Clan Serhu)
  → migración → fundación de Helsig (Helsa+Bregnor) y Goshg (Gosha+Dulgar) → generación del padre
  de Gorhorn → caída del Clan Maktor. Incluye la etimología Makt'orik→Maktor (el Canizor, nueva
  fauna) y el emblema del clan.
- **Historia de Gorhorn reescrita** (`personajes.md`): descartada la versión anterior (padre muerto
  al nacer Gorhorn en duelo contra Serhu, exploración a los 7, entrenamiento a los 14, Concordia a
  los 18). Nueva: padre vivo hasta los 10 años de Gorhorn, lidera revuelta, muere en la cruzada
  Goirnte que aniquila el clan; años 10-20 de Gorhorn como ayudante de comerciantes → 4 años
  esclavo Goirnte → 1 año con los Faerus → resto con Goshg/Helsig (incluye lo ya establecido de
  Hagar). Tótem Maktor redefinido como fragmento tallado por Gorhorn, cosmético, no el artefacto
  ancestral completo.
- **Torgash desvinculado** del duelo del padre de Gorhorn (`npcs.md`, `areas.md`) — pendiente en
  código, ver arriba.
- **Dos documentos nuevos de cronología**: `cronologia-mitica.md` (antes del año 0, Semillas/Tarkor/
  Formación) y `cronologia.md` (desde el año 0, con años concretos hasta el presente de Gorhorn).
  Enlazados desde el pie de página de todo el lore.
- **Escala temporal ajustada dos veces** tras revisión de plausibilidad:
  - Población Tarkurok/Maktor: 200→800 años para llegar a 5.000 (la tasa a 200 años era ~3,6%/año,
    absurda; a 800 años, ~0,9%/año).
  - Adaptación física Helsig/Goshg: 500→1.000 años (28→56 generaciones orcas; se sostiene con que
    la magia salvaje acelera la biología orca, ya sugerido por el propio canon de piel-por-región).
  - Año de arranque de la partida de Gorhorn, resultado final: **4.010** (no 2.910 ni 3.510 —
    versiones intermedias durante la misma sesión).
- **Escala de creación del mundo** (`cronologia-mitica.md`, `genesis.md` § Madre): el ancla "Madre
  crea las Semillas" subió de −10.000 a −500.000.000 (escala planetaria real) y luego bajó a
  **−200.000.000** (el poder de las Semillas acelera la formación activa del mundo, no hace falta
  el tiempo "natural" completo). Tema nuevo explícito: Madre lleva presente solo una fracción
  mínima de la vida real del planeta y no sabe qué hay más allá de su propia creación — conecta con
  la Entidad Desconocida ya existente.
- **Ritmo de crecimiento del Clan Serhu explicado narrativamente** (`areas.md`): el número ya
  sembrado en `worldPopulation.ts` (800, no inventado en esta sesión) ya cuadraba con una tasa ~3x
  más lenta que Goshg/Helsig — se escribió el porqué (cerco social Goirnte, sin alianzas ni
  contacto exterior) en vez de tocar la cifra. De paso, nueva relación histórica Faerus↔Maktor (no
  Faerus↔Serhu) que explica por qué Gorhorn conectó con los Faerus en su juventud.

Ver memoria `tarkor_auditoria_lore_mapa_2026-08-03` y siguientes del mismo hilo para más contexto
de sesión (aunque esa memoria es de la auditoría de mapa previa, no de esta ampliación de lore).

---

## Pasada de código de la sesión 2026-08-03 (mismo día)

Los 5 pendientes de arriba, llevados a código el mismo día en vez de quedar para otra sesión:

- **Torgash** (`worldCatalog.ts`): bio reescrita sin el duelo, con la culpa por la inacción Serhu.
  Mismo ajuste en un comentario suelto de `orco-enfurecido-hondonada` que citaba el viejo ejemplo.
- **`loreChunks.ts`**: 3 chunks reescritos (cultura/liderazgo orco, Clan Maktor, Clan Serhu, Torgash
  — 4 en total) + `npm run reindex-lore` (50/50 chunks, sin errores).
- **Canizor**: entrada completa en `worldCatalog.ts` (PLANTILLA, nivel 1-4, `domesticablePct` 45/
  `capturablePct` 20, `temperamento: CAUTELOSO` — no `AGRESIVO`, para no bloquear la doma con
  combate forzado), item nuevo `piel-canizor`, 3 harvest yields, y fila en `worldPopulation.ts`
  (200/320, población baja a propósito por ser solitario/territorial). Confirmado que se integra
  solo en encuentros ambientales (`turnResolution.ts` ya consulta `Npc` PLANTILLA + `WorldPopulation`
  por región de forma genérica, sin lista fija que tocar).
- **Tótem Maktor**: verificado en DB (`ItemCatalog.statBonusAttribute`/`statBonusAmount` ambos
  null) — ya era puramente cosmético, no hizo falta ningún cambio.
- **`worldPopulation.ts`, `orcos-llanuras`**: label corregido de "Maktor/Serhu" a "Clan Serhu"
  (el número 800/1.000 no cambia, ya era correcto).

Verificado: `tsc --noEmit` limpio, `npm run seed-catalog` (103 objetos, 25 NPCs, 53 recursos, 19
poblaciones), `vitest run` → **518/518 tests, 51 archivos**, incluidos los 2 que llevaban semanas
fallando de forma intermitente en `turn.integration.test.ts` (ahora también en verde).

---

## Sesión 2026-08-05 (tercera pasada) — Signeran, Kurig, pintura, el plan de Uhuld

- **El Signeran** (`razas.md` § Orcos): el duelo de honor formal tiene nombre y reglas propias —
  sin armadura, solo hacha orca simple, a muerte (dejar vivo al perdedor es deshonra para los
  dos). Tres vías dan derecho a un Signeran: autorización de la asamblea, descendencia directa de
  un jefe de tribu o de guerra, o el propio líder de la tribu retando a otro cuando su honor exige
  defensa (**corregido** — no es que el líder retado decida aceptar: es el líder quien reta,
  quedando a quien recibe el reto aceptar o no). No es un cauce para cualquier disputa personal,
  es el mecanismo real para retar la legitimidad de un liderazgo.
  **Corrección sobre lo escrito antes**: el tamaño del tótem funerario NO lo decide morir en
  duelo/cacería — lo decide el juicio posterior de la propia tribu sobre si esa vida mereció
  honor. Ya corregido en `razas.md`.
- **Pintura de clan** (`razas.md`): solo importa el color, no la forma — rojo Maktor, naranja
  casi marrón Serhu, verde oscuro Goshg, azul muy claro con blanco Helsig.
- **Los Kurig** (`areas.md` § Gobierno y asamblea): cada Terk'ikar designa 5 Kurig (rango de los
  más inteligentes) — uno por justicia/economía/diplomacia/logística/filosofía. No deciden, filtran
  qué llega a la asamblea y registran la información de su área. La justicia sigue este cauce
  según la gravedad del caso.
- **El plan real de Uhuld Koh y el secreto de Gorhorn** (`npcs.md` #13, `personajes.md` § Gorhorn
  — el hallazgo más importante de la sesión): Uhuld no tramaba una revuelta cualquiera — buscaba
  a un descendiente de "sangre fundadora" con derecho real a un Signeran contra la casta de Ketg.
  Ese descendiente era Gorhorn (por Krugo y Tevya), sin que ni Uhuld ni el propio Gorhorn lo
  supieran nunca. Anotado como secreto reservado en la ficha de Gorhorn, solo para el Narrador —
  gancho de muy largo recorrido, no para resolver en una sola partida.
- **Ulkha y Torgash confirmados como descendientes de Ketg** (`areas.md` § La casta de Ketg) — ya
  no queda "no necesariamente descendiente directa", están dentro de la casta de nacimiento.
- **Corrección de las incursiones Serhu** (`areas.md`): no es "cada 5 meses" por calendario — los
  Goirntes emiten la orden cuando la población Serhu crece, y el mismo mecanismo se usa contra
  TODOS los orcos de Berig, no solo contra los Serhu (que además hacen de brazo ejecutor sin
  verlo así).
- **Postura de Helsig/Goshg ante la guerra, resuelta** (`areas.md`): perfil neutral-defensivo,
  bajo perfil ante los Goirntes; han resistido bien hasta ahora, pero los Goirntes les mandan cada
  vez menos patrullas propias, cediendo esa labor a los Serhu (mismo mecanismo de arriba).

**Pendiente de código** (añadido a la sección de arriba): las bios de `worldCatalog.ts` para
Gistera/Orco Enfurecido ahora también deberían reflejar el plan de Uhuld si se reescriben — no
hace falta que citen el secreto de Gorhorn (eso es solo para el Narrador/lore, nunca debería
filtrarse a texto que el jugador pueda leer directo).

---

## Sesión 2026-08-05 (cuarta pasada) — asamblea, casta sin exilio, y "el primer golpe" Maktor

- **Quién se sienta en la asamblea + los 4 ayudantes de cada Kurig** (`areas.md`): Terk'ikar,
  Kort'ikar, los 5 Kurig, y cualquier orco que los Kurig consideren relacionado con el tema del
  día — cámara no fija, se completa según lo que haya que tratar.
- **La casta de Ketg no exilia** (`areas.md`): solo dos caminos para quien la desafía — quedarse
  y resignarse, o morir y desaparecer. Confirmado explícitamente: es una dictadura de verdad
  (rango social y sangre por encima de todo), no una asamblea corrompida a medias.
- **Corrección del Signeran** (`razas.md`): la tercera vía no es "el líder retado decide
  aceptar" — es el líder de la tribu quien reta a otro cuando su honor exige defensa, y es el
  retado quien acepta o no. Ya corregido.
- **"El primer golpe" — la guerra interna Maktor-Serhu y los 1.200 guerreros** (`areas.md` §
  Historia profunda + `cronologia.md`, ~año 2.900-2.950, provisional; el hallazgo más grande de
  esta pasada): la cultura Maktor originaria —pacífica, orgullosa, respetuosa con la naturaleza,
  estilo "Tauren" pero con esa parte salvaje que los empuja a demostrar su valía— libra una larga
  guerra interna contra los Serhu (la misma que ya empujaba la migración a Cristal Helado/Ciénaga
  Troncal). Los Maktor ganan un Signeran final, el Kort'ikar Maktor perdona la vida al líder
  Serhu vencido —el mayor error del clan— y confían en que baste para acabar la guerra. La casta
  de Ketg traiciona esa confianza informando a los Goirntes, que mandan 1.200 guerreros contra lo
  que queda del clan. **No es el mismo suceso que la revuelta del padre de Gorhorn** (año 4.000,
  confirmado con la usuaria) — es un golpe anterior y distinto, que no extingue a los Maktor pero
  los deja "maltrechos" durante el milenio siguiente. Explica, por primera vez, por qué el texto
  ya llamaba "maltrecho" al clan justo antes de la revuelta final.
- **Nombres puestos** (mismo día, a petición de la usuaria): el Kort'ikar Maktor que gana el
  Signeran es **Kadrog**; el líder Serhu al que vence y perdona la vida es **Mordek** (sucesor de
  Ketg dentro de la casta). Ya en `areas.md` § Historia profunda y en `cronologia.md`.

---

## Sesión 2026-08-05 (quinta pasada) — el Reino Nabierus y 19 zonas nuevas de las Llanuras

Cierre del lore orco (confirmado con la usuaria que los huecos restantes eran menores) y salto al
mapa regional de Las Llanuras del Viento Rojo: primero rutas/topología (sin cambios de código,
solo confirmación de que el grafo disperso ya fuerza rodeos — ver "Pendiente de código" para el
resto), después expansión real del mapa con zonas nuevas.

- **El Reino Nabierus y el origen del nombre de la región** (`cronologia-mitica.md`, nueva
  sección; `areas.md` § "Antes de los orcos"; `razas.md` § Nabieus, nuevo bloque "El Reino
  perdido" — el hallazgo más grande de esta pasada): mucho antes del año 0, un reino Nabierus se
  alzó en lo que hoy son Las Llanuras, volcado en investigar más de lo que a Madre le convenía —
  qué descubrieron exactamente queda deliberadamente sin resolver, gancho abierto para el futuro.
  Madre no ataca de forma directa: engaña a sus propias Semillas, que sin saberlo desatan sequía y
  viento hasta enterrar el reino bajo la arena roja que ellas mismas levantan. Los supervivientes
  huyen hacia El Margen Silencioso y, generaciones después, Ciénaga Troncal — antepasados directos
  de los Nabieus de hoy, y origen real de su cultura del silencio (antes de, no en vez de, la
  persecución Goirnte del Yugo de Hierro, que sigue en pie tal cual). La tierra queda desierta y
  muerta hasta que el Estallido y la gestación de los primeros orcos le devuelven vida —una nueva,
  no la original— y el viento, ya muy diluido de lo que fue, es el que da nombre a la región:
  **Las Llanuras del Viento Rojo**. Explica de una vez el color de la tierra, el nombre de la
  región y por qué el desierto ya estaba ahí cuando aparecieron los cuatro primeros orcos.
- **19 zonas nuevas, "Puntos de interés — Llanuras del Viento Rojo"** (`areas.md`, nuevo bloque
  "Tercera ampliación"): de una lista inicial de 20 candidatas presentadas por categoría (sabana,
  fosa de Espina del Viento, costa/playas, puesto Serhu de pesca, ruinas Nabierus, varias más), la
  usuaria las aprobó todas con dos ajustes — fusionar la Necrópolis de Arena dentro de La Ciudad
  Hundida (no tiene sentido como zona aparte sin gente viviendo cerca), y fusionar El Ojo de la
  Tormenta con el punto de origen del engaño de Madre en una sola zona, **El Vientre del Engaño**.
  De las 3 zonas de ruinas propiamente dichas (La Ciudad Hundida, El Archivo Cegado, El
  Observatorio Roto), solo quedan 2 accesibles hoy en superficie (Las Dunas Ahogadas, fragmentos
  sueltos; El Vientre del Engaño) — las otras 3 son contenido **futuro explícito**: un terremoto
  global (fecha sin fijar, provisionalmente ~10 años después del año 4.010 de arranque) abrirá
  grietas reales hacia la ciudad enterrada. Motivo de la usuaria: "la ciudad está muy profunda...
  el objetivo de Madre era ocultar lo que descubrieron" — hoy casi no hay rastro a propósito.
- **Ninguna de las 19 zonas está todavía en el grafo de viaje ni en el mapa visual** — ver
  "Pendiente de código" arriba. Solo son lore por ahora, tal y como pidió la usuaria ("lo
  implementas de forma más detallada en los md" — nada de código en esta pasada).

---

## Sesión 2026-08-05 (sexta pasada) — auditoría lore↔código, primera pasada de traslado

Petición explícita: "revisa los md y actualiza y contrasta con el código... asegúrate de que el
traslado es correcto". Auditoría de `backend/src/scripts/worldCatalog.ts` (2.959 líneas: locations,
locationLinks, npcs, fauna, items, harvestYields), `worldPopulation.ts` y
`backend/src/scripts/loreChunks.ts` (fragmentos RAG que alimentan al Narrador en vivo) contra los
`.md` de `docs/rpgtarkor/`. Sin acceso a Node/DB en este entorno — no se pudo correr
`tsc --noEmit`, `npm run seed-catalog`, `npm run reindex-lore` ni `vitest`; verificado solo por
lectura y comprobación manual de llaves/paréntesis balanceados en los archivos tocados.

- **Bios de `gistera-koh` y `orco-enfurecido-hondonada` reescritas** (`worldCatalog.ts`) — tenían
  la historia antigua (reto a duelo de honor rechazado) pese a que npcs.md #13/#14 la sustituyó
  por completo el 2026-08-05 (Uhuld Koh, el encargo Goirnte, la trampa). Ahora coinciden.
- **Nombres de líderes Helsig/Goshg añadidos a sus asentamientos** (`worldCatalog.ts`,
  `veta-helada` y `cerco-de-los-pilotes`): Terk'ikar Brenka/Kort'ikar Solgra y Terk'ikar
  Doshka/Kort'ikar Dulgren, ya confirmados en `areas.md` pero ausentes del catálogo.
  Deliberadamente sin NpcState propio todavía (ver "Pendiente de código").
- **Nueva `Location` `jeyselt`** (`worldCatalog.ts`, región Ciénaga Troncal): el poblado Nabieus
  del sur de la ciénaga (Keseg Prisilke / Fin Susurrado) ya vivía en `areas.md` desde antes de
  esta sesión de lore pero nunca había llegado al catálogo — `territorios-clan-goshg` también
  actualizado para mencionarlo, en vez de dar a entender que solo hay orcos en la región.
  Sin `locationLink` (fuera del núcleo jugable, mismo criterio que Hashma/Kegi).
- **`loreChunks.ts` puesto al día** (hallazgo más importante de la pasada: era el mayor foco de
  desincronización real, porque alimenta directamente al Narrador vía RAG, no solo la Enciclopedia)
  — añadidos: El Reino Nabierus/origen del nombre de la región, El Signeran, Personalidad y
  valores orcos, Tótems y rito funerario, Gistera Koh + Uhuld Koh, El Orco Enfurecido (los dos
  últimos no existían en absoluto pese a ser el encuentro del primer turno). Actualizados: Cultura
  y liderazgo (Kurig/asamblea), Clan Maktor (los dos golpes, Kadrog/Mordek), Clan Serhu (la casta
  de Ketg), Clan Helsig/Goshg (nombres de líderes).
- **`worldPopulation.ts` revisado, sin cambios** — el label de `orcos-llanuras` ya se había
  corregido en una pasada anterior; el resto de labels siguen alineados con `areas.md`.
- **19 zonas nuevas y su topología de rutas siguen sin trasladar** — confirmado como fuera de
  alcance de esta pasada (ver "Pendiente de código"), es un bloque de trabajo propio.

---

## Sesión 2026-08-05 (séptima pasada) — topología de rutas y traslado a código de las 16 zonas

Cierre del bloque pendiente de la sexta pasada: topología de rutas confirmada con la usuaria
(cadenas de un único cuello de botella por zona nueva, sin línea recta posible desde el núcleo) y
las 16 zonas ya triangulables trasladadas a código — solo quedan fuera las 3 zonas futuras del
terremoto (sin fecha, sin arista que triangular todavía).

- **Topología** (propuesta y aprobada tal cual): 4 cadenas + 2 sueltas, cada una colgada de un
  único nodo del núcleo ya existente — río hacia el mar (Los Manaderos → Oasis → Desembocadura →
  abanico costero de 4 puntos), desierto profundo (Las Agujas Imán → Fosa → Dunas → Vientre →
  Laberinto), volcánico (El Filo de las Brasas → Fumarolas), sabana (Los Pastos de la Deriva →
  Paso de los Huesos → Sabana Alta), más Vergel de Kegi (desde El Cruce de las Cenizas) y Grieta
  Cantora/Campo Yermo (desde El Osario de la Manada / Los Restos de Maktor). Ninguna arista nueva
  toca los 12 nodos originales entre sí — solo añade ramas nuevas.
- **`backend/src/scripts/worldCatalog.ts`**: 16 `Location` nuevas + 16 `locationLinks` (minutos,
  terreno, riesgo — mismo método 5 km/h/sinuosidad 1,1 que el resto del grafo). Verificado a mano:
  sin slugs duplicados, sin referencias colgantes en `locationLinks`, llaves/paréntesis
  balanceados (el desbalance de 1 paréntesis de todo el archivo es preexistente, no de esta
  pasada — confirmado no cambia entre antes/después de estos edits).
- **`frontend/src/data/map.ts`**: 16 nodos visuales nuevos. El Vergel de Kegi y La Grieta Cantora
  cuelgan de la posición VISUAL de sus padres (El Cruce de las Cenizas, El Osario de la Manada) en
  vez de la mecánica, mismo criterio ya establecido para el propio Cruce — el resto usa la misma
  coordenada que su tabla mecánica, sin ajuste visual propio (igual que Pastos de la
  Deriva/Filo de las Brasas).
- **`docs/13-escala-del-mundo.md` § 2.2ter**: tabla de coordenadas nueva, mismo formato que §
  2.2bis, con nota explícita del desacople visual de Vergel/Grieta.
- **Sin verificación en ejecución real** (ver "Pendiente de código" arriba) — este entorno no
  tiene Node/DB. `npm run seed-catalog`, `npm run reindex-lore`, `tsc -b` (frontend), `tsc
  --noEmit` (backend) y `vitest run` quedan pendientes de correr con el backend arrancado.
- **Bug de infraestructura real, encontrado jugando**: las 16 zonas nuevas no aparecían en el
  mapa tras esta pasada — `seed-catalog` nunca se corría solo, ni al arrancar ni en ningún otro
  momento automático, así que el catálogo de la partida real llevaba varias sesiones de lore
  desincronizado de `worldCatalog.ts` sin que nadie lo notara hasta que faltó contenido visible.
  Arreglado: `iniciar-tarkor.sh`/`.bat` ahora corren `npm run seed-catalog` solos en cada arranque
  (idempotente, rápido, sin Ollama de por medio). Además, `actualizar-mundo.sh` (nuevo, raíz del
  repo) corre `seed-catalog` + `reindex-lore` juntos bajo demanda, para cuando cambie
  `loreChunks.ts` de verdad — ese sí es lento (embeddings) y no conviene forzarlo en cada arranque
  normal. `docs/15-instalacion.md` § 5 y § 7 actualizados a juego.

---

## Sesión 2026-08-05 (octava pasada) — calibración visual de las 16 zonas, una a una

Con `seed-catalog` corriendo solo (séptima pasada), las 16 zonas aparecieron en el mapa pero mal
colocadas — los deltas triangulados matemáticamente (5 km/h, sinuosidad 1,1) no se habían
verificado contra la forma real del polígono de Azgaar, y varios nodos caían fuera de la región
(sobre todo la cadena del desierto profundo, muy al oeste). Sin `rsvg-convert`/Node en este
entorno para repetir el proceso de verificación que se usó para El Cruce de las Cenizas en su día,
se hizo a mano: quitados los 16 del mapa, añadidos y ajustados de uno en uno contra capturas
reales que compartió la usuaria, cada uno confirmado antes de pasar al siguiente.

- **Las 16 posiciones visuales de `frontend/src/data/map.ts` quedan recalibradas y confirmadas**
  — todas decoupleadas de su distancia triangulada real, mismo criterio que ya regía El Cruce de
  las Cenizas: son solo dibujo, los tiempos de viaje reales no cambian (siguen en
  `LocationLink`/`worldCatalog.ts`, sin tocar en esta pasada).
- **La tabla de `docs/13-escala-del-mundo.md` § 2.2ter queda desactualizada a propósito** — documenta
  la triangulación mecánica original, no el ajuste visual final a mano (mismo motivo por el que la
  nota del Cruce nunca reescribió su propia fila de esa tabla).
- **Lección para la próxima ampliación del mapa**: triangular matemáticamente da coordenadas
  mecánicamente consistentes, pero NO garantiza que caigan dentro del polígono real dibujado en
  Azgaar (que es irregular, no un rectángulo) — sin herramientas de renderizado en este entorno,
  la única vía fiable es calibrar a mano contra capturas reales, zona a zona, en vez de intentar
  acertar la geometría a ciegas de una vez.

---

## Sesión 2026-08-05 (novena pasada) — bug real: las líneas de ruta llevaban invisibles siempre

Al pedir que se dibujaran líneas de ruta en el mapa, encontrado un bug preexistente (no causado
por las zonas nuevas): tanto `InteractiveMap.tsx` como `MapZoomModal.tsx` ya dibujaban las
`<line>` de cada `LocationLink` con las coordenadas correctas, pero con
`stroke="var(--color-iron-600)"` — esa variable CSS **no existe** en `index.css` (solo
`--color-iron-700/800/900`), así que el stroke era inválido y la línea, invisible. Llevaba así
desde que se construyó la función, para los 12 nodos originales también, no solo los nuevos.
Arreglado en ambos archivos: `stroke="var(--color-wood-300)"` (color ya definido, usado en el
resto del mapa para líneas — buen contraste contra el fondo marrón). Sin verificación visual real
en este entorno (sin navegador) — pendiente de que la usuaria lo confirme en su próxima recarga.

---

## Sesión 2026-08-05 (décima pasada) — replanteo de la topología según posiciones reales confirmadas

Con las líneas de ruta ya visibles, la usuaria detectó que varias cruzaban el mapa sin sentido —
consecuencia directa de haber diseñado la topología ANTES de calibrar las posiciones visuales
reales (novena/octava pasada). Recalculadas las distancias reales entre TODOS los nodos (no solo
el padre asignado a ciegas originalmente) para encontrar la conexión geométricamente correcta.

- **La Grieta Cantora, reenganchada** (`worldCatalog.ts`): colgaba de El Osario de la Manada (en
  el núcleo, distancia real ~112 unidades) — tras confirmar su posición quedó junto a El Cruce de
  las Cenizas (~46 unidades). Reenganchada a El Cruce.
- **La costa, de abanico a cadena** (`worldCatalog.ts`): Playa/Pozas/Acantilados/Embarcadero
  colgaban las 4 directamente de La Desembocadura Callada, todas volviendo al mismo punto — pero
  las 4 están mucho más cerca entre sí que de la Desembocadura. Nueva cadena: Desembocadura → Pozas
  de Marea → (Playa de Ceniza Blanca / Acantilados Partidos → Embarcadero de Ceniza). Responde
  también a la pregunta de la usuaria de por qué la costa no se comunicaba consigo misma.
- **La Desembocadura Callada sigue en recalibración visual** (pendiente en esta misma pasada,
  última posición sin confirmar: -2, 42) — sus hijos de costa (arriba) ya asumen su cadena nueva
  independientemente de dónde acabe exactamente ella.
- Sin verificar en ejecución real (mismo motivo de siempre: sin Node/DB en este entorno) — revisado
  a mano que no quedan referencias colgantes ni aristas duplicadas tras el replanteo (34 aristas en
  total, igual que antes: 3 quitadas del abanico de costa + 3 añadidas en cadena).

---

## Sesión 2026-08-05 (undécima pasada) — bug real: `seed-catalog` nunca borraba rutas viejas + minutos recalculados

- **Bug real, encontrado jugando**: la usuaria vio una línea fantasma Desembocadura↔Restos de
  Maktor que no existía en `worldCatalog.ts` — `seed-catalog.ts` hacía `upsert` de cada
  `LocationLink` pero nunca `delete` de las que se quitan del código al reestructurar rutas (las 3
  del abanico de costa + `osario→grieta`, todas de la décima pasada, se habían quedado vivas en la
  DB). Arreglado: `seed-catalog.ts` ahora borra todas las `LocationLink` del mundo antes de
  recrearlas (mismo patrón "borra y recrea" que ya usaba `harvestYield`). Requiere volver a correr
  `npm run seed-catalog` para que se limpien las filas fantasma ya sembradas.
- **Minutos de las 16 aristas nuevas, recalculados por segunda vez** — con las 16 posiciones
  visuales ya confirmadas de verdad (décima pasada), se calculó la distancia recta real entre cada
  par y se encontraron varias inversiones (un punto más lejano costando menos que uno más cercano)
  — regla explícita de la usuaria: "los tiempos se mantienen siempre que la distancia tenga
  sentido... lo que no puede ser es que un punto del otro extremo nos lleve menos que uno que está
  más cerca y viceversa". Todas corregidas en `worldCatalog.ts`; la más notable, El Cruce de las
  Cenizas → La Grieta Cantora pasó de 150 a 320 minutos (era la arista más larga de toda la
  ampliación — 46 km reales — pero tenía de los minutos más bajos).
- **`docs/13-escala-del-mundo.md` § 2.2ter reescrita del todo** — ya no es la triangulación a
  ciegas original (superseded), ahora documenta las coordenadas VISUALES reales confirmadas
  (iguales a `map.ts`, sin desacople para estas 16 zonas) y los minutos ya corregidos, con el
  historial de las 3 versiones por las que pasó esta tabla en la misma sesión.
