# Propuestas de lore (OpenCode)

Registro de propuestas generadas por el agente `lore` de OpenCode (modelo local, Ollama).
Organizado por categoría; dentro de cada categoría, orden cronológico (más reciente al final).
Las propuestas ya revisadas salen de aquí: las aprobadas van a `propuestas-aprobadas.md` y las
descartadas, a `revision-lore.md`.
**Nunca se elimina contenido existente al añadir una entrada nueva** — solo se añade.

Formato de cada entrada:
[FECHA] — [tema tratado]
Estado: SIN REVISAR | APROBADA (...) | RECHAZADA (...)

[la propuesta completa, con el razonamiento, no solo la conclusión]

Archivos que tocaría si se aprueba: [lista de rutas en docs/rpgtarkor/]

Para revisar y trasladar una propuesta aprobada a `docs/rpgtarkor/`, sigue el proceso de
[docs/runbooks/ampliar-lore.md](../runbooks/ampliar-lore.md) (leer primero lo existente, detectar
contradicciones, verificar cronología, actualizar todos los .md afectados, registrar en el
checklist).

---


**Revisión del 2026-10-05** (encargada por la usuaria a Claude): las 9 propuestas que había se
revisaron contra el canon (`docs/canon-opencode/` y `docs/rpgtarkor/`), se corrigieron donde
chocaban y pasaron **todas** a [propuestas-aprobadas.md](propuestas-aprobadas.md) (ninguna se
descartó; dos se fusionaron en «Ciclo vital de los pueblos»): nombres de escisión, disposición de
las facciones, tablón de avisos por pueblo, economía de supervivencia, ganadería, ciclo vital y
población del Reino, renombrar el Bulco de Arena, y Dessa, Yerin y Riko como NPC.

**Revisión del 2026-10-06** (encargada por la usuaria a Claude): las 27 propuestas de OpenCode del
2026-10-03 (13 de historia y 14 de cultura, todas Faerus o Nabieus) se revisaron contra el canon.
Pasaron a [propuestas-aprobadas.md](propuestas-aprobadas.md) como fichas B-01 a B-08 (historia) y
C-01 a C-11 (costumbres Faerus), con correcciones y cinco fusiones; 4 se descartaron y están en
[revision-lore.md](revision-lore.md). Fallo que más se repite: inventar palabras Feg con sufijos
sin base o tomar palabras orcas y nabieus. Las propuestas de Claude de abajo (2026-10-05 y 06)
siguen SIN REVISAR: son para Álvaro.

## Categoría: Facciones y diplomacia

---

## Categoría: Razas y cultura

### 2026-10-06 — Los Serhu no saben crecer: vasallaje de armas con la Concordia (Fase D del 0.3)
**Estado: SIN REVISAR** (idea de la usuaria del 2026-10-06; mecánica en `CR-59`)

**Idea de la usuaria:**
- Los Serhu son un clan que no sabe crecer como civilización: muy guerrero (casi un tercio en armas)
  y siempre comiendo justo.
- Cuando pierden guerreros, lo que les sobra lo gastan en rearmarse.
- Las armas solo se las vende la Concordia de Hierro, muy caras y a crédito. Los Goirntes los
  controlan con esa deuda y obligándoles a mandar patrullas y escaramuzas por las Llanuras.
- Encaja con el control estrecho de los Goirntes sobre los Serhu desde el golpe de Ketg
  (`clanes-orcos.md`).

**Preguntas para Álvaro:**
1. ¿Vale como canon el comercio de armas a crédito y las patrullas obligadas?
2. Nabieus: ¿bajamos sus soldados al 5 % (vigías y espías), por ser sigilosos y no agresivos?
3. Faerus: ¿pelean todos los adultos de la manada ante una amenaza?

Archivos que tocaría si se aprueba: `docs/rpgtarkor/lore-mundo/clanes-orcos.md` (Serhu) y
`docs/rpgtarkor/lore-mundo/razas.md` (Nabieus y Faerus).

---

### 2026-10-06 — Monturas, tallas de los pueblos y porte de la fauna (Fase D del 0.3)
**Estado: SIN REVISAR** (decisiones de la usuaria del 2026-10-06 en la ronda de la Fase D; las
cifras son de Claude y provisionales)

**Idea de la usuaria (para el canon):** los **Faerus no suelen usar monturas**, sobre todo los del
Margen Silencioso: se mueven más rápido sin ellas. Montar es costumbre de los **Faerus de las
Llanuras**, que se han civilizado más. Los del Margen pueden montar, pero es raro.

**Regla de montura (usuaria):** un animal sirve de montura según su tamaño y su fuerza frente al
jinete. Lo que no vale para un orco puede valer para un Nabieu, y al revés. Propuesta de Claude: es
montable si mide al menos el 60 % de la altura del jinete y pesa al menos 3 veces lo que el jinete
con su equipo, y si su forma tiene lomo.

**Tallas provisionales de los pueblos** (solo la de los orcos es canon):

| Pueblo | Talla | Peso + equipo |
|---|---|---|
| Orcos | 2,10 m (canon) | 140 + 25 kg |
| Goirntes | 1,85 m | 115 + 35 kg (cuerpos densos, equipo de metal) |
| Nabieus | 1,75 m | 60 + 10 kg (cuerpos delgados) |
| Faerus | 1,60 m erguidos | 70 + 5 kg (fibrosos, de 2 a 4 patas) |

**Porte provisional de la fauna montable:**

| Especie | Altura a la cruz | Peso | La montan |
|---|---|---|---|
| Gargantúa de Ceniza | 2,2 m | 2.000 kg | Todos |
| Múrgol | 1,5 m | 600 kg | Todos |
| Corredor de Cauce | 1,4 m | 450 kg | Goirntes, Nabieus y Faerus (si se permite) |
| Cuernahoja | 1,4 m | 250 kg | Nabieus y Faerus |
| Canizor | 1,1 m | 280 kg | Nabieus y Faerus |

El resto de la fauna capturable no se monta: es pequeña o ligera, es un ave o no tiene lomo (el
Guchapo salta).

**Preguntas para Álvaro:**
1. Las tallas y pesos de Goirntes, Nabieus y Faerus.
2. ¿El Clan Maktor monta Canizores? Con estas cifras un orco no cabe; ¿los suyos son más grandes?
3. ¿El Corredor de Cauce (presa sagrada, con moratoria) puede ser montura, o nunca?
4. ¿El Guchapo, que almacena mucha agua, puede dar agua a un Reino que lo críe?

Archivos que tocaría si se aprueba: `docs/rpgtarkor/lore-mundo/razas.md` (tallas y la costumbre de
los Faerus), la ficha de cada especie en el bestiario y
`docs/rpgtarkor/sistemas-reino/construcciones-reino.md` (corrales).

---

### 2026-10-06 — Linajes de cada pueblo y el rastro de los Faerus (CR-52)
**Estado: PROPUESTA (idea de la usuaria, 2026-10-06; el motor la usará mientras Álvaro no diga otra cosa)**

**Acción de implementación:** añadir a `docs/rpgtarkor/lore-mundo/razas.md` si se aprueba.

Cada familia es un linaje que se hereda y que la historia de la partida sigue (venganzas y deudas
pasan a la familia). Ya hay base en el canon: los Ketg (Torgash, Ulkha), la familia Koh (Uhuld y
Gistera), el linaje Maktor que «continúa la hija mayor», las castas de función goirntes y las «casas y
linajes» de Vaelira.

| Pueblo | Cómo se hereda |
|---|---|
| Orcos | Apellido del progenitor de más rango; a igualdad, el de la madre (como Maktor) |
| Goirntes | Apellido y casta de función del padre |
| Nabieus | Apellido de la madre |
| Faerus | **Rastro** (ver abajo) |

**El rastro de los Faerus** (palabras de la usuaria): los Faerus no tienen apellido, pero sí una
diferenciación: un *rastro* que les permite, a través de los sentidos, detectar a qué familia pertenece
cada uno; pequeños grupos dentro de la manada. Se traduce en una palabra, como un apellido, pero es más
bien una pequeña manada dentro de la gran manada. Se escribe «Tasko, del rastro Veyra». La cría nace en
el rastro de la madre; si un rastro crece demasiado (más de 12), una pareja puede fundar uno nuevo.

**Preguntas para Álvaro:** ¿encaja la herencia de cada pueblo? ¿Tienen nombre propio en su lengua los
rastros y las castas?

---

### 2026-10-06 — Lo que valora cada pueblo (aprobación de compañeros, CR-15)
**Estado: PROPUESTA (Claude, por decisión Q9 de la usuaria del 2026-10-06; el motor ya la usa)**

**Acción de implementación:** añadir a `docs/rpgtarkor/lore-mundo/razas.md` si se aprueba.

Un compañero con mente juzga lo que hace la jugadora según sus valores (piedad, honor, codicia,
lealtad al clan, crueldad, prudencia), con un peso de −2 a +2. Los de cada pueblo, de partida
(después los matiza la personalidad de cada uno):

| Pueblo | Valores | Por qué |
|---|---|---|
| Orcos | lealtad al clan +2, honor +1, piedad −1 | Clanes por encima de todo; la cacería ritual y la ley del más fuerte |
| Goirntes | codicia +1, prudencia +1, honor +1 | El Edicto y el Tributo: cuentas claras, palabra dada y pocas aventuras |
| Nabieus | prudencia +2, piedad +1 | Pueblo paciente que escucha antes de actuar |
| Faerus | piedad +1, prudencia +1, crueldad −1 | Pocos y longevos: cada vida pesa |

**Preguntas para Álvaro:** ¿encajan con cada pueblo? ¿Algún compañero con nombre debería tener
valores propios (tabla a mano)?

---

---

## Categoría: Idiomas

---

## Categoría: Construcciones y reino

---

## Categoría: Historia y cronología

## Categoría: Lugares y geografía

---

## Categoría: Items

---

## Categoría: Fauna y flora

### 2026-10-06 — Ganadería: etapas de los animales, quién cría qué y el oficio de ganadero (CR-55)
**Estado: SIN REVISAR** (decisiones de la usuaria del 2026-10-06 en la ronda de `CR-55`; las cifras
son de Claude y provisionales)

- **Ganadero** (usuaria): oficio propio, distinto del Domador, que es una especialización de
  combate del Cazador. Pueblos y regiones con ganadero: orcos de las Llanuras, la Ciénaga y Cristal
  Helado; Faerus de las Llanuras y del Margen; Nabieus de la Ciénaga. **¿Crían animales los
  Goirntes?** Hoy no tienen ganadero.
- **Corrales del Domador y recinto de Múrgol:** el canon de las Llanuras distingue los «Corrales
  del Domador» (aclimatar bestias recién domadas) del gran recinto de Múrgol de fuera (el ganado).
  En el código el edificio de catálogo conserva su nombre canónico, pero su oficio es ya el de
  ganadero. ¿El recinto de Múrgol es un edificio aparte del ganadero, y los Corrales del Domador
  quedan para los compañeros de `CR-56`?
- **¿Quién enseña el oficio?** Provisionalmente, el Maestro Domador Serhu (vive entre los corrales de
  Karot Veku). ¿Es él, o hay un ganadero de oficio en el campamento?
- **Etapas de vida de la fauna** (por categoría, con ajuste por porte; un año son 120 días):

  | Categoría | Cría | Joven | Adulto desde | Vejez desde | Esperanza |
  |---|---|---|---|---|---|
  | Bestiones (Múrgol, Cuernahoja) | 0-30 d | 30-120 d | 1 año | 12 años | 15 años |
  | Bestiones grandes (Gargantúa) | 0-120 d | 1-4 años | 4 años | 40 años | 50 años |
  | Zancudos (Corretolvas) | 0-15 d | 15-60 d | 60 d | 5 años | 6 años |
  | Acechantes (Canizor) | 0-30 d | 30-120 d | 1 año | 8 años | 10 años |
  | Rondines (Coracelo) | 0-20 d | 20-90 d | 90 d | 6 años | 8 años |

- **Ya en el código, para revisar** (la usuaria dio libertad para ampliar el catálogo):
  - **Huevo de Corretolvas**: las hembras en corral ponen uno al día (en libertad los esconden en la
    hierba). 4 de `curaHambre`, 1 Goirno.
  - **Leche de Múrgol**: 3 al día por hembra adulta… y por macho (el motor no distingue aún).
  - **Pastoreo de las Llanuras**: los herbívoros pastan y solo necesitan la mitad de forraje.
    ¿Hay pasto natural en otras regiones (la Ciénaga, el Margen)?
- **Usos de la fauna** (`CR-56`, ficha en `cronista/usosFauna.ts`): guardias (Gargantúa, Canizor,
  Rondador de Brasas, Cruzavientos, Salamandra de Escoria), compañeros (además Aullador Rojo y Zense
  Ceniza) y monturas. Etapas provisionales de Corvenes (cría 20 d, adulto 90 d, vejez 6 años,
  esperanza 8) y Mudos salvajes (cría 30 d, adulto 1 año, vejez 10, esperanza 12). Rondador,
  Cruzavientos y Salamandra comen carne.
- **Petición (usuaria, con prioridad para orcos y Faerus):** fauna domesticable de guardia de Cristal
  Helado (Helsig), la Ciénaga (Goshg) y el Margen (Feg Tusha). Hoy solo las Llanuras tienen; los
  Serhu crían 6 Canizores y Feg Ger 3.
- **¿Qué «fibra» da el Coracelo?** Hoy no existe ningún objeto así; hasta saberlo no produce.
- **Rebaños iniciales:** los Serhu con 60 Múrgol y 20 Corretolvas en el recinto de Karot Veku. ¿Qué
  crían Helsig, Goshg, los Nabieus y los Faerus, y cuántos?

---

## Categoría: Personajes y NPCs

### 2026-10-05 — Bandas de renegados que patrullan (CR-49)
**Estado: SIN REVISAR** (propuesta de Claude por la decisión de la usuaria del 2026-10-05: las
personas también pelean en grupo; referencias: las patrullas de bandidos de Bellwright, de 2 o 3, y
los campamentos con cabecilla de Medieval Dynasty)

**Qué hay hoy:** tres plantillas hostiles sueltas que el motor trata como andamiaje de pruebas (no
salen en la Enciclopedia): el Goirnte Renegado y el Faerus Errático, que según su propia ficha vagan
por Las Agujas Imán, y el Nabieus Enloquecido, que perdió el contacto con El Margen Silencioso.
Ninguna aparece en el mapa.

**Propuesta:** convertirlas en contenido de verdad, como bandas pequeñas que patrullan:

| Banda | Dónde patrulla | Cuántos | Por qué ahí (canon) |
|---|---|---|---|
| Renegados goirntes | Las Agujas Imán (Llanuras del Viento Rojo) | 2-3 | Expulsados de la Meseta por deudas de honor; la ficha ya los sitúa ahí |
| Faerus erráticos | Las Agujas Imán | 2 | El campo magnético confunde el olfato y los separa de su manada (ficha actual) |
| Nabieus enloquecidos | Linde del Margen con las Llanuras | 2 | Perdieron el contacto con el Margen; rondan su borde sin volver a entrar |

- Una banda nunca mezcla pueblos (canon: los pueblos no se mezclan).
- Cada banda tiene un **cabecilla**: algo más de nivel e Inteligencia que el resto. Tira la moral
  por todos y, si cae, los demás tiran con desventaja. Se le nombraría «Cabecilla de los renegados»,
  «Cabecilla errático» y «Cabecilla enloquecido».
- Sin trama propia: son el peligro de los caminos, como las patrullas de Bellwright. Los
  campamentos de bandidos con refuerzos quedan para el `0.3` (`CR-50`).

**Preguntas para Álvaro:**
1. ¿Valen estas tres bandas y sus sitios, o prefieres otras (p. ej. desertores de la Concordia)?
2. ¿Llevan nombre propio las bandas o basta con lo que son?

Archivos que tocaría si se aprueba: `docs/rpgtarkor/lore-mundo/regiones/llanuras-del-viento-rojo.md`
(Las Agujas Imán), `docs/rpgtarkor/lore-mundo/regiones/margen-silencioso.md` (su linde) y
`docs/rpgtarkor/personajes/npcs.md` (las tres bandas y sus cabecillas).

---

## Categoría: Cultura

### 2026-10-06 — Tabú del Inacabado
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre no especificada en la descripción del Goirnte en las tablas de fauna y cultura.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Tabú del Inacabado (nirgoth — "incompleto")
- **Qué se hace, cuándo y quién:** Todo Goirnte siente malestar físico real cuando una tarea está a medias, un juramento sin cumplir o un objeto fuera de lugar. El tabú se refuerza con la cultura de las castas de función y el orden en cada sitio.
- **Por qué existe (origen):** La cultura de castas y orden de los Goirntes. El tabú se consolida con el establecimiento de las castas.
- **Qué pasa si se rompe:** Castigo psicosomático inmediato.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Malestar visible cuando algo está a medias, gestos de incomodidad, corrección compulsiva del entorno.

**Descripción:** Todo Goirnte siente malestar físico real cuando una tarea está a medias, un juramento sin cumplir o un objeto fuera de lugar. El tabú se refuerza con la cultura de las castas de función y el orden en cada sitio.

**Base física:** El "malestar físico" es una respuesta psicosomática a la percepción de estrés crónico; no es magia, no es sobrenatural.

**Canon que reutiliza:** Goirntes (`02-razas.md`), castas de función (`02-razas.md`), tabú: lo inacabado (`02-razas.md`), Concordia de Hierro (`facciones-npcs.md`), Tarsen Vold (`facciones-npcs.md`).

**Contradicciones detectadas:**
- ⚠️ "nirgoth" — verificar en `01-lenguas.md`.

**Preguntas abiertas para Álvaro:**
1. ¿El Goirnte de la frontera norte también siente el malestar?
2. ¿Hay variación dialectal en el nombre del tabú?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Lectura del Terreno con la Palma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre específica de los Nabieus que define su interacción con el terreno y el silencio.

**Ficha técnica:**
- **Raza o clan:** Nabieus · Lectura del Terreno con la Palma (Tovh'vhurne)
- **Qué se hace, cuándo y quién:** Se reúne en círculo de piedras en cualquier claro; cada uno con la palma en el suelo, nadie habla, solo se siente. Clanes Keseg Sael y Keseg Prisilke al menos una vez por año. Para decidir dónde acampar, si hay amenaza o si romper el silencio es necesario. Los silencios tienen gramática: cada pausa y cada contacto con el suelo cuenta como mensaje.
- **Por qué existe (origen):** Herencia del reino que Madre enterró. La huida al Margen requería detectar enemigos en el silencio absoluto. El cónclave es el único momento permitido donde los Nabieus comparten información sensible.
- **Qué pasa si se rompe:** Quien levanta la voz o habla sin necesidad: nadie le vuelve a hablar. El pacto rompe la confianza necesaria para el intercambio de información y la supervivencia.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Un círculo de figuras delgadas casi transparentes que se agachan y apoyan las palmas en el suelo. Se nota que nadie respira, no hacen ruido con el cuerpo ni siquiera moviendo el pelo o susurra la piel. Si alguien se da cuenta de lo que el grupo percibe (una presa, un enemigo), el cuerpo se tensa casi instantáneamente.

**Descripción:** Cada clan Nabier se pone en círculo con la palma apoyada en el suelo y en silencio absoluto. La piel gris apagada de los Nabieus atrapa la luz, permitiéndoles ver mejor las huellas y perturbaciones del terreno; sus nervios captan vibraciones y movimientos lejanos antes de que sean audibles para otros.

**Base física:** Sensibilidad táctil y auditiva excepcionales desarrolladas por la necesidad de moverse sigilosamente.

**Canon que reutiliza:** Nabieus (`02-razas.md`), Keseg Sael y Keseg Prisilke (`02-razas.md`), Tovh'vhurne (`02-razas.md`), Pacto del Umbral (`cronologia.md`), tabú: levantar la voz (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ "Tovh'vhurne" — verificar en `01-lenguas.md`.
- ⚠️ Se solapa con "Cónclave del Primer Silencio" (log anterior).

**Preguntas abiertas para Álvaro:**
1. ¿Qué pasa si un forastero rompe el silencio, se puede restablecer la confianza?
2. ¿Los forasteros aprenden esta costumbre?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Gramática de los Silencios
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre social de los Nabieus que usa su particular forma de comunicarse por pausas y silencios.

**Ficha técnica:**
- **Raza o clan:** Nabieus, Keseg Sael y Keseg Prisilke · Gramática de los Silencios
- **Qué se hace, cuándo y quién:** Conversaciones sociales y de negocios; nadie habla por turno, las pausas cuentan. Todos los adultos del clan. Para determinar verdad, mentira o nivel de respeto hacia el hablante.
- **Por qué existe (origen):** Entrenamiento para "alfabetizar" a los hijos: leer mentiras en las pausas es la "alfabetización" base. Supervivencia donde las palabras directas traen peligro. Solo los que pueden "leer silencios" sobreviven.
- **Qué pasa si se rompe:** Se marca al hablante como arrogante o mentiroso; si alguien insiste, se le excluye del grupo. Se rompe la confianza necesaria para el pacto del silencio.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Dos figuras delgadas que se miran con la cabeza ligeramente inclinada, sin hablar, y solo el cuerpo de uno tensa cuando el otro hace silencio. Se oye la respiración contenida, casi sin sonido. Los forasteros notan que no miran, solo escuchan y "leían" las pausas.

**Descripción:** En una conversación, los Nabieus miden los silencios como quien lee un libro: una pausa breve ("dot") es indiferencia o nerviosismo; dos pausas breves = duda; una pausa larga = mentira o reserva. Quien "rompe el ritmo" (hace pausa cuando no toca o habla demasiado seguido) muestra desprecio o arrogancia.

**Base física:** Entrenamiento de atención extrema desarrollado desde la huida al Margen.

**Canon que reutiliza:** Nabieus (`02-razas.md`), los silencios tienen gramática (`02-razas.md`), tabú: levantar la voz (`02-razas.md`), alfabetización: leer mentiras en las pausas (`02-razas.md`), Keseg Sael y Keseg Prisilke (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ Se solapa con el propio canon de `02-razas.md`.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre específico en lengua Nabier para las "pausas"?
2. ¿Cómo se enseña esto a los niños del clan?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Crónicas del Fuego
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre de transmisión oral no especificada: qué historias se cuentan, por qué, y qué propósito cumplen en la supervivencia.

**Ficha técnica:**
- **Raza o clan:** Faerus (clanes Hashma, Kegi, Feg Tusha/Feg Ger) · Crónicas del Fuego (Teldath-vel)
- **Qué se hace, cuándo y quién:** Se reúne al atardecer; el grupo se sienta alrededor del fuego. El que tiene más muescas en su Ashi'krul cuenta primero; luego los demás añaden lo aprendido. Los jóvenes aprenden a escuchar y a marcar; quienes no escuchan se castigan (quedarse fuera del grupo hasta la próxima caza).
- **Por qué existe (origen):** Preservar el conocimiento que la escritura no puede: qué rastro huele, qué peligro aprendiste, qué manada te acoge. Las historias no son ficción, son "historias de caza". La marca en el Ashi'krul es archivo, memoria externa.
- **Qué pasa si se rompe:** Si no escuchas, no "aprendes" y la manada no te acepta como nuevo miembro. La historia oral es el "libro" de los Faerus; sin ella, pierdes la memoria de la manada.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Un grupo de Faerus sentados junto al fuego, contando historias con gestos de caza, olfateando los mangos, dejando muescas, sin hablar demasiado. Los jóvenes se sientan con la mirada fija, no miran al fuego ni hablan.

**Descripción:** Cada noche, en grupos de no más de 5 o 6 Faerus sentados con los Ashi'krul a la distancia necesaria para sentir el calor pero no quemarse, un Faerus mayor cuenta una historia: qué peligro aprendieron, qué presas cayeron, qué rastro olfativo marcaron en un Ashi'krul antes, qué crías de la manada quedaron sin madre.

**Base física:** La transmisión oral y la memoria colectiva son mecanismos de supervivencia evolutiva.

**Canon que reutiliza:** Faerus (`02-razas.md`), historias junto al fuego (`02-razas.md`), leña de Telda (`02-razas.md`), muescas en el mango del Ashi'krul (`02-razas.md`), manada (`02-razas.md`), Hashma y Kegi (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ "Teldath-vel" — verificar en `01-lenguas.md`.
- ⚠️ "Ashi'krul" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre específico para las "muescas"?
2. ¿Cómo se transmiten las historias si el contador muere?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Ritual del Mensajero
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre específica del rol de mensajero de los Nabieus dentro de la Concordia, cómo se marcan y cómo responden al código Karo'sael.

**Ficha técnica:**
- **Raza o clan:** Nabieus (Keseg Sael y Keseg Prisilke) · Ritual del Mensajero
- **Qué se hace, cuándo y quién:** Antes del primer viaje oficial. El clan elige mensajeros, le quita armas y le da una tablilla de madera con códigos grabados; luego una cicatriz en la espalda con un filo de obsidiana. Adultos del clan, no niños ni menores.
- **Por qué existe (origen):** Integran en la Concordia a la fuerza como mensajeros sin poder llevar armas. El código Karo'sael protege su medio (el margen).
- **Qué pasa si se rompe:** Si el mensajero no entrega su código o le lleva información a un clan, la Concordia no le da apoyo en las rutas. Los mensajeros lo ignoran en las otras rutas.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Los mensajeros llevan tablillas de madera en su muñeca y se marcan contra el suelo antes de entrar a los pueblos. No traen espadas ni armas, solo su tablilla y el nombre de su ruta.

**Descripción:** Antes del primer viaje oficial, un Nabieus recibe una marca invisible en la piel de la espalda (una cicatriz que no se ve a menos que el rostro se incline hacia atrás). Cada mensajero lleva en la muñeca su "código" escrito en una tablilla de madera ligera. Cuando llega a su destino, debe leer el código y entregarse a los oficiales sin desviarse: "Karo'sael primero, Concordia segundo".

**Base física:** La "marca invisible" es una cicatriz interna por herida quirúrgica.

**Canon que reutiliza:** Keseg Sael y Keseg Prisilke (`02-razas.md`), Mensajeros forzosos en Concordia (`facciones-npcs.md`), Aven Tessk (NPC portavoz), código Karo'sael (`cronologia.md`), Pacto del Umbral (`cronologia.md`), Yugo (`cronologia.md`).

**Contradicciones detectadas:** Ninguna grave.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Nabier para la "tabla del mensajero"?
2. ¿Cómo se elige un mensajero?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Registro de la Investigación con Símbolos
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre específica de los Nabieus relacionados con sus tareas investigativas.

**Ficha técnica:**
- **Raza o clan:** Nabieus (Keseg Sael y Keseg Prisilke) · Registro de la Investigación con Símbolos (Krojoth)
- **Qué se hace, cuándo y quién:** Cada Nabieus investigador graba hallazgos en su tablilla personal antes del viaje y las cruza en el cónclave al terminar. Adultos de ambos clanes, especialmente los que buscan restos del reino perdido.
- **Por qué existe (origen):** Herencia de investigadores del reino que Madre enterró. Preservar datos sensibles sin dejar escritos permanentes.
- **Qué pasa si se rompe:** Si un investigador pierde su tablilla o falsifica datos: el clan lo excluye del registro y nadie le habla.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Figuras delgadas agachadas, observando con la palma, dibujando con estiletes en madera, cruzando las tablillas al terminar una expedición.

**Descripción:** Cada hallazgo importante (fósil raro, planta única, patrón de desplazamiento animal, dato geológico) se graba con un símbolo en una tablilla de madera ligera. Los símbolos se anotan en una secuencia: posición del hallazgo, tipo, dirección de desplazamiento, temperatura, humedad.

**Base física:** Los símbolos son un sistema de notación pictográfica.

**Canon que reutiliza:** Nabieus (`02-razas.md`), "Son investigadores por herencia del reino que Madre enterró" (`02-razas.md`), clanes de investigación (`02-razas.md`), cónclave (`02-razas.md`), Keseg'Vhurne (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ "Krojoth" — verificar.
- ⚠️ Se solapa con "Tablilla de los Susurros" (log anterior).

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Nabier para los símbolos?
2. ¿Cómo se enseñan a los jóvenes este sistema?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Transmisión del Ashi'krul
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre específica de Faerus sobre el ritual de pasarse el Ashi'krul cuando dice "pasa a quien querían" (que no se explica en `02-razas`).

**Ficha técnica:**
- **Raza o clan:** Faerus (todos los clanes: Feg Tusha, Feg Ger) · Transmisión del Ashi'krul (Krah'ash)
- **Qué se hace, cuándo y quién:** Cuando un Faerus muere o abandona la manada; el que "lo lleva" se presenta al grupo para que decidan quién lo recibe. Todos los miembros del clan. Para transferir el conocimiento registrado en el mango: cada muesca es una lección.
- **Por qué existe (origen):** Los títulos de mando no existen; la hacha es herramienta, no poder. Preservar el conocimiento en el mango, no en herencias de objetos.
- **Qué pasa si se rompe:** Si alguien "robó" el Ashi'krul de alguien que no lo ganó: la manada lo expulsa y lo marca como "no merecedor".
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Un grupo de Faerus observando cómo un miembro "recibe" una hacha de otro, mientras todos señalan con la mano las muescas en el mango.

**Descripción:** Cuando un Faerus muere, el que le lleva el Ashi'krul en herencia debe presentarlo al grupo y contar qué peligro superó, qué rastro olfativo aprendió o qué marca dejó en el mango. Un miembro del grupo con más muescas que el candidato "se la pasa" a cambio de que el candidato le enseñe lo que tiene en su mango.

**Base física:** El Ashi'krul no es un objeto de valor hereditario, sino una herramienta de aprendizaje.

**Canon que reutiliza:** Faerus (`02-razas.md`), Ashi'krul (`02-razas.md`), "a la manada" (`02-razas.md`), "muescas en el mango del Ashi'krul por cada presa o peligro aprendido" (`02-razas.md`), "su Ashi'krul pasa a quien querían" (`02-razas.md`), "no tiene títulos de mando" (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ "Krah'ash" — verificar en `01-lenguas.md`.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Faerus para "merecedor" o "no merecedor"?
2. ¿Qué pasa con el Ashi'krul de los Faerus que mueren en combate?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Primer Pieza Ritual
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre específica de los Faerus que explica cómo se celebra oficialmente el logro de adultez con la primera pieza a los 8 años.

**Ficha técnica:**
- **Raza o clan:** Faerus (Hashma, Kegi, Feg Tusha/Feg Ger) · Primer Pieza Ritual (Vash'grath-initial)
- **Qué se hace, cuándo y quién:** Al cumplir 8 años; el grupo se reúne frente al Jakut (Hashma) o frente a la Tolda (Kegi). El joven presentando su primera pieza, el grupo de mayores aceptando con susurros y gestos.
- **Por qué existe (origen):** Marcar la transición de cría a miembro activo de la manada. El grupo no niega la pieza al que falla, pero el primero debe hacerlo solo.
- **Qué pasa si se rompe:** Si el grupo niega la pieza o no la acepta: el joven queda fuera de la manada hasta demostrar otra caza.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Un grupo de Faerus reunidos frente al árbol o a la Tolda. El joven presentando su pieza, el grupo con susurros y gestos de aceptación.

**Descripción:** Al cumplir 8 años, un Faerus debe haber cazado algo con supervisión. El "Vash'grath" se marca formalmente en el cuerpo de la pieza y se lleva al grupo frente al Jakut. Los mayores no niegan la pieza al que falla (pueden ayudar), pero en este caso, el grupo "aplaude" con susurros y gestos.

**Base física:** No es magia; es un ritual social que marca la transición de niño a adulto.

**Canon que reutiliza:** Faerus (`02-razas.md`), crianza en común, adultos a los 8 con su primera pieza (`02-razas.md`), la manada es la única institución (`02-razas.md`), Vash'grath (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ Se solapa con "El Primer Rastro de Kiri" (log anterior).
- ⚠️ "Vash'grath-initial" — mezcla de lenguas.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Faerus para este ritual?
2. ¿Qué pasa si el primer cazo falla?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Inicio del Lazo Silencioso
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre que define el momento en que un joven Nabieus deja de ser "protegido" del clan y asume responsabilidades propias.

**Ficha técnica:**
- **Raza o clan:** Nabieus (Keseg Sael y Keseg Prisilke) · Inicio del Lazo Silencioso
- **Qué se hace, cuándo y quién:** Al cumplir 15 años o tras finalizar una investigación externa. El cónclave de su clan (Keseg Sael o Keseg Prisilke). Para reconocerlo como investigador con voz en el cónclave.
- **Por qué existe (origen):** Los Nabieus son investigadores por herencia del reino que Madre enterró. Marcar con silencio la transición de protegido a investigador oficial.
- **Qué pasa si se rompe:** Si no puede completar la investigación: permanece "protegido" hasta que pase el siguiente ciclo.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Un grupo de figuras delgadas sentadas en silencio absoluto. El iniciado con una muñeca marcando la línea obsidiana. El cónclave sin celebrar, solo reconocimiento silencioso tras dos minutos de silencio.

**Descripción:** Al cumplir 15 años, un Nabieus realiza su primera investigación formal fuera del clan de origen. Al volver, el cónclave lo "recibe" con una pausa de silencio de dos minutos, sin palabras. Si no se encuentra ninguna pregunta en sus respuestas, el cónclave lo marca con un símbolo en la muñeca.

**Base física:** El símbolo es una marca corporal por abrasión controlada con obsidiana.

**Canon que reutiliza:** Nabieus (`02-razas.md`), cónclave (`02-razas.md`), "leer mentiras en las pausas es 'alfabetización'" (`02-razas.md`), "levantar la voz" = tabú (`02-razas.md`).

**Contradicciones detectadas:** Ninguna grave.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Nabier para este ritual?
2. ¿Qué pasa si el iniciado fracasa en su primera investigación?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Saludo del Lazo
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre de encuentro entre clanes Nabieus o entre clan Nabieus y forastero.

**Ficha técnica:**
- **Raza o clan:** Nabieus (Keseg Sael y Keseg Prisilke) · Saludo del Lazo (Keseg'laa)
- **Qué se hace, cuándo y quién:** Cuando dos clanes se encuentran en un punto neutral; también para presentar a forasteros. Todos los presentes (adultos del clan receptor y forastero). Para marcar respeto mutuo y confirmar que nadie romperá el Pacto antes de hablar.
- **Por qué existe (origen):** El Pacto del Umbral dice que Keseg Sael y Keseg Prisilke no dicen a nadie dónde vive el otro clan.
- **Qué pasa si se rompe:** Si alguien se toca mal (puño cerrado, habla demasiado rápido, toca con agresión): el otro clan lo marca como "no respetuoso".
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Dos grupos de figuras delgadas que se tocan palmas sin apretar, con la mirada fija. Una pausa sincronizada de silencio, sin hablar.

**Descripción:** Cuando dos clanes o entidades se encuentran en un punto de encuentro neutral, todos tocan las palmas abiertas sin apretar durante exactamente 3 segundos antes de hablar.

**Base física:** No es magia; es un protocolo de respeto mutuo.

**Canon que reutiliza:** Keseg Sael y Keseg Prisilke (`02-razas.md`), Pacto del Umbral (`cronologia.md`), los silencios tienen gramática (`02-razas.md`), Levantar la voz (tabú) (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ "Keseg'laa" — verificar en `01-lenguas.md`.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Nabier para el "saludo del lazo"?
2. ¿Qué pasa con los forasteros que no entienden el gesto?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Camino de las Piedras Anual
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre de peregrinación/recordatorio histórico que los Faerus recorren cada año.

**Ficha técnica:**
- **Raza o clan:** Faerus (Hashma, Kegi, Feg Tusha/Feg Ger) · Camino de las Piedras Anual (Hashma-Claro-Kegi)
- **Qué se hace, cuándo y quién:** Final de la caza anual; el grupo recorre el sendero marcado con piedras. Todos los adultos de la manada, con los jóvenes siguiendo.
- **Por qué existe (origen):** Recordar la historia común de las manadas: Hashma, ruinas del Claro, Kegi. Marcar la evolución de las fronteras de caza tras cambios ambientales o conflictos con la Concordia.
- **Qué pasa si se rompe:** Si alguien no lleva su ofrenda o no sigue el sendero: queda fuera del registro anual.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Un sendero de piedras entre árboles, con Faerus que caminan en silencio, dejando madera, hachas viejas en cada parada.

**Descripción:** Al finalizar la caza anual, la manada recorre un sendero de piedra que va desde Hashma, pasando por las ruinas del Claro, hasta Kegi. En cada parada, se deja una ofrenda: en Hashma, madera vieja de Telda; en las ruinas, una hacha vieja; en Kegi, la primera pieza del año.

**Base física:** El "camino de las piedras" es una ruta física con marcadores de piedra.

**Canon que reutiliza:** Faerus (`02-razas.md`), camino de las piedras (`02-razas.md`), Hashma (`02-razas.md`), Kegi (`02-razas.md`), ruinas del Claro (`02-razas.md`), Telda (`02-razas.md`), Ashi'krul (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ Se solapa con "El Primer Rastro de Kiri" (log anterior).

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Faerus para el sendero?
2. ¿Qué ofrendas específicas lleva cada clan?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Tabú de las Profundidades Prohibidas
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de restricción sobre qué zonas o datos no pueden investigar los Nabieus.

**Ficha técnica:**
- **Raza o clan:** Nabieus (Keseg Sael y Keseg Prisilke) · Tabú de las Profundidades Prohibidas (Krojoth-tabú)
- **Qué se hace, cuándo y quién:** Cuando se acerca a zonas de la Concordia o a datos sensibles; detiene la investigación inmediatamente. Investigadores adultos de ambos clanes.
- **Por qué existe (origen):** "Karo'sael incluye callar dónde están los suyos" (Pacto del Umbral). Evitar revelaciones que pongan en riesgo el Pacto.
- **Qué pasa si se rompe:** Si un investigador cruza una zona prohibida: el clan lo marca como "traidor" y nadie le habla.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Figuras delgadas deteniéndose ante coordenadas específicas, no cruzando. Marcan líneas en su tablilla para delimitar la zona prohibida.

**Descripción:** Los Nabieus no investigan zonas marcadas por "el Yugo" (límites de Vresk Hes, Vresk Tuh, Vresk Kei) ni datos que podrían revelar ubicaciones de otros clanes.

**Base física:** No es magia; es una restricción logística y de seguridad.

**Canon que reutiliza:** Nabieus (`02-razas.md`), Yugo de Hierro (`cronologia.md`), Pacto del Umbral (`cronologia.md`), Concordia de Hierro (`facciones-npcs.md`), Vresk Hes, Vresk Tuh y Vresk Kei (`cronologia.md`).

**Contradicciones detectadas:**
- ⚠️ "Krojoth-tabú" — mezcla de lenguas.
- ⚠️ "Vresk Hes, Vresk Tuh, Vresk Kei" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Un Nabieus podría revelar la zona por necesidad?
2. ¿Cómo se define exactamente la "zona prohibida"?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Sello del Rastro
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre que explica cómo el Faerus identifica a su familia mediante el "rastro" (olfato).

**Ficha técnica:**
- **Raza o clan:** Faerus (Hashma, Kegi, Feg Tusha/Feg Ger) · Sello del Rastro (Rastroh)
- **Qué se hace, cuándo y quién:** Contacto habitual entre familiares; saludo formal entre desconocidos. Todos los Faerus. Para confirmar identidad y pertenencia familiar.
- **Por qué existe (origen):** Los Faerus no tienen palabras para "familia", solo "rastro". El olor identifica quiénes son del clan y quiénes no.
- **Qué pasa si se rompe:** Si un Faerus altera su rastro: lo marca como "intruso", lo expulsa.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Grupos de Faerus que se tocan el hocico y el cuello, oliéndose. Se nota que no hablan, solo reconocen por el olor.

**Descripción:** Cada Faerus tiene un "rastro" único (olor corporal) que se transmite de madre a crías. En un grupo de Faerus, se huelen el cuello y rozan el hocico para confirmar la identidad y la familia.

**Base física:** El "rastro" es olor corporal natural.

**Canon que reutiliza:** Faerus (`02-razas.md`), "rastro" = familia (`02-razas.md`), saludos oliendo el cuello y rozando el hocico (`02-razas.md`), "un forastero entra dejándose oler" (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ "Rastroh" — verificar en `01-lenguas.md`.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Faerus para "rastro"?
2. ¿Cómo se transmite el olor de los padres a las crías?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Pausa de Decisión Silenciosa
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de práctica específica de los Nabieus donde toman decisiones importantes mediante pausas de silencio en cónclaves.

**Ficha técnica:**
- **Raza o clan:** Nabieus (Keseg Sael y Keseg Prisilke) · Pausa de Decisión Silenciosa (Keseg'doma)
- **Qué se hace, cuándo y quién:** En cónclaves para decisiones importantes (rutas de investigación, aceptar forasteros, romper el silencio); todos los presentes (adultos de ambos clanes).
- **Por qué existe (origen):** La gramática de los silencios permite decidir sin hablar; el cónclave solo funciona si hay consenso silencioso.
- **Qué pasa si se rompe:** Si alguien rompe el silencio antes de terminar el periodo: la decisión no se toma y se marca "conflicto".
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Figuras delgadas sentadas en círculo de piedras, en silencio absoluto, sin moverse durante 5 minutos.

**Descripción:** En un cónclave para decisiones importantes, todos se sientan en silencio absoluto por 5 minutos. Si nadie se mueve o rompe el silencio antes de que termine el periodo: la decisión se toma (acuerdo universal). Si alguien rompe el silencio antes: la decisión no se toma y se reanuda el debate normal.

**Base física:** No es magia; es un método de consenso silencioso.

**Canon que reutiliza:** Nabieus (`02-razas`), "los silencios tienen gramática" (`02-razas`), "El cónclave" (`02-razas`), "nadie habla" en el cónclave (`02-razas`), Keseg Sael y Keseg Prisilke (`02-razas`), Pacto del Umbral (`cronologia.md`).

**Contradicciones detectadas:**
- ⚠️ "Keseg'doma" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Un forastero puede participar en este ritual?
2. ¿Qué pasa si alguien no puede mantener el silencio (miedo, trauma)?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Jerarquía del Cónclave
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de estructura política que explica cómo deciden los Nabieus sin gobierno central.

**Ficha técnica:**
- **Raza o clan:** Nabieus (Keseg Sael y Keseg Prisilke) · Jerarquía del Cónclave (Keseg'orde)
- **Qué se hace, cuándo y quién:** En cónclaves para decisiones importantes; los presentes deciden quiénes tienen voz por tiempo y experiencia. Todos los clanes, especialmente los Segadores.
- **Por qué existe (origen):** Sin gobierno central; la decisión se toma por quién lleva más tiempo en la manada y mantiene el Pacto. La clase Segador es exclusiva por su capacidad de silencio y memoria.
- **Qué pasa si se rompe:** Si alguien "roba" la voz o impone decisión sin experiencia: el cónclave lo marca por impotente o traidor.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Un grupo de figuras delgadas en círculo de piedras, sin hablar, donde algunos dictan sin levantar la voz.

**Descripción:** El liderazgo no es hereditario ni electo, sino que surge en el cónclave. Quien ha estado más tiempo en el círculo de piedras (Keseg'Vhurne), manteniendo el Pacto del Umbral, gana "voz" en las decisiones. Los Segadores tienen mayor peso por su capacidad de silencio y memoria de rutas.

**Base física:** Sistema de consenso por experiencia y reputación.

**Canon que reutiliza:** Nabieus (`02-razas.md`), sin gobierno central (`02-razas.md`), "decide quien está sentado en el Jakut mientras está sentado" (`02-razas.md`), Segador (exclusiva) (`02-razas.md`), Keseg'Vhurne (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ "Keseg'orde" — verificar.
- ⚠️ **"Jakut"** mencionado en un texto de Nabieus, pero el Jakut es de los Faerus. Confusión.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Nabier para "Keseg'orde"?
2. ¿Qué pasa con la clase Segador en la Concordia?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Nomenclatura del Clan
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre para nombrar los clanes Nabieus (Keseg + nombre).

**Ficha técnica:**
- **Raza o clan:** Nabieus (Keseg Sael y Keseg Prisilke) · Nomenclatura del Clan (Keseg-nombre)
- **Qué se hace, cuándo y quién:** Al establecer un nuevo clan o al renovar el nombre cada 10 años; todos los adultos del clan. Para elegir un nombre que defina su propósito y territorio.
- **Por qué existe (origen):** Sin gobierno central: cada clan se define por su nombre y propósito.
- **Qué pasa si se rompe:** Si un clan cambia su nombre sin consenso: la comunidad lo marca como "sin identidad".
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Un grupo de Nabieus reunidos para elegir nombre, discutiendo en silencio y decidiendo por consenso.

**Descripción:** Al establecerse un nuevo clan o agrupación, los miembros eligen un nombre que describe su especialidad: Sael ("protector" o "guardián") o Prisilke ("camino" o "frontera"). Los clanes renuevan sus nombres cada 10 años al elegir un "guardián" que defienda su propósito.

**Base física:** No es magia; es una convención social.

**Canon que reutiliza:** Nabieus (`02-razas.md`), "Nombran sus clanes 'Keseg + algo'" (`02-razas.md`), Keseg Sael y Keseg Prisilke (`02-razas.md`), Pacto del Umbral (`cronologia.md`), Yugo y Purga (`cronologia.md`).

**Contradicciones detectadas:**
- ⚠️ "Keseg-nombre" — mezcla de lenguas.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Nabier para "Keseg"?
2. ¿Los clanes pueden cambiar de nombre al cambiar su propósito?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

---

### 2026-10-06 — Ceremonia de la Última Pieza
**Estado: SIN REVISAR**

**Qué hueco cubre:** Hueco de costumbre que explica qué pasa cuando un Faerus no se recupera.

**Ficha técnica:**
- **Raza o clan:** Faerus (Hashma, Kegi, Feg Tusha/Feg Ger) · Ceremonia de la Última Pieza (Vash'grath-final)
- **Qué se hace, cuándo y quién:** Cuando un Faerus no se recupera de herida o enfermedad irreversible; el grupo recibe su última pieza. Todos los miembros del clan, sin el enfermo.
- **Por qué existe (origen):** Respetar los muertos que no pueden ser "huesos" de la selva. Guardar la memoria de quienes mueren en servicio (enfermedad, herida).
- **Qué pasa si se rompe:** Si no se recibe la última pieza: la manada olvida al que murió. La ofrenda se conserva en el cónclave.
- **Cómo lo notaría un forastero (lo que el Narrador puede describir):** Un grupo de Faerus que recibe una pieza de un enfermo que ya no caza. La pieza se guarda con cuidado, no se deja en la selva.

**Descripción:** Cuando un Faerus llega tan grave que no se recupera, deja de cazar y se queda a cuidar crías o enseñar. Cuando muere, no se le deja en la selva (Feg'nur se rompe); la manada recibe su última pieza (Vash'grath) y la guarda en el cónclave como ofrenda.

**Base física:** No es magia; es una práctica de respeto.

**Canon que reutiliza:** Faerus (`02-razas.md`), el herido que no se recupera se queda, cuida crías y enseña (`02-razas.md`), a los muertos se les huele una última vez (`02-razas.md`), Vash'grath (`02-razas.md`), selva (`02-razas.md`), Feg'nur (tabú) (`02-razas.md`).

**Contradicciones detectadas:**
- ⚠️ "Vash'grath-final" — mezcla de lenguas.
- ⚠️ **"muore"** → "muere" (typo).
- ⚠️ **"ultima"** → "última" (typo).

**Preguntas abiertas para Álvaro:**
1. ¿Existe un nombre en lengua Faerus para esta ceremonia?
2. ¿Qué pasa con los Faerus que mueren de vejez?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/cultura.md`

### 2026-10-07 — Vesh-krug
**Estado: SIN REVISAR**

**Qué hueco cubre:** La sección "Cultura" del catálogo necesita 1 rito o costumbre Goirnte que emane de su identidad: el tabú "lo inacabado".

**Ficha técnica:**
- **Raza o clan:** Goirntes · Vesh-krug ("cerrar día")
- **Qué se hace, cuándo y quién:** Al finalizar la jornada laboral, cada Goirnte verifica herramientas, tareas y juramentos anotados antes de descansar.
- **Por qué existe (origen):** El orden es su biología. El desorden causa estrés fisiológico real, producto de la selección evolutiva en una cultura donde el desastre requiere precisión.
- **Qué pasa si se rompe:** Si una tarea queda a medias: se marca en el registro pero el Goirnte siente opresión. Si un juramento no se cumple: se expulsa de la guardia activa y queda en "casta de reparación" hasta cumplir.
- **Cómo lo notaría un forastero:** Herramientas impecablemente alineadas, cero polvo en las estanterías. Al anochecer, grupos de Goirntes corriendo a terminar tareas pendientes — no por vanidad, por necesidad fisiológica.

**Descripción:** Al atardecer, cada Goirnte detiene su trabajo y verifica: (1) que todas sus herramientas tengan un lugar marcado; (2) que ninguna tarea quede en el medio sin anotación en el marcador de oficio; (3) que ningún juramento de la jornada sea olvidado.

**Base física:** El orden es su biología. El desorden causa estrés fisiológico real.

**Canon que reutiliza:** Goirntes (Semilla Goirme), Meseta del Orden, tabú "lo inacabado", metalurgia, leyes grabadas en obeliscos, El Baluarte de Goirme.

**Contradicciones detectadas:**
- ⚠️ "Vesh-krug" — verificar en `01-lenguas.md`.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un "marcador de cierre" en el catálogo de objetos?
2. ¿El Primer Censor Vold vigila personalmente o delega?
3. ¿Los Goirntes de la frontera norte tienen una versión simplificada?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md` (o crearlo)

---

### 2026-10-07 — Vorn-tel'goirme
**Estado: SIN REVISAR**

**Qué hueco cubre:** La sección "Cultura" del catálogo necesita 1 rito Goirnte que emane de su identidad: el tabú "lo inacabado" y las leyes grabadas en obeliscos.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Vorn-tel'goirme ("grabado en piedra")
- **Qué se hace, cuándo y quién:** Al llegar a la edad profesional (~10 años), cada joven pasa por un proceso de 2 días de prueba y recibe una runa grabada en la piedra del destino.
- **Por qué existe (origen):** La ley goirnte exige que cada función esté registrada en piedra; es una medida de control que evita errores y garantiza que nadie asuma una casta no verificada.
- **Qué pasa si se rompe:** Si alguien intenta falsificar o alterar una runa en la piedra, el goirnte es expulsado de facto y el maestro del registro le marca la runa como "cancelada" públicamente.
- **Cómo lo notaría un forastero:** Un taller lleno de grabadores de oficio: cada uno con su herramienta de precisión, sin prisa, meticulosos. Cada día se ven bloques de piedra de diferentes colores.

**Descripción:** Al llegar a la edad madura para la asignación de casta: (1) el joven presenta sus habilidades en el taller principal del Obelisco; (2) un maestro graba su perfil en una pizarra de caliza del mismo tipo que los obeliscos; (3) el nombre de su futura función se incide en la "piedra del destino" del baluarte.

**Base física:** Las runas son marcas físicas en piedras de roca caliza fina. No hay magia.

**Canon que reutiliza:** Goirntes (Semilla Goirme), leyes grabadas en obeliscos, Meseta del Orden, metalurgia superior, El Baluarte de Goirme.

**Contradicciones detectadas:**
- ⚠️ "expulso" → "expulsado" (typo).
- ⚠️ "metralía" → "metalurgia" (typo).

**Preguntas abiertas para Álvaro:**
1. ¿La runa de la casta se graba en piedra o en metal?
2. ¿Existe un registro central de las "piedras del destino"?
3. ¿Hay una herramienta de grabado especial en el catálogo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md` (o crearlo)

---

### 2026-10-07 — Oth-krul
**Estado: SIN REVISAR**

**Qué hueco cubre:** El canon indica que los Goirntes tienen "leyes grabadas en obeliscos" y "castas de función desde el nacimiento". Falta un rito que involucre los obeliscos mismos y la memoria de castas pasadas.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Oth-krul ("el momento que nadie habla")
- **Qué se hace, cuándo y quién:** Una vez al año (otoño), cada Goirnte se reúne en El Baluarte, coloca una piedra pulida con el nombre de un difunto de su casta, observa 12h de silencio, y actualiza la lista de vivos del obelisco.
- **Por qué existe (origen):** Las leyes goirntes exigen que la memoria esté grabada en piedra; el rito asegura que nadie sea olvidado.
- **Qué pasa si se rompe:** Si alguien rompe el silencio: los veteranos lo sancionan con reparación comunitaria (12h extra de trabajo) y su piedra se quita.
- **Cómo lo notaría un forastero:** Un campo silencioso y ordenado: los Goirntes con sus trajes de forja, herramientas limpias en las manos. Cada uno con los ojos cerrados, mirando el obelisco.

**Descripción:** Una vez al año, normalmente en otoño: (1) los metales se retiran de las forjas; (2) cada Goirnte se pone en formación alrededor del obelisco central; (3) cada uno coloca un pequeño bloque de metal pulido sobre la plataforma del obelisco, con una runa grabada con el nombre y la función del fallecido; (4) un silencio de 12 horas seguidas; (5) al finalizar, se graba el nombre del recién ingresado en la "lista de vivos" del obelisco.

**Base física:** Los obeliscos son de roca caliza calcinada. Los metales son de alta pureza, pulidos.

**Canon que reutiliza:** Goirntes, obeliscos, leyes grabadas, El Baluarte de Goirme, Metalla, Meseta del Orden.

**Contradicciones detectadas:**
- ⚠️ "polido" → "pulido" (typo).
- ⚠️ "veteranias" → "veteranos" (typo).
- ⚠️ "aprendizajes" → "aprendices" (typo).

**Preguntas abiertas para Álvaro:**
1. ¿Hay un NPC Goirnte que pueda presidir este rito?
2. ¿Existe un inventario de "piedras de memoria" en el catálogo?
3. ¿Se registra en cronología un evento histórico?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`
- `docs/rpgtarkor/historia/cronologia.md`

---

### 2026-10-07 — Signe-krul
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los orcos tienen el tabú "interrumpir un duelo aceptado (Signeran)". Falta un rito que acompañe a ese tabú: qué se hace después del duelo.

**Ficha técnica:**
- **Raza o clan:** Orcos · Signe-krul ("último duelo")
- **Qué se hace, cuándo y quién:** Tras un Signeran, si uno muere, el clan realiza una pira de honor, recita su nombre y clan en voz baja, quema el cuerpo y deja el tótem.
- **Por qué existe (origen):** El Signeran es un duelo a muerte que honra el honor personal; la costumbre asegura que se honre incluso al que perdió.
- **Qué pasa si se rompe:** Si alguien interrumpe el duelo o la pira: es un insulto directo al muerto y a su clan; el interviniente quedará marcado para un duelo futuro.
- **Cómo lo notaría un forastero:** Una pira de fuego con un tótem sobre ella; guerreros orcos con armas en sus manos, hablando en susurros.

**Descripción:** Tras un Signeran (duelo a muerte, sin armadura, hacha simple), si uno muere: (1) los guerreros de su clan acuden a la pira; (2) recitan su nombre y su clan en voz baja; (3) queman el cuerpo y se deja el tótem sobre la pira; (4) se comparte una pieza de carne ahumada con los familiares del muerto, para "cerrar la cuenta".

**Base física:** El respeto por el honor: no importa que el muerto haya perdido, su muerte es una demostración de honor.

**Canon que reutiliza:** Orcos, Signeran, tótem, tabú "interrumpir un duelo", quemar al muerto, clan Serhu.

**Contradicciones detectadas:**
- ⚠️ "Signe-krul" — verificar en `01-lenguas.md`.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un "tótem" estándar en el catálogo de items?
2. ¿El duelo Signeran ocurre en un lugar específico?
3. ¿La costumbre varía entre clanes?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Fesh-kruv
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "la mejor metalurgia de Helek Sirik". Falta un rito que conecte su excelencia metalúrgica con la responsabilidad comunitaria.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Fesh-kruv ("marca del forjador")
- **Qué se hace, cuándo y quién:** Cada vez que un forjador aprendiz recibe una herramienta, el maestro le marca el mango con su nombre y un día de entrega; cada 100 días el forjador debe presentar la herramienta para revisión.
- **Por qué existe (origen):** La metalurgia Goirnte es lo mejor de Helek Sirik; no hay desperdicio. Cada herramienta debe tener un responsable.
- **Qué pasa si se rompe:** Si la herramienta se rompe por negligencia: el forjador debe explicar la causa, limpiar el mango y repararla.
- **Cómo lo notaría un forastero:** Un taller lleno de herramientas limpias, cada mango con una pequeña runa grabada.

**Descripción:** Antes de ser entregada a un forjador aprendiz: (1) el maestro limpia la herramienta; (2) graba en el mango una pequeña runa con el nombre del forjador y el día de entrega; (3) el aprendiz pasa por un examen de 3 días; (4) tras aprobar, el maestro entrega la herramienta y pronuncia: "esta herramienta te pertenece, pero no te pertenece a ti".

**Base física:** Las herramientas son de metal de alta pureza, con mangos de madera forrada en sílice.

**Canon que reutiliza:** Goirntes, metalurgia mejor, El Baluarte de Goirme, leyes grabadas, Meseta del Orden, forjas.

**Contradicciones detectadas:**
- ⚠️ "runit" → "runa" (typo).
- ⚠️ "Fesh-kruv" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Existe una herramienta estándar en el catálogo con marca grabada?
2. ¿La runa de la marca es permanente o se borra?
3. ¿Hay un NPC forjador Goirnte en el catálogo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Vork-veer
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "piel gris, fría, casi mineral y quitinosa" y "Goirme da la simetría". Falta un rito que conecte directamente su origen (Goirme/Semilla) con su biología.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Vork-veer ("simetría del ser")
- **Qué se hace, cuándo y quién:** Cada semana (sábado), cada Goirnte verifica su simetría física, toca su piel fría para confirmar mineralidad, y registra anomalías en el registro del taller.
- **Por qué existe (origen):** Goirme dio la simetría a la Meseta; cada Goirnte debe mantener esa simetría.
- **Qué pasa si se rompe:** Si un Goirnte oculta una anomalía: es castigado con 3 días de limpieza de taller. Si una anomalía física es grave: se le asigna 10 días de reposo y tratamiento.
- **Cómo lo notaría un forastero:** Talleres de metal con espejos de piedra y Goirntes de pie, tocando su piel, mirando su rostro, sin prisa.

**Descripción:** (1) cada Goirnte se sitúa frente a un espejo de piedra pulida; (2) verifica que ambos lados del cuerpo sean simétricos; (3) toca su piel con la piel fría para confirmar que no ha ganado calidez ni impurezas; (4) si nota desviación, se la reporta al maestro.

**Base física:** La simetría física no es un tabú: es un reflejo de la simetría evolutiva que Goirme impuso.

**Canon que reutiliza:** Goirntes (Semilla Goirme), simetría, El Baluarte de Goirme, metalurgia, Meseta del Orden.

**Contradicciones detectadas:**
- ⚠️ "Vork-veer" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Existen espejos de piedra en el catálogo?
2. ¿Hay un NPC forjador que pueda presidir este rito?
3. ¿El rito varía entre castas?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Kral-der
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "piel gris, fría, casi mineral y quitinosa, que se tensa con un brillo metálico al concentrarse". Falta un rito que reconozca esta característica biológica como parte de la identidad racial.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Kral-der ("piel fría")
- **Qué se hace, cuándo y quién:** Cada primer día del mes, al amanecer, cada joven Goirnte debe alcanzar la temperatura de su piel en "frío mineral" antes de trabajar. Un maestro verifica con la palma.
- **Por qué existe (origen):** La piel mineral es su identidad racial; si se agita (se calienta), perderá precisión.
- **Qué pasa si se rompe:** Si un joven no puede mantener el "frío mineral" antes de mediodía: debe repetir el rito. Si un adulto falla: se asigna 10 días de reposo.
- **Cómo lo notaría un forastero:** Un taller con Goirntes en mesas de sílice, tocando su propia piel con las manos mientras respiran.

**Descripción:** (1) el joven se desviste de ropa extra; (2) se coloca en una mesa de trabajo; (3) un maestro lo toca con la palma para medir la temperatura de su piel; (4) si la piel está demasiado caliente: debe respirar, meditar y esperar.

**Base física:** La piel gris y casi mineral es un rasgo adaptativo de selección natural en un mundo frío de metal y hielo.

**Canon que reutiliza:** Goirntes (Semilla Goirme), piel fría y mineral, brillo metálico, El Baluarte de Goirme, metalurgia.

**Contradicciones detectadas:**
- ⚠️ "Kral-der" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Hay un objeto ritual de sílice en el catálogo?
2. ¿El rito varía entre castas?
3. ¿Existe un NPC maestro de control térmico?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Vesh-bril
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "mejor metalurgia de Helek Sirik" y "el desorden les causa malestar físico". Falta un rito que conecte su capacidad de "mirada de precisión física" con la toma de decisiones.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Vesh-bril ("mirada de precisión")
- **Qué se hace, cuándo y quién:** Cada mañana, antes de cualquier decisión o tarea, cada Goirnte practica el Vesh-bril para lograr su "brillo metálico".
- **Por qué existe (origen):** Los Goirntes tienen la mejor metalurgia; sus errores causan daños. El rito asegura precisión antes del trabajo.
- **Qué pasa si se rompe:** Si un Goirnte no logra el brillo, se asigna 10 minutos de descanso y repite. Si falla de nuevo: el maestro lo supervisa.
- **Cómo lo notaría un forastero:** Un taller tranquilo con Goirntes de pie, mirando pequeños objetos con atención.

**Descripción:** (1) el Goirnte se coloca en su lugar de trabajo; (2) respira profundo y se concentra en un objeto pequeño; (3) cuando el "brillo metálico" de su piel es visible, pronuncia: "Vesh-bril: visión clara, mente ordenada".

**Base física:** El brillo no es mágico: es un reflejo de la concentración y la oxigenación sanguínea mejorada.

**Canon que reutiliza:** Goirntes (Semilla Goirme), brillo metálico, Meseta del Orden, metalurgia superior, El Baluarte de Goirme.

**Contradicciones detectadas:**
- ⚠️ "Vesh-bril" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Hay un objeto de precisión en el catálogo?
2. ¿La mirada de precisión varía entre castas?
3. ¿Existe un NPC forjador que enseñe este rito?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Nesh-veer
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "mejor metalurgia de Helek Sirik" y "el desorden les causa malestar físico". Falta un rito que conecte su excelencia técnica con su filosofía de "nada inacabado".

**Ficha técnica:**
- **Raza o clan:** Goirntes · Nesh-veer ("reparación de error")
- **Qué se hace, cuándo y quién:** Cada vez que un Goirnte comete un error técnico: se limpia, se repara, se marca y se reintegra la pieza al taller con "lección aprendida".
- **Por qué existe (origen):** Los Goirntes tienen la mejor metalurgia y no desperdician. El error es una oportunidad de aprendizaje.
- **Qué pasa si se rompe:** Si un Goirnte tira una pieza "reparable": es un tabú. Se castiga con 5 días de limpieza de taller.
- **Cómo lo notaría un forastero:** Un taller lleno de piezas de metal perfectamente limpias, con forjadores que se detienen inmediatamente ante un error.

**Descripción:** (1) cuando un Goirnte comete un error técnico: deja de trabajar inmediatamente; (2) se coloca la pieza defectuosa en el "buzón de reparo"; (3) se limpia el área; (4) se repara la pieza; (5) se marca con una pequeña runa de "reparado".

**Base física:** Los Goirntes tienen la mejor metalurgia, no desperdician recursos.

**Canon que reutiliza:** Goirntes (mejor metalurgia), Meseta del Orden, El Baluarte de Goirme, herramientas metálicas, sílice.

**Contradicciones detectadas:**
- ⚠️ "Nesh-veer" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Hay un objeto ritual de "buzón de reparación" en el catálogo?
2. ¿La marca de "reparado" varía entre oficios?
3. ¿Existe un NPC maestro que enseñe este rito?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Ghor-krul
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "leyes grabadas en obeliscos" y una división política radical vs moderada. Falta un rito que conecte la "verdad de las leyes" con las castas de burocracia y defensa.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Ghor-krul ("verdad del obelisco")
- **Qué se hace, cuándo y quién:** Cuando una ley aplicada tiene consecuencias no previsibles, las castas de burocracia y defensa acuden al obelisco central, declaran la verdad y ajustan el grabado con una nueva inscripción.
- **Por qué existe (origen):** Las leyes grabadas en obeliscos son la autoridad suprema. Cuando aplican una ley y causan daño no previsible: deben declarar la verdad y ajustar la ley, no borrarla.
- **Qué pasa si se rompe:** Si alguien oculta el daño o evita el rito: se le expulsa de la casta y se borra su grabado en el obelisco.
- **Cómo lo notaría un forastero:** Los Goirntes de la burocracia y defensa con sus trajes de metal, reuniéndose en el obelisco con herramientas de grabado.

**Descripción:** (1) las castas de burocracia y defensa se reúnen en el obelisco central; (2) se abre la cámara del obelisco con la ley grabada; (3) se lee la ley y se explica la causa del daño; (4) se "declara" la verdad ante el obelisco; (5) el obelisco se ajusta con una nueva inscripción.

**Base física:** Las leyes son grabados en roca caliza con tinta de metal.

**Canon que reutiliza:** Goirntes, leyes grabadas en obeliscos, Primer Censor Tarsen Vold, Archimagistrada Yovenne Tal, burocracia, defensa, El Baluarte de Goirme.

**Contradicciones detectadas:**
- ⚠️ "Ghor-krul" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿El obelisco tiene una cámara visible?
2. ¿Existe un NPC de "guardián del obelisco"?
3. ¿La inscripción "declarada" varía entre castas?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Vash'krul
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Faerus comparten la "primera pieza de cada caza" (Vash'grath). Falta un rito que explique QUÉ SE HACE con esa pieza.

**Ficha técnica:**
- **Raza o clan:** Faerus · Vash'krul ("primera pieza")
- **Qué se hace, cuándo y quién:** A los 8 años, el joven Faerus caza su primera pieza, se presenta ante el Jakut, comparte la primera pieza (Vash'grath) con el grupo, y el "Juli" decide su admisión en la manada.
- **Por qué existe (origen):** Vash'grath define quién es de la manada. El rito asegura que solo se admitan a quienes saben cazar y compartir.
- **Qué pasa si se rompe:** Si alguien intenta tomar Vash'grath sin compartir: es expulsado de facto.
- **Cómo lo notaría un forastero:** Faerus con sus trajes, pieles cortas, mirando al Jakut. La primera pieza (Vash'grath) en una plataforma.

**Descripción:** (1) al cumplirse los 8 años, el joven Faerus caza su primera presa con sus propias manos; (2) lleva la pieza al Jakut; (3) se presenta ante el "Juli"; (4) comparte la primera pieza con todos los miembros; (5) el "Juli" decide si admitirlo.

**Base física:** El Vash'grath es la primera pieza compartida. Define quién es de la manada.

**Canon que reutiliza:** Faerus (Feg Tusha/Feg Ger), Vash'grath, Jakut, Ashi'krul, Telda, Hashma/Kegi, manada, 8 años, caza.

**Contradicciones detectadas:**
- ⚠️ "Faenus" → "Faerus" (typo).
- ⚠️ "young" → "joven" (anglicismo).
- ⚠️ "Juli" — verificar si existe.
- ⚠️ Se solapa con "Primer Pieza Ritual" (log anterior).

**Preguntas abiertas para Álvaro:**
1. ¿La primera pieza es animal, mineral o vegetal?
2. ¿El "Juli" es un NPC específico o un rol rotativo?
3. ¿El Ashi'krul con muescas está en el catálogo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Feg'nur-veer
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Faerus tienen el tabú "abandonar a un herido (Feg'nur)". Falta un rito que conecte directamente con esa obligación: cómo la manada cuida a los heridos que no pueden caminar o que no pueden recuperar.

**Ficha técnica:**
- **Raza o clan:** Faerus · Feg'nur-veer ("el herido que se queda")
- **Qué se hace, cuándo y quién:** Cuando un Faerus queda herido grave y no puede recuperar: la manada lo recibe con tareas no físicas. Si no se recupera en 3 meses: se deja en la selva con sus objetos.
- **Por qué existe (origen):** Feg'nur es un tabú: no abandonan a ningún herido. El rito asegura que nadie quede atrás.
- **Qué pasa si se rompe:** Si la manada abandona a un herido: se considera traición. El grupo es exiliado de facto.
- **Cómo lo notaría un forastero:** Una manada de Faerus que cuida a un herido, con tareas no físicas. Cuando el herido no se recupera: se le deja en la selva con sus objetos personales.

**Descripción:** (1) cuando un Faerus queda herido y no puede caminar: (2) la manada decide en el Jakut quién lo cuida; (3) se asignan tareas no físicas: cuidar crías, enseñar a otros, escuchar historias; (4) si no recobra la salud antes de 3 meses: se le deja en la selva con sus objetos; (5) su cuerpo se huele una última vez; (6) su Ashi'krul pasa a quien querían.

**Base física:** No hay magia. Es un rito de cuidado comunitario.

**Canon que reutiliza:** Faerus (manada, Jakut, Ashi'krul), tabú "abandonar a un herido (Feg'nur)", crías, Feg Tusha, Kegi, El Claro de la Manada.

**Contradicciones detectadas:**
- ⚠️ "Jacut" → "Jakut" (typo).
- ⚠️ "un" → "una" (typo).
- ⚠️ "Feg'nur-veer" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un objeto "tarea no física" en el catálogo?
2. ¿El Ashi'krul del herido que muere se deja en la selva o se pasa a otro?
3. ¿Hay un NPC Faerus que pueda ser "herido" o "guardián de crías"?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Yugh-tel
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen una división política interna entre el Primer Censor Tarsen Vold (radical) y la Archimagistrada Yovenne Tal (moderada). Falta un rito que conecte esta tensión con su estructura social.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Yugh-tel ("pausa del obelisco")
- **Qué se hace, cuándo y quién:** Cada 5 años, radicales y moderados se reúnen en El Baluarte, revisan la "pureza" de las leyes, y graban una runa de "pausa" si es necesario.
- **Por qué existe (origen):** La división política Goirnte es alta; el rito evita que las castas se fragmenten sin perder la cohesión.
- **Qué pasa si se rompe:** Si alguien oculta o altera una ley en el obelisco: se castiga con 10 días de reparación pública. Si no se celebra el rito: las castas se dividen, y la Concordia de Hierro cae.
- **Cómo lo notaría un forastero:** Los radicales y moderados reunidos en el obelisco con herramientas de grabado. Cada uno observa el obelisco, con ojos entrecerrados, sin prisa, meticulosos.

**Descripción:** (1) cada cinco años, los radicales y moderados se reúnen en El Baluarte de Goirme; (2) el obelisco central tiene grabadas todas las leyes; (3) se abre una "caja de inspección" del obelisco; (4) se revisa la "pureza" de las leyes; (5) si una ley necesita pausa: se graba una pequeña runa de "pausa".

**Base física:** El obelisco es de caliza fina grabada con herramientas de metal.

**Canon que reutiliza:** Goirntes, Tarsen Vold, Yovenne Tal, obeliscos, El Baluarte de Goirme, castas, Meseta del Orden.

**Contradicciones detectadas:**
- ⚠️ "Yugh-tel" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿La "caja de inspección" del obelisco existe en el catálogo de construcciones?
2. ¿Existen NPCs para Tarsen Vold y Yovenne Tal?
3. ¿El obelisco tiene una "caja" visible o es solo interno?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Oth-veil
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "ojos negro obsidiana" y "que se tensa con un brillo metálico al concentrarse". Falta un rito que reconozca este rasgo facial distintivo como parte de su identidad de concentración extrema.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Oth-veil ("ojo de obsidiana")
- **Qué se hace, cuándo y quién:** Antes de cada tarea crítica de metalurgia, cada Goirnte realiza el Oth-veil para verificar que sus ojos de obsidiana estén claros y tengan el "brillo metálico".
- **Por qué existe (origen):** La precisión en metalurgia requiere ojos claros. El rito asegura concentración máxima.
- **Qué pasa si se rompe:** Si un Goirnte trabaja con ojos turbios: su trabajo es rechazado y debe repetir el rito. Si un maestro lo detecta: el joven es sancionado con 5 días de reposo.
- **Cómo lo notaría un forastero:** Goirntes frente a espejos de obsidiana, respirando profundo, cerrando y abriendo los ojos.

**Descripción:** (1) el Goirnte se coloca frente al espejo de obsidiana del taller; (2) respira profundo y cierra los ojos 3 segundos; (3) al abrirlos: verifica que los ojos sean de color negro obsidiana y que se vea el "brillo metálico"; (4) si los ojos no están claros: debe repetir el rito; (5) una vez logrado: pronuncia: "Oth-veil: ojos claros, mente precisa".

**Base física:** Los ojos de negro obsidiana son un rasgo genético de los Goirntes.

**Canon que reutiliza:** Goirntes (ojos negro obsidiana), Meseta del Orden, metalurgia, El Baluarte de Goirme, espejos de obsidiana.

**Contradicciones detectadas:**
- ⚠️ "Oth-veil" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Los espejos de obsidiana existen en el catálogo de items?
2. ¿El Oth-veil varía entre castas?
3. ¿Hay un NPC Goirnte que pueda enseñar este rito?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Mosh'gath
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "los de la frontera norte son de piel más clara y más ágiles". Falta un rito que reconozca esta variante racial dentro del propio pueblo Goirnte.

**Ficha técnica:**
- **Raza o clan:** Goirntes (frontera norte) · Mosh'gath ("prueba de la frontera")
- **Qué se hace, cuándo y quién:** Cada 3 años, los jóvenes Goirntes de la frontera prueban su agilidad y resistencia; si lo logran: reciben el título de "Hijo del Viento Goirme" y acceso a las forjas.
- **Por qué existe (origen):** Los Goirntes de la frontera son más ágiles; el rito reconoce esta diferencia sin crear una subraza.
- **Qué pasa si se rompe:** Si alguien intenta pasar la prueba sin ser de la frontera: es sancionado con 5 días de limpieza. Si un Goirnte de la meseta ayuda a un frontera: se le permite participar en la próxima prueba.
- **Cómo lo notaría un forastero:** Una pista de obstáculos en las laderas de la Meseta, con Goirntes de piel clara corriendo y mostrando su velocidad.

**Descripción:** (1) los jóvenes Goirntes de la frontera navegan por un campo de obstáculos de piedra tallada; (2) deben completar la prueba en menos de 5 minutos; (3) si lo logran: reciben el título y el acceso a las forjas; (4) si no: deben repetirlo el año siguiente.

**Base física:** La agilidad de los Goirntes de la frontera es un rasgo genético adaptado a la topografía de la Meseta.

**Canon que reutiliza:** Goirntes (frontera norte, piel más clara, más ágil), Meseta del Orden, El Baluarte de Goirme, metalurgia.

**Contradicciones detectadas:**
- ⚠️ "Mosh'gath" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un "curso de obstáculos" en el catálogo de construcciones?
2. ¿El título "Hijo del Viento Goirme" tiene un objeto correspondiente?
3. ¿Hay un NPC Goirnte de la frontera en el catálogo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Gosh-krul
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes viven en "La Meseta del Orden" alrededor de El Baluarte de Goirme. Falta un rito que conecte a los Goirntes de la Meseta con la estructura física de su mundo: el obelisco no es solo un registro, sino un santuario.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Gosh-krul ("conexión obelisco")
- **Qué se hace, cuándo y quién:** Cada Goirnte recién asignado debe ir al obelisco más cercano de El Baluarte de Goirme, tocar su base con la palma derecha, y decir "Goirme" en voz baja antes de empezar a trabajar.
- **Por qué existe (origen):** El rito asegura que el Goirnte se conecte con el orden central antes de crear el desorden del trabajo.
- **Qué pasa si se rompe:** Si no hace el rito: no puede trabajar.
- **Cómo lo notaría un forastero:** Goirntes que llegan al obelisco, tocan su base con la mano derecha, dicen una palabra en voz baja, y se retiran a trabajar.

**Descripción:** (1) cada Goirnte recién asignado debe ir al obelisco más cercano; (2) toca su base con la palma derecha; (3) dice "Goirme" en voz baja; (4) vuelve a su lugar de trabajo.

**Base física:** El obelisco es un bloque de roca caliza de 3 metros de altura con runas grabadas.

**Canon que reutiliza:** Goirntes, El Baluarte de Goirme, obeliscos, Meseta del Orden, tabú desorden.

**Contradicciones detectadas:**
- ⚠️ "Gosh-krul" — verificar.
- ⚠️ Descripción cortada en el log. Completada.

**Preguntas abiertas para Álvaro:**
1. ¿El obelisco tiene algún tipo de marcador de "conexión"?
2. ¿El rito varía según la casta?
3. ¿Hay un NPC que presida el rito?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Tarn-veer
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "castas de función desde el nacimiento", "mejor metalurgia de Helek Sirik" y "Leyes grabadas en obeliscos". Falta un rito de aprobación final antes de que un aprendiz se convierta en forjador/cabaero/guerrero.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Tarn-veer ("aprobación del maestro")
- **Qué se hace, cuándo y quién:** Al final de la formación, cada joven Goirnte pasa el examen del maestro: 3 días sin errores, herramientas ordenadas, tareas completadas.
- **Por qué existe (origen):** Los Goirntes tienen la mejor metalurgia y castas de función desde el nacimiento; el rito asegura que cada miembro sea calificado.
- **Qué pasa si se rompe:** Si un joven es aprobado sin superar el examen: es expulsado del taller. Si un maestro aprueba a un aprendiz que no domina: el maestro es sancionado con 5 días de reparación de herramientas.
- **Cómo lo notaría un forastero:** Un maestro Goirnte evaluando a un joven con herramientas, verificando cada pieza y cada paso.

**Descripción:** (1) el joven aprendiz se presenta ante el maestro de su taller; (2) durante 3 días, debe ejecutar todas las tareas asignadas sin errores; (3) el día final, el maestro verifica: herramientas ordenadas, tareas completadas, juramentos cumplidos; (4) si aprueba: el maestro graba su nombre en su primera herramienta propia y lo recibe como "forjador/cabaero/guerrero"; (5) si no: debe repetir el ciclo de 2 semanas.

**Base física:** El rito es un protocolo técnico de evaluación de competencia.

**Canon que reutiliza:** Goirntes, castas, metalurgia, tabú "lo inacabado", El Baluarte de Goirme, leyes grabadas en obeliscos.

**Contradicciones detectadas:**
- ⚠️ "Tarn-veer" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿La herramienta propia de inicio es un item del catálogo?
2. ¿El rito varía entre castas?
3. ¿Hay un NPC "maestro de casta" en el catálogo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Mharr-kul
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen "piel gris, fría, casi mineral", "el desorden les causa malestar físico" y una estructura política. Falta un rito que conecte su fisiología de oxigenación lenta con el mantenimiento de la cohesión grupal.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Mharr-kul ("respiración colectiva")
- **Qué se hace, cuándo y quién:** Cada día (al mediodía), los Goirntes de guardia o burocracia se reúnen en círculo y respiran juntos 10 veces.
- **Por qué existe (origen):** El desorden les causa malestar físico. La respiración colectiva restaura el equilibrio cuando hay acumulación de tensión o estrés.
- **Qué pasa si se rompe:** Si alguien falta una respiración: se le sanciona con 1 día de limpieza. Si un Goirnte grita fuerte: se le sanciona con 3 días de aislamiento.
- **Cómo lo notaría un forastero:** Un círculo de Goirntes de pie, respirando en conjunto, sin hablar. Cada uno con los ojos cerrados, sincronizados.

**Descripción:** (1) los Goirntes de guardia o burocracia se reúnen en el patio del taller; (2) forman un círculo cerrado; (3) no hablan: respiran juntos, sin prisa; (4) el líder marca el ritmo con un grito corto "Hm" y una pausa de 2 segundos; (5) después de 10 respiraciones en conjunto: cada uno vuelve a su sitio.

**Base física:** La respiración colectiva es un protocolo fisiológico: la oxigenación sincronizada reduce el estrés y el malestar.

**Canon que reutiliza:** Goirntes, meseta, El Baluarte de Goirme, metalurgia, leyes grabadas, castas.

**Contradicciones detectadas:**
- ⚠️ "Mharr-kul" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Existe un NPC "líder de respiración" en el catálogo?
2. ¿El patio de taller tiene un diseño específico para este rito?
3. ¿El grito "Hm" es una palabra de la lengua Goirnte o solo un sonido?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`

---

### 2026-10-07 — Vold-krul
**Estado: SIN REVISAR**

**Qué hueco cubre:** Los Goirntes tienen una división política interna entre el Primer Censor Tarsen Vold (radical) y la Archimagistrada Yovenne Tal (moderada). Falta un rito que conecte esta tensión con su estructura social: un protocolo de reconciliación anual.

**Ficha técnica:**
- **Raza o clan:** Goirntes · Vold-krul ("mesa del lazo")
- **Qué se hace, cuándo y quién:** Una vez al año (solsticio), el Primer Censor y la Archimagistrada discuten los límites del poder en la Mesa del Lazo, 3 días sin armas.
- **Por qué existe (origen):** La división política Goirnte es alta entre radicales y moderados; el rito evita que la Concordia de Hierro se disuelva.
- **Qué pasa si se rompe:** Si alguien oculta o manipula la taza del lazo: es sancionado con 30 días de aislamiento en su celda. Si no hay acuerdo: se reporta al obelisco y se revisan las leyes grabadas.
- **Cómo lo notaría un forastero:** Dos Goirntes sentados frente a frente en una mesa de madera, sin armas, con la taza del lazo entre ellos.

**Descripción:** (1) cada 12 meses al mediodía del solsticio: (2) el Primer Censor y la Archimagistrada se reúnen en la Mesa del Lazo; (3) durante 3 días discuten los límites del poder; (4) no pueden usar armas: solo palabras y herramientas; (5) al finalizar: se firma la "taza del lazo" y se deja en la mesa; (6) si no hay acuerdo: se deja la taza sin firmar y se reporta al obelisco.

**Base física:** La Mesa del Lazo es una estructura de madera tallada con tres cuerdas trenzadas que simbolizan los límites del poder.

**Canon que reutiliza:** Primer Censor Tarsen Vold, Archimagistrada Yovenne Tal, El Baluarte de Goirme, Meseta del Orden, leyes grabadas en obeliscos, Concordia de Hierro.

**Contradicciones detectadas:**
- ⚠️ "Vold-krul" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿La Mesa del Lazo existe en el catálogo de construcciones?
2. ¿La "taza del lazo" es un item del catálogo?
3. ¿Hay un NPC para el Primer Censor o una Archimagistrada?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/catalogo/costumbres-ritos.md`
- `docs/rpgtarkor/catalogo/construcciones.md` (para la Mesa del Lazo)

## Categoría Recetas

### 2026-10-06 — Platos de Obrador y Gran obrador (CR-61)
**Estado: SIN REVISAR** (la usuaria decidió el 2026-10-06 que la cocina multiplique la comida:
Taller ×1,5, Obrador ×2, Gran obrador ×2,5). Hoy solo hay recetas de Taller (Cuajada de Múrgol,
Boungo asado, Pan de trigo escarlata, Panal endulzado). Faltan dos o tres platos por escalón, que
combinen ingredientes de cada región: p. ej. guiso de carne y raíz, queso curado de Múrgol. ¿Qué
platos cocina cada pueblo?
