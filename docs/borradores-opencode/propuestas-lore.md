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

### 2026-10-03 — Fundar el Cónclave del Primer Silencio
**Estado: SIN REVISAR**

**Qué hueco cubre:** "Del 0 al ~1.000: solo las ciudades numeradas. ¿Cómo vivían Faerus y Nabieus antes del Estallido?"

**Ficha técnica:**
- **Título:** Fundar el Cónclave del Primer Silencio
- **Era:** Mítica (sin año)
- **Tipo:** fundación · **Participantes reales:** Nabieus (descendientes de Kroj, clan recién huido del Reino enterrado)
- **Causas:** Los descendientes de Kroj, tras su segunda huida del Reino enterrado por Madre, necesitaban reunir sus conocimientos del terreno antes de ser integrados por la Concordia
- **Qué pasó:** Establecieron un círculo en el suelo rojo del Margen oriental como lugar de reunión ritual, donde aprenderían a leer el terreno con la palma, confirmando que las vibraciones del suelo recordaban a su ancestro enterrado. Esta práctica se convertirá en su alfabetización silenciosa
- **Consecuencias en el presente (4.010):** Los Nabieus del Refugio sin Nombre y de Jeyselt mantienen esta tradición de reunión, aunque ahora obligados por el correo Goirnte (Karo'sael). El cónclave no es edificio sino práctica ritual que sobrevive sin documentos
- **Documento que lo recuerda:** sin documento (los Nabieus y Faerus no escriben; el conocimiento se transmite mediante la práctica)

**Descripción:** En el vacío de la era mítica (antes del año 0, cuando los Faerus apenas llegaban a Hashma), los descendientes de Kroj que huyeron del Reino Nabierus enterrado encontraron en el suelo del Margen oriental su biblioteca viva. No levantaron piedras ni escribieron, pues carecían de los materiales de la Concordia. En su lugar establecieron un Cónclave en el suelo rojo: un círculo de piedras sueltas marcando el lugar donde la escucha con la palma (Tovh'vhurne) permitió encontrar por primera vez que el terreno mismo recordaba a su ancestro enterrado. La lección fue: "leer el suelo" no requiere pergamino, solo manos y pausas.

**Base física:** La capacidad de detección de vibración a través de la palma es biológica (receptores sensoriales especializados en la familia Nabierus). No es magia: es evolución biológica.

**Canon que reutiliza:** Kroj (semilla), Madre (figura enterrada), Margen oriental, Nabieus, escucha con la palma (Tovh'vhurne), Yugo de Hierro (~3.600), correo Goirnte, Karo'sael.

**Nombre:** En lengua Nabieus: Keseg'Vhurne (el cónclave de la escucha); en lengua común: Cónclave del Primer Silencio.

**Contradicciones detectadas:**
- ⚠️ "Keseg'Vhurne" — verificar en `01-lenguas.md`.
- ⚠️ "Tovh'vhurne" — verificar.
- ⚠️ "Refugio sin Nombre" y "Jeyselt" — verificar si existen.

**Preguntas abiertas para Álvaro:**
1. ¿Qué lección concreta del terreno "recordaba" a Madre?
2. ¿Qué objeto de la caza compartida (Vash'grath) se usaba en las primeras reuniones?
3. ¿Cómo sobrevivió esta tradición hasta 4.010 sin documentos físicos?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/nabieus.md`
- `docs/rpgtarkor/diccionarios/nabieus.md`

---

### 2026-10-03 — Pacto del Umbral del Refugio
**Estado: SIN REVISAR**

**Qué hueco cubre:** "Del ~3.650 al ~3.900: después de la Purga, antes de la Isla".

**Ficha técnica:**
- **Título:** Pacto del Umbral del Refugio
- **Era:** Común (~3.650–~3.850)
- **Tipo:** tratado · **Participantes reales:** Nabieus (clanes Margen y Ciénaga, Keseg Sael y Keseg Prisilke)
- **Causas:** La Purga Silenciosa dispersó a los Nabieus y los llevó a la supervivencia clandestina; sin documentos y sin armas, debieron unirse para no ser aislados por la Concordia
- **Qué pasó:** Se reunieron en el borde este del Margen (donde las vibraciones de la Ciénaga chocan con las Llanuras) para acordar normas de invisibilidad: no revelar ubicación, no mostrar señales, no invadir el territorio. Se selló con Vash'grath, no con escritura
- **Consecuencias en el presente (4.010):** El código Karo'sael (mensajería a través del Margen sin que ninguna columna entre) es la versión militar forzada de este pacto
- **Documento que lo recuerda:** sin documento

**Descripción:** Tras la Purga Silenciosa (~3.650), los clanes Nabieus recién asentados en el Refugio sin Nombre y Jeyselt debieron coordinar su ocultación sin escribir. En el borde este del Margen, donde la Ciénaga se mezcla con las Llanuras, los representantes de ambos clanes se reunieron a mano con pausas cuidadosas (Tannis'sael) para acordar: no revelar dónde están, no mostrar señales, no permitir que nadie entre en su territorio. El Pacto del Umbral se selló no con juramento escrito sino con la primera pieza compartida (Vash'grath). Cualquier Nabierus que violara el pacto se quedaría fuera del silencio y sería expuesto.

**Base física:** Los acuerdos se sellan compartiendo (no escribiendo) gracias a la capacidad de transmitir emociones en la caza compartida.

**Canon que reutiliza:** Nabieus, Purga Silenciosa (~3.650), Concordia de Hierro, Tannis'sael, Vash'grath, Karo'sael, Jeyselt, Refugio sin Nombre.

**Nombre:** En lengua Nabieus: no tiene nombre propio; en lengua común: Pacto del Umbral.

**Contradicciones detectadas:**
- ⚠️ "Tannis'sael" — verificar.
- ⚠️ "Keseg Prisilke" — verificar (parece ser "Keseg'Prisilke").

**Preguntas abiertas para Álvaro:**
1. ¿Qué objeto usado en la primera caza compartida se guardó como símbolo del pacto?
2. ¿Cómo se transmitió oralmente el acuerdo a los nuevos clanes durante ~300 años?
3. ¿Qué relación tiene este pacto con la autonomía parcial que obtuvo la población?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/canonical/pactos-nabieus.md`
- `docs/rpgtarkor/diccionarios/nabieus.md`

---

### 2026-10-03 — El Rito de la Primera Manada Aterrada
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~1.000 al 2.000: "¿qué les pasó a los pueblos (no a la fauna) durante los mil años salvajes?" — aplicado a Faerus en Hashma.

**Ficha técnica:**
- **Título:** El Rito de la Primera Manada Aterrada
- **Era:** Común (~1.200–~2.600)
- **Tipo:** Evento de adaptación (ritual) · **Participantes reales:** Faerus de Hashma (Feg Tusha)
- **Causas:** El Estallido cambió la fauna y flora en las Llanuras; los Faerus necesitaban adaptarse a las nuevas especies y mantener su caza compartida
- **Qué pasó:** Los Faerus desarrollaron un ritual de caza compartida reforzada: todos debían participar, no solo quien atrapaba. El Feg'nur se volvió obligatorio para mantener la cohesión en medio del caos
- **Consecuencias en el presente (4.010):** Este ritual sigue vigente en Hashma. Cuando Gorhorn huyó (4.000), los Faerus de Kegi le ofrecieron ayuda porque compartía la misma tradición de manada
- **Documento que lo recuerda:** sin documento

**Descripción:** Tras el Estallido (~1.000), especies nuevas, agresivas y mutadas aparecían en los límites de las Llanuras. Los Faerus de Hashma, que habían acabado de asentarse (año 0), vivían en la selva y necesitaban adaptarse. Sus corredores de caza eran demasiado vulnerables. Los viejos ritos de caza compartida colapsaron cuando aparecieron criaturas del Estallido, y algunos del clan morían sin Vash'grath. Los Faerus de Hashma se reunieron en El Claro de la Manada y crearon un nuevo ritual: antes del ataque, todos debían compartir la caza por turnos —no solo quien la atrapaba recibía la primera pieza, también quienes la ayudaron a atraer.

**Base física:** Coordinación de grupo mediante olores y vibraciones (no visión), que es su forma natural de cazar.

**Canon que reutiliza:** Faerus de Hashma (Feg Tusha), Estallido (~1.000), Vash'grath, Feg'nur, El Claro de la Manada, Hashma, Vaelira.

**Nombre:** En lengua Feg: sin nombre escrito; en lengua común: Rito de la Primera Manada Aterrada.

**Contradicciones detectadas:**
- ⚠️ "Faenus" → "Faerus".
- ⚠️ "El Claro de la Manada" — verificar.
- ⚠️ Se solapa con "La Gran Separación del Feg Tusha" y "El Tratado del Olfato".
- ⚠️ "Vaelira" — mencionado, verificar si existe.

**Preguntas abiertas para Álvaro:**
1. ¿Qué criatura del Estallido obligó a cambiar el ritual de caza original?
2. ¿Cómo se transmitió oralmente este ritual desde ~2.600 hasta 4.010?
3. ¿Qué relación tiene con el Pacto de la Primera Pieza (~2.300)?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/diccionarios/feg.md`

---

### 2026-10-03 — El Umbral del Rango en Hashma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del 0 al ~1.000: "¿Cómo vivían Faerus y Nabieus antes del Estallido?" — aplicado a Faerus de Hashma.

**Ficha técnica:**
- **Título:** El Umbral del Rango en Hashma
- **Era:** Mítica (~0 al ~600, sin años fijos) ⚠️ contradicción: "mítica" con año
- **Tipo:** fundación (organización comunitaria) · **Participantes reales:** Faerus de Hashma (Feg Tusha)
- **Causas:** Necesitaban organizar su manada antes del Estallido y definir cómo tomar decisiones sin escritura ni títulos
- **Qué pasó:** Los Faerus establecieron el Jakut (tronos) como lugar de decisión y acordaron usar Vash'grath (primera pieza) para consenso, sin jerarquías fijas
- **Consecuencias en el presente (4.010):** Gorhorn (ex-Maktor) huyó y fue acogido por los Faerus de Kegi porque compartían esta tradición
- **Documento que lo recuerda:** sin documento

**Descripción:** Tras el asentamiento inicial (año 0, Feg Tusha en Hashma), los Faerus de la selva occidental se encontraron con que su organización por manada necesitaba estructura. Durante los primeros ~600 años, cuando el Estallido aún no había cambiado el mundo, los Faerus de Hashma debieron definir quiénes eran y cómo vivir juntos sin líderes formales. Crearon el concepto de "Jakut" (tronos) como lugar de decisión, no cargo. Quien se sentaba en el Jakut, decidía, pero solo mientras estaba allí.

**Base física:** La organización por consenso (sin liderazgo fijo) es propia de los Faerus.

**Canon que reutiliza:** Feg Tusha (Hashma), Jakut (tronos), Vash'grath (primera pieza), Feg'nur, Estallido (~1.000), Concordia de Hierro.

**Nombre:** En lengua Feg: Vash'jakut; en lengua común: Umbral del Rango en Hashma.

**Contradicciones detectadas:**
- ⚠️ **"Era mítica (~0 al ~600)"** — contradicción. La era mítica es antes del año 0. Si tiene año, es era común.
- ⚠️ "Faenus" → "Faerus".
- ⚠️ "Vash'jakut" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Qué ritual específico se celebraba en el Jakut antes del Estallido?
2. ¿Cómo evolucionó este concepto hasta el Pacto de la Primera Pieza (~2.300)?
3. ¿Qué diferencia hubo entre la organización de Feg Tusha y la de Feg Ger?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/lore-mundo/hashma.md`

---

### 2026-10-03 — La Gran Separación del Feg Tusha
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~1.200 al ~2.600 — "¿qué les pasó a los pueblos durante los mil años salvajes?" — aplicado a Faerus de Hashma.

**Ficha técnica:**
- **Título:** La Gran Separación del Feg Tusha
- **Era:** Común (~1.300–~2.400)
- **Tipo:** catástrofe (división) · **Participantes reales:** Faerus de Hashma (Feg Tusha)
- **Causas:** El Estallido mutó especies y algunas comenzaban a cazar a los Faerus en lugar de huir
- **Qué pasó:** La manada se dividió en dos grupos: cazadores-apresadores (fuertes) y defensores (ancianos y débiles). La división duró ~1.100 años. No hubo violencia: fue una adaptación
- **Consecuencias en el presente (4.010):** La división se superó con el tiempo. Gorhorn (huyó por la huida) encontró a Faerus de Kegi porque compartían la tradición de manada
- **Documento que lo recuerda:** sin documento

**Descripción:** Tras el Estallido (~1.000), algunas especies nuevas que mutaron en las Llanuras comenzaban a cazar Faerus, no a huir de ellos. Los Faerus de Hashma, con su inteligencia fría y olfato agudo, notaron que ya no podían confiar en la caza tradicional. Algunos individuos (los fuertes, los mejor armados con colmillos) se separaron de la manada y se volvieron cazadores-apresadores, mientras otros (los débiles, los ancianos) huyeron hacia el corazón de la selva y se concentraron en la defensa pasiva y la caza menor.

**Base física:** Separación de grupo es propia de animales sociales. Los Faerus sobrevivieron mediante especialización.

**Canon que reutiliza:** Faerus de Hashma (Feg Tusha), Estallido (~1.000), Feg'nur, Vash'grath, Hashma.

**Nombre:** En lengua Feg: sin nombre; en lengua común: La Gran Separación del Feg Tusha.

**Contradicciones detectadas:**
- ⚠️ **Se solapa con "El Rito de la Primera Manada Aterrada".** Son dos versiones del mismo evento.
- ⚠️ "Faenus" → "Faerus".

**Preguntas abiertas para Álvaro:**
1. ¿Qué mutación específica comenzó a cazar a los Faerus alrededor de ~1.300?
2. ¿Cómo se reintegraron las dos manadas tras el ~2.400?
3. ¿Qué relación tiene esto con el Pacto de la Primera Pieza (~2.300)?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/diccionarios/feg.md`

---

### 2026-10-03 — La Ruta de los Colmillos en Hashma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del 0 al ~1.000 — aplicado a Faerus de Hashma durante su expansión territorial (600–900).

**Ficha técnica:**
- **Título:** La Ruta de los Colmillos en Hashma
- **Era:** Común (~600–~900, antes del Estallido)
- **Tipo:** descubrimiento (red de caza) · **Participantes reales:** Faerus de Hashma (Feg Tusha)
- **Causas:** Necesitaban encontrar presas nuevas y coordinar sin escritura ni líderes fijos
- **Qué pasó:** Desarrollaron un sistema de señales basado en marcas de caza (piezas) y olores, sin escritura
- **Consecuencias en el presente (4.010):** El sistema se perdió con el Estallido. Gorhorn no tiene registros de este método. Los Faerus actuales no usan señales
- **Documento que lo recuerda:** sin documento

**Descripción:** Tras el asentamiento final en Hashma (año 0), los Faerus necesitaban encontrar nuevas zonas de caza, ya que la selva se saturaba de presas. Durante ~900, exploraron hacia el este, bordeando el margen con los Faerus de Kegi. Desarrollaron un sistema de señales basado en olores y marcas de caza para comunicar dónde había presas. La señal consistía en colocar una pieza de la caza en el suelo de una manera específica: una pieza colocada de lado indicaba caza disponible, una colocada boca abajo indicaba peligro, y una colocada boca arriba indicaba territorio de Faerus.

**Base física:** La señalización no requiere escritura, es comunicación no verbal.

**Canon que reutiliza:** Faerus de Hashma (Feg Tusha), Estallido (~1.000), Vash'grath, El Claro de la Manada.

**Nombre:** En lengua Feg: sin nombre; en lengua común: Ruta de los Colmillos.

**Contradicciones detectadas:**
- ⚠️ "Faenus" → "Faerus".
- ⚠️ "Año 3.650" mencionado en el texto pero sin contexto.
- ⚠️ "Puesto de la Manada" mencionado pero no verificado.

**Preguntas abiertas para Álvaro:**
1. ¿Cómo se distinguían las señales de los Goirntes de las de los Faerus?
2. ¿Qué animal de Hashma era usado como indicador de la calidad de la caza?
3. ¿Por qué el sistema se perdió tras el Estallido y no pudo restaurarse?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/diccionarios/feg.md`

---

### 2026-10-03 — Rito de las Raíces en Hashma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~1.200 al ~1.800 — aplicado a Faerus de Hashma en relación con la flora cambiada por el Estallido.

**Ficha técnica:**
- **Título:** Rito de las Raíces en Hashma
- **Era:** Común (~1.700)
- **Tipo:** descubrimiento (adaptación) · **Participantes reales:** Faerus de Hashma (Feg Tusha)
- **Causas:** El Estallido mató la mayoría de la flora; los Faerus necesitaban encontrar plantas que sobrevivieran
- **Qué pasó:** Los Faerus organizaron rituales para proteger árboles de corteza densa y cultivar sus semillas en lugar de solo extraer. Se convirtieron en cuidadores de la selva
- **Consecuencias en el presente (4.010):** Cuando Gorhorn huyó (4.000), los Faerus de Kegi sabían que podía adaptarse porque su manada también tenía tradición de cuidar la selva
- **Documento que lo recuerda:** sin documento

**Descripción:** Tras el Estallido (~1.000), muchas plantas de Hashma murieron con las mutaciones salvajes. Alrededor de 1.700, los Faerus de Hashma notaron que ciertos árboles de corteza densa sobrevivían. Los ancianos Feg Tusha organizaron rituales para proteger y propagar estas plantas. El ritual consistía en: plantar con la mano (sin herramientas) y cubrir con hojas muertas. Si sobrevivía, se guardaba como semilla para el siguiente ciclo. Si moría, se enterraba en la tumba del anciano que descubrió el árbol.

**Base física:** Los Faerus pueden adaptar su relación ambiental mediante experimentación.

**Canon que reutiliza:** Faerus de Hashma (Feg Tusha), Estallido (~1.000), Feg'nur, Vash'grath, Hashma.

**Nombre:** En lengua Feg: Vash'feg (manada que cuida); en lengua común: Rito de las Raíces.

**Contradicciones detectadas:**
- ⚠️ "Faenus" → "Faerus".
- ⚠️ "Vash'feg" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Qué árbol específico de Hashma resistía las mutaciones del Estallido?
2. ¿Cómo se distinguía el árbol que se debía proteger del resto?
3. ¿Qué relación tiene este rito con el Feg'nur?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/catalogo/flora-minerales.md`

---

### 2026-10-03 — El Tratado del Olfato en Hashma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~1.400 al ~2.000 — aplicado a Faerus de Hashma en relación con las nuevas especies mutadas.

**Ficha técnica:**
- **Título:** El Tratado del Olfato en Hashma
- **Era:** Común (~1.600)
- **Tipo:** descubrimiento (clasificación olfativa) · **Participantes reales:** Faerus de Hashma (Feg Tusha)
- **Causas:** Necesitaban decidir qué especies cazar y qué especies evitar tras el Estallido
- **Qué pasó:** Desarrollaron un sistema de clasificación olfativa para distinguir entre especies peligrosas, comestibles y neutras, aprendiendo a proteger a las especies neutras como indicadores del ecosistema
- **Consecuencias en el presente (4.010):** Gorhorn aprendió de los Faerus de Kegi a usar su olfato para clasificar criaturas peligrosas tras el Detonante
- **Documento que lo recuerda:** sin documento

**Descripción:** Tras el Estallido (~1.000), especies nuevas mutadas (Kirelon, Salamandra, Imanio, Nuente) poblaron las Llanuras. Los Faerus de Hashma necesitaron decidir qué cazar y qué evitar. En ~1.600, desarrollaron un sistema de clasificación olfativa: distinguían entre especies peligrosas, comestibles y neutras. Los Faerus aprendieron a seguir a las especies neutras sin atacar, usando su olfato para detectar si una criatura había matado o había sido comida por otra especie.

**Base física:** El olfato es un sentido biológico natural.

**Canon que reutiliza:** Faerus de Hashma (Feg Tusha), Estallido (~1.000), Feg'nur, Vash'grath, Kirelon, Salamandra, Imanio, Nuente.

**Nombre:** En lengua Feg: Ashi'tugh (el olfato de honor); en lengua común: Tratado del Olfato.

**Contradicciones detectadas:**
- ⚠️ "Ashi'tugh" — verificar.
- ⚠️ **Se solapa con "El Rito de la Primera Manada Aterrada"** (mismo periodo, misma adaptación).

**Preguntas abiertas para Álvaro:**
1. ¿Qué criatura específica fue usada como indicador de salud del ecosistema?
2. ¿Cómo se diferenció la clasificación olfativa de la goirnte?
3. ¿Qué relación tiene este sistema con el Pacto de la Primera Pieza (~2.300)?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/catalogo/fauna.md`

---

### 2026-10-03 — El Juramento de la Tolda en Hashma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~2.100 al ~2.600 — "La Senda del Sílice: comercio Helsig ↔ Goshg por el borde este de las Llanuras" — aplicado a Faerus que facilitan el comercio.

**Ficha técnica:**
- **Título:** El Juramento de la Tolda en Hashma
- **Era:** Común (~2.500)
- **Tipo:** tratado (comercio) · **Participantes reales:** Faerus de Hashma (Feg Tusha), clanes Helsig y Goshg
- **Causas:** Los clanes Goshg y Helsig necesitaban comerciar sin intervención Goirnte; los Faerus ofrecían neutralidad
- **Qué pasó:** Los Faerus aceptaron transporte solo con Vash'grath como pago, estableciendo una tolda de encuentro bajo árboles donde intercambiaron materiales sin que entraran las columnas Goirnte
- **Consecuencias en el presente (4.010):** Gorhorn aprendió que los Faerus de Kegi también transportaban materiales con Vash'grath. Los Faerus actuales siguen el mismo principio
- **Documento que lo recuerda:** sin documento

**Descripción:** Durante ~2.500, los Faerus de Hashma ofrecieron sus servicios como mensajeros y transportistas entre los clanes orcos en la Senda del Sílice. Los Helsig necesitaban madera de los Goshg, y los Goirntes necesitaban ambas. Los Faerus aceptaron solo si se les pagaba con Vash'grath, no con monedas: si no aceptaban la primera pieza, no transportaban. Así evitaban el Yugo (Ithal'ord) que ya empezaba con el Primer Edicto del Tributo (~3.600). Los Faerus establecieron una "tolda" (lugar de encuentro bajo árboles) donde se intercambiaban pieles y madera sin que ninguna facción Goirnte entrara.

**Base física:** Los Faerus actúan como mensajeros neutrales porque no dependen del sistema Goirnte.

**Canon que reutiliza:** Faerus de Hashma (Feg Tusha), Senda del Sílice, Helsig, Goshg, Vash'grath, Yugo de Hierro (~3.600), El Baluarte de Goirme, Karo'sael.

**Nombre:** En lengua Feg: sin nombre; en lengua común: Juramento de la Tolda.

**Contradicciones detectadas:**
- ⚠️ "Faenus" → "Faerus".
- ⚠️ "tola" → "tolda" (inconsistencia ortográfica).
- ⚠️ "Primer Edicto del Tributo" — ¿existe?

**Preguntas abiertas para Álvaro:**
1. ¿Qué material específico de los Goshg era más difícil de transportar?
2. ¿Qué animal de la Senda del Sílice servía de indicador de tráfico Goirnte?
3. ¿Cómo se distinguió la tolda de los Faerus de los puestos Goirnte?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/catalogo/fauna.md`

---

### 2026-10-03 — El Jurado del Fuego en Hashma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~1.000 al 2.000 — "Los mil años salvajes: mutan especies de las Llanuras" (aplicado a Faerus de Hashma).

**Ficha técnica:**
- **Título:** El Jurado del Fuego en Hashma
- **Era:** Común (~2.600)
- **Tipo:** descubrimiento (tecnología de supervivencia) · **Participantes reales:** Faerus de Hashma (Feg Tusha)
- **Causas:** El fuego salvaje amenazaba sus territorios; necesitaban controlarlo para sobrevivir
- **Qué pasó:** Faerus experimentados aprendieron a controlar pequeñas llamaradas usando madera seca y viento para espantar criaturas mutadas
- **Consecuencias en el presente (4.010):** Gorhorn aprendió a usar el fuego desde los Faerus de Kegi. La tradición de control del fuego es base de la tecnología Faerus actual
- **Documento que lo recuerda:** sin documento

**Descripción:** Tras el Estallido (~1.000), las llamaradas del fuego salvaje (Grath'sil, tierra que arde) eran descontrolables y amenazaban las selvas de Hashma. Alrededor de ~2.600, algunos Faerus experimentados descubrieron que podían controlar pequeñas llamaradas usando madera seca y viento, creando "fogatas controladas" que espantaban a las criaturas mutadas más agresivas (Kirelon, Salamandra). Aprendieron a usar el fuego como herramienta de caza: encendían fogatas cerca del territorio de las criaturas, las ahuyentaban, y luego las cazaban con mayor facilidad.

**Base física:** El fuego es combustible (madera, carbón) + oxígeno del aire.

**Canon que reutiliza:** Faerus de Hashma (Feg Tusha), Grath'sil (fuego salvaje), Vash'grath (compartir), Estallido (~1.000), Kirelon, Salamandra.

**Nombre:** En lengua Feg: Grath'til; en lengua común: Jurado del Fuego.

**Contradicciones detectadas:**
- ⚠️ "Faenus" → "Faerus".
- ⚠️ "Grath'til" — verificar.
- ⚠️ **"Grath'sil"** — aparece como "fuego salvaje", pero en logs anteriores era "Tierra que arde" para los Faerus (guerra). Confusión semántica.

**Preguntas abiertas para Álvaro:**
1. ¿Qué criatura específica fue ahuyentada con estas fogatas?
2. ¿Cómo se transmitió este conocimiento sin escritura entre ~2.600 y 4.010?
3. ¿Qué diferencia hubo entre el fuego salvaje del Estallido y el fuego controlado?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/catalogo/flora-minerales.md`

---

### 2026-10-03 — La Huida de la Tolda de Hashma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~2.900 al 3.000 — tras la primera migración de Maktor y el primer golpe, los Faerus de Hashma se ven presionados a huir antes del Yugo (3.600).

**Ficha técnica:**
- **Título:** La Huida de la Tolda de Hashma
- **Era:** Común (~3.050)
- **Tipo:** catástrofe (desplazamiento forzado) · **Participantes reales:** Faerus de Hashma (Feg Tusha)
- **Causas:** Los Goirntes talaban el margen sur del Margen y entraban en Hashma; los Faerus debieron huir
- **Qué pasó:** Los Faerus se dividieron: algunos huyeron hacia el sur hasta Kegi formando Feg Ger; otros se quedaron en Hashma escondidos en selva profunda
- **Consecuencias en el presente (4.010):** Gorhorn encontró a Faerus de Kegi porque compartían esta tradición. La migración se recuerda en la separación entre selva y llanura
- **Documento que lo recuerda:** sin documento

**Descripción:** A ~3.050, los Goirntes empiezan a talar el margen sur del Margen para expandir sus minas y recursos, invadiendo la zona de Hashma que los Faerus habían cuidado por generaciones. Los Faerus no podían defenderse con armas o magia, así que debieron huir. El clan se dividió: algunos huyeron hacia el sur hasta Kegi (~3.100), formando Feg Ger (llanura), mientras otros se quedaron en Hashma y se escondieron en las zonas más profundas de la selva. La huida se realizó sin documentos: los ancianos Feg Tusha marcaban las rutas con piezas de caza (Vash'grath) y las nuevas manadas aprendían por los olores.

**Base física:** Migración de animal social ante presión ecológica/goirnte.

**Canon que reutiliza:** Faerus de Hashma (Feg Tusha), Feg Ger (Kegi), Goirntes, Hashma, Kegi, Vash'grath, Feg'nur.

**Nombre:** En lengua Feg: Hash'grath (huida de la selva); en lengua común: La Huida de la Tolda de Hashma.

**Contradicciones detectadas:**
- ⚠️ "Faenus" → "Faerus".
- ⚠️ "Hash'grath" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Qué técnica específica de los Goirntes usaban para talar el margen?
2. ¿Cómo marcaban las rutas de huida sin documentos?
3. ¿Qué relación tiene esta migración con el Yugo de Hierro (~3.600)?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/lore-mundo/hashma.md`

---

### 2026-10-03 — La Murmuración de las Raíces en Hashma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~2.800 al ~3.600 — período previo al Yugo de Hierro y la Purga Silenciosa.

**Ficha técnica:**
- **Título:** La Murmuración de las Raíces en Hashma
- **Era:** Común (~2.850–~2.950)
- **Tipo:** descubrimiento (sistema de alerta) · **Participantes reales:** Faerus de Hashma (Feg Tusha)
- **Causas:** Los Goirntes empezaron a patrullar con frecuencia, necesitando alertas anticipadas
- **Qué pasó:** Los Faerus desarrollaron un sistema de comunicación basado en vibraciones del suelo y olores, no en gesticulación o sonidos, para anticipar invasores Goirntes
- **Consecuencias en el presente (4.010):** El sistema se volvió obsoleto con el Yugo. Gorhorn no heredó este sistema
- **Documento que lo recuerda:** sin documento

**Descripción:** Alrededor del ~2.850, los scouts Goirntes empezaron a patrullar el sur de las Llanuras con frecuencia. Los Faerus de Hashma, usando su sentido del olfato y la capacidad de detectar vibraciones a través del suelo (no sonidos), notaron que la "tierra misma" les avisaba de la presencia de invasores. Crearon un sistema de "murmuración": algunos individuos (los más experimentados) se ponían en posición de escucha en puntos altos y transmitían la información mediante vibraciones de los pies y señales olfativas (no gesticulación). Si el suelo vibraba con el peso de soldados, los Faerus sabían que las tropas Goirnte se acercaban.

**Base física:** La detección de vibraciones y olores es biológica.

**Canon que reutiliza:** Faerus de Hashma (Feg Tusha), Estallido (~1.000), Feg'nur, Vash'grath, Goirntes, Yugo de Hierro (3.600), Purga Silenciosa (3.650).

**Nombre:** En lengua Feg: Ashi'vibro; en lengua común: Murmuración de las Raíces.

**Contradicciones detectadas:**
- ⚠️ "Faenus" → "Faerus".
- ⚠️ "Ashi'vibro" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Qué vibración específica indicaba la presencia de tropas Goirntes?
2. ¿Cómo se diferenciaba el sistema de murmuración de la comunicación Faerus habitual?
3. ¿Qué pasó a los Faerus que no pudieron transmitir la alerta?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/diccionarios/feg.md`

---

### 2026-10-03 — La Tolda del Ancestro en Hashma
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~3.000 al ~3.600 — período de adaptación post-migración y presión del Yugo de Hierro, antes de la Purga Silenciosa.

**Ficha técnica:**
- **Título:** La Tolda del Ancestro en Hashma
- **Era:** Común (~3.000–~3.600)
- **Tipo:** fundación (consolidación comunitaria) · **Participantes reales:** Faerus de Kegi (Feg Ger), Faerus de Hashma (Feg Tusha)
- **Causas:** Tras la migración de Hashma hacia Kegi (~3.000) y la presión creciente de los Goirntes (Yugo de Hierro, ~3.600), los Faerus de Kegi necesitaban consolidar su nueva manada
- **Qué pasó:** En una tolda abierta en el borde sur de las Llanuras, las manadas se reunieron para crear el primer Jakut permanente. El trono era un pedestal de madera de Telda tallado sin herramienta, solo con manos. Se reforzó el Feg'nur como ley fundamental
- **Consecuencias en el presente (4.010):** El Jakut permanente de Kegi es el modelo de organización que Gorhorn encontró tras huir (4.000). El Feg'nur se mantiene como ley fundamental
- **Documento que lo recuerda:** sin documento

**Descripción:** Tras la migración de Hashma hacia Kegi (~3.000) y la presión creciente de los Goirntes (Yugo de Hierro, ~3.600), los Faerus de Kegi necesitaban consolidar su nueva manada en la llanura. En una tolda abierta en el borde sur de las Llanuras, donde el Margen se encuentra con la Llanura de Kegi, las manadas se reunieron para crear el primer Jakut permanente. El trono era un pedestal de madera de Telda tallado sin herramienta, solo con manos. Quien se sentaba no tenía título: era quien estaba presente y escuchaba a los demás. La ley fundamental era el Feg'nur: ningún Faerus debía ser abandonado, incluso si no podía cazar o defenderse. Se crearon ritos para los "heridos permanentes": aquellos que ya no podían cazar, pero que seguían siendo cuidados por la manada hasta su muerte natural. La tolda se convirtió en el centro de decisiones de Kegi, donde se reunían las manadas para discutir rutas de caza, alianzas con los Goshg, y la defensa contra los Goirntes. El Jakut permanente fue el primer símbolo de continuidad Faerus en la llanura: no un edificio, sino un lugar que se transmitía de generación en generación.

**Base física:** La tolda es un lugar físico (bajo árboles o estructuras de madera) que se mantiene por la práctica. El Jakut no es magia: es consenso oral y reconocimiento colectivo.

**Canon que reutiliza:** Faerus de Kegi (Feg Ger), Faerus de Hashma (Feg Tusha), Jakut (trono), Feg'nur, Vash'grath, Yugo de Hierro (~3.600), Telda (madera), Kegi.

**Nombre:** En lengua Feg: Vash'jakut (trono de la manada); en lengua común: Tolda del Ancestro.

**Contradicciones detectadas:**
- ⚠️ "Faenus" → "Faerus".
- ⚠️ "Vash'jakut" ya aparece en "Umbral del Rango en Hashma" con otro significado. Confusión.
- ⚠️ "herido" → "heridos" (typo).
- ⚠️ **Descripción cortada** — completada.

**Preguntas abiertas para Álvaro:**
1. ¿El Jakut de Kegi se diferencia del de Hashma en estructura o solo en ubicación?
2. ¿Quién fue el primer Faerus en sentarse en el Jakut permanente?
3. ¿Cómo se relaciona este evento con el Pacto de la Primera Pieza (~2.300) entre Maktor y Faerus?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/historia/cronologia.md`
- `docs/rpgtarkor/lore-mundo/faerus.md`
- `docs/rpgtarkor/lore-mundo/kegi.md`

---

## Categoría: Lugares y geografía

---

## Categoría: Items

---

## Categoría: Fauna y flora

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

### 2026-10-03 — Jakut'tar (la memoria sin texto)
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~1.000 al ~2.000: ¿cómo vivieron Faerus y Nabieus antes del Estallido? Además, el catálogo de Faerus dice «sin escritura» — ¿cómo enseñan algo?

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha, Hashma) · Jakut'tar
- **Qué se hace, cuándo y quién:** En el Jakut, un anciano o líder enseña a aprendices durante la caza diaria
- **Por qué existe:** Sin escritura, el conocimiento se transmite multisensorialmente. Asegura supervivencia colectiva
- **Qué pasa si se rompe:** Los jóvenes no saben cazar ni evitar peligros; la manada se debilita
- **Cómo lo notaría un forastero:** Voces casi inexistentes, movimiento silencioso, feromonas presentes en el aire

**Descripción:** En el Jakut, el líder o anciano de la manada enseña a los jóvenes mediante tres canales simultáneos:
1. **Olfato:** El maestro deja que los aprendices huelan la presa, el camino o el miedo. El olfato Faerus lee emociones — así aprenden «por qué» una decisión es buena.
2. **Postura:** Los veteranos ajustan su postura sobre patas (2 o 4 según el terreno) para mostrar cómo moverse sin ser detectado.
3. **Compartir la pieza:** Los aprendices solo reciben el trozo central del animal (el Vash'grath) cuando dominan la lección.

**Duración:** Una lección dura lo que tarda en cazarse y desollarse una presa menor. Si un joven huye o falla una caza, no recibe la pieza y debe rehacerlo.

**Base física:** Sistema multisensorial que combina señales olfatorias (neuroquímica), postura muscular y distribución de recursos.

**Canon que reutiliza:** Jakut (círculo de decisión); manada como única institución; Vash'grath (primera pieza compartida); olfato que «lee el miedo»; posición sobre 2 o 4 patas.

**Preguntas abiertas para Álvaro:**
1. ¿El Karo'sael de Nabieus tiene alguna influencia en el vocabulario del Jakut'tar?
2. ¿Los Faerus guardan algún registro olfativo de lecciones pasadas?
3. ¿Cómo se enseñan técnicas mágicas (Cambiaformas) si no tienen magia directa?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a la lista de Faerus)

---

### 2026-10-03 — Drogh'feg (el lazo de sangre)
**Estado: SIN REVISAR**

**Qué hueco cubre:** Falta ritual de muerte/recordatorio para Faerus. El canon dice "a los muertos se les quema" para orcos, pero para Faerus no hay rito descrito.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha, Hashma) · Drogh'feg
- **Qué se hace, cuándo y quién:** Corte del colmillo al primer cazado grande; huelen el cuerpo de los fallecidos
- **Por qué existe:** Sin escritura, el lazo olfativo y marcación corporal retiene la memoria colectiva
- **Qué pasa si se rompe:** La manada olvida a sus miembros; los jóvenes no sienten vínculo
- **Cómo lo notaría un forastero:** Heridas siempre frescas, olor a sangre seca que persiste, voces apenas audibles

**Descripción:**
- **Rituales de integración:** Cuando un joven completa su primer caza grande, se le aplica un corte del colmillo (Krul'ghep) en la frente, que no cicatriza completamente. La herida huele a sangre y fuego (Sekt'sil). Quien comparte el trofeo sabe a la lección.
- **Duelos colectivos:** Cuando un Faerus muere en caza, todos huelen su Ashi'feg (cámara olfativa) para "recordar sus olores". Se comparte el último trofeo que tuvo.
- **Duración:** Un ciclo de duelo dura un Terud'beh completo.

**Base física:** El corte del colmillo libera hormonas de estrés que impiden cicatrización completa. El olfato Faerus detecta la "firma olfativa" de la muerte.

**Canon que reutiliza:** Krul (colmillo propio), Sekt (corte), Sil (fuego), Feg (manada), Ashi (oler), Drogh (lazo), Vash'grath (primera pieza), Terud'beh (día).

**Preguntas abiertas para Álvaro:**
1. ¿El corte del colmillo se marca con algún pigmento de planta o mineral?
2. ¿Los Faerus guardan algún registro olfativo por generaciones?
3. ¿Huelen los nuevos Faerus a las generaciones anteriores para "conocerlas"?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "muerte")

---

### 2026-10-03 — Feg'ghep (el nido de aprendizaje)
**Estado: SIN REVISAR**

**Qué hueco cubre:** Faerus sin descripción de crianza o rito de paso. `02-razas` muestra un Faerus adulto, pero no cómo se educan los jóvenes, ni cuándo dejan la manada.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha, Hashma) · Feg'ghep
- **Qué se hace, cuándo y quién:** Crianza colectiva en nidos; rito de salida al Jakut a los 7 años
- **Por qué existe:** Supervivencia en grupo; sin escritura, los jóvenes aprenden de los mayores
- **Qué pasa si se rompe:** Los jóvenes no sienten pertenencia; la manada muere sola
- **Cómo lo notaría un forastero:** Hembras que comparten alimento, crías que juegan con cueros, trono cubierto de trofeos

**Descripción:**
- **El nido:** Una zona de cría compartida en el Yegr (vergel) o en bordes del Yashar (foso de agua), donde las hembras alimentan a todas las crías del nido.
- **Aprendizaje:** A los 2 años, los cachorros juegan con huesos y cueros muertos. A los 4, aprenden a rastrear. A los 6, cazan piezas pequeñas con supervisión.
- **Rito de salida:** A los 7 años, si el joven cazó su propia pieza sin herir a otros, la pone en el Jakut y el Jakut'tar lo acepta como cazador.

**Base física:** Faerus son animales sociales con cuidado cooperativo. Los jóvenes aprenden por imitación y olfato.

**Canon que reutiliza:** Jakut (trono, no cargo), Jakut'tar (enseñanza), Yegr (vergel), Sil (fuego), Vash'grath (pieza), Feg'nur (herido), Terud'beh (día), Feg (manada).

**Preguntas abiertas para Álvaro:**
1. ¿Los nidos son permanentes o se mueven con la manada?
2. ¿Hay algún nombre para los jóvenes antes del rito de Jakut'tar?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "crianza")

---

### 2026-10-03 — Sil'tar (la memoria en la llama)
**Estado: SIN REVISAR**

**Qué hueco cubre:** Del ~1.000 al ~2.000: ¿cómo vivían Faerus y Nabieus antes del Estallido? Los Faerus usan el fuego (Sil) para almacenar historias, no texto.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Ger, Kegi) · Sil'tar
- **Qué se hace, cuándo y quién:** Ancianos mantienen y narran en círculo alrededor de la Ghurna
- **Por qué existe:** Sin escritura, la memoria se guarda en la constancia de la llama
- **Qué pasa si se rompe:** Las historias se pierden; la manada olvida sus raíces
- **Cómo lo notaría un forastero:** Un círculo de fauna, fuego estable, voces casi inexistentes

**Descripción:**
- **El círculo:** Al anochecer, todos se agachan alrededor de la Ghurna (llama estable).
- **Transmisión:** Mientras el anciano cuenta, debe mantener la llama sin que parpadee. Si se apaga, la historia se queda incompleta; se rehace al día siguiente.
- **Duración:** Una historia dura una noche. La siguiente generación la recuerda por el olor del humo y el calor en la piel.
- **Estacionales:** En Ur'gathek (primavera), se cuentan historias de caza; en Krenoth (invierno), se cuentan historias de supervivencia.

**Base física:** El control de fuego (Sil) requiere concentración y cooperación. El humo y el calor generan señales olfativas y térmicas que ayudan a la memoria.

**Canon que reutiliza:** Sil (fuego), Ghurmek (calma, llama estable), Ur'gathek (primavera), Krenoth (invierno), Feg (manada), Ashi (oler), Terud'beh (día), Yegr (vergel).

**Preguntas abiertas para Álvaro:**
1. ¿Ghurna viene de Feg o de una palabra común? ¿Qué significa Ghurna en Feg?
2. ¿La Ghurna se mantiene con grasa animal o leña sagrada?
3. ¿Las historias tienen títulos en lengua común?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus)

---

### 2026-10-03 — Krul'tar (el colmillo testigo)
**Estado: SIN REVISAR**

**Qué hueco cubre:** No hay descripción de cómo se enseña caza, rastreo o uso del colmillo en los Faerus. Falta el rol del colmillo como herramienta pedagógica y de memoria personal.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Ger, Kegi) · Krul'tar
- **Qué se hace, cuándo y quién:** Antes de cazar, los jóvenes repasan las señales en su Krul con un adulto
- **Por qué existe:** Sin escritura, el colmillo marca lo que se sabe y guía a los aprendices
- **Qué pasa si se rompe:** Un joven con Krul limpio no sabe cazar; la manada se pierde
- **Cómo lo notaría un forastero:** Colmillos con marcas de hueso que brillan al sol; jóvenes que miran sus colmillos antes de cazar

**Descripción:** Un Faerus adulto enseña a los jóvenes usando su Krul (colmillo propio) como guía en campo.
- **La punta marcada:** En la punta del colmillo, se marca con hueso pequeño (talla de madera o piedra) las señales aprendidas: círculos del rastreo, flechas del viento, manchas del olfato.
- **La lección:** Cada joven repasa las señales en su Krul antes de salir. Si el colmillo está limpio, no ha aprendido.
- **El colmillo de maestro:** Los ancianos dejan sus colmillos marcados como guía permanente.

**Base física:** El colmillo es la herramienta personal de caza. Las marcas en punta son tácticas que se pueden tocar y ver.

**Canon que reutiliza:** Krul = colmillo propio, Ashi = oler, Sil = fuego, Feg = manada, Jakut = trono, Ashi'krul = el colmillo que huele.

**Preguntas abiertas para Álvaro:**
1. ¿Las marcas del colmillo se pasan de generación en generación o se reinician?
2. ¿Hay algún colmillo sagrado o maestro en todas las manadas?
3. ¿Las marcas se hacen con hueso fresco o endurecido?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "caza/colmillo")

---

### 2026-10-03 — Vash'tu (la prueba del olor)
**Estado: SIN REVISAR**

**Qué hueco cubre:** ¿Cómo se convierte un forastero en Faerus? ¿Qué le ofrece a cambio de su entrada? Falta el rito de aceptación y prueba olfativa.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha, Hashma o Yegr Kegi) · Vash'tu
- **Qué se hace, cuándo y quién:** Aceptación de forastero tras prueba olfativa y aceptación de pieza
- **Por qué existe:** Sin escritura, la manada define quién pertenece por el olor y la lealtad de la caza
- **Qué pasa si se rompe:** El forastero puede ser expulsado sin recursos; la manada tiene un miembro no leal
- **Cómo lo notaría un forastero:** Olor de la manada, grasa en la frente, caza compartida como prueba

**Descripción:**
- **La prueba:** El forastero entra en el Yegr (vergel) y huele el aire de la manada con la palma (Tovh'vhurne). Si el olor es agradable para la manada, puede probar el Vash'grath (primera pieza).
- **La decisión:** Si acepta la pieza sin rechazar, la manada lo acepta. Si no, es expulsado.
- **La condición:** Debe prometer no abandonar a ningún herido (Feg'nur). Quien rompe esto es expulsado con el nombre manchado de traición.
- **El compromiso:** El forastero recibe una marca con grasa de animal en la frente, que se limpia con caza. Si el olor es malo, no se vuelve a entrar sin una prueba mayor.

**Base física:** El olor del animal marca su lealtad. Un forastero que no acepta la caza del grupo no es de la manada.

**Canon que reutiliza:** Vash'grath (primera pieza), Feg'nur (herido), Tovh'vhurne, Yegr (vergel), Feg (manada), Ashi (oler).

**Preguntas abiertas para Álvaro:**
1. ¿Qué marca se hace en la frente? ¿Grasa, aceite, tinta?
2. ¿Hay algún nombre para los forasteros no aceptados?
3. ¿Algo del Karo'sael de los Nabieus influye en el proceso de aceptación?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus)

---

### 2026-10-03 — Feg'ghep (el debate en el Jakut)
**Estado: SIN REVISAR**

**Qué hueco cubre:** No hay descripción del procedimiento de decisión colectiva en la manada Faerus. Solo dice "decide quien está sentado en el Jakut".

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha, Hashma) · Feg'ghep
- **Qué se hace, cuándo y quién:** Debate colectivo en el Jakut sin cargo
- **Por qué existe:** La manada es la única institución, sin escritura ni títulos
- **Qué pasa si se rompe:** Decisión errónea, manada expuesta a riesgos
- **Cómo lo notaría un forastero:** Círculo alrededor de trono, postura y olfato deciden

**Descripción:**
- Cada Faerus tiene derecho a opinar mientras está sentado en el Jakut.
- **Orden:** Quien huela mejor el riesgo, habla primero.
- **Votos:** Se marca con la cola o patas. Quien cambia de mente, cambia de posición.
- **Aprobación:** Si la mayoría huele "bien", se decide. Si hay conflicto, se pospone al anochecer para revisar.

**Base física:** El sistema democrático basado en posición y percepción olfativa. No hay títulos de mando, solo quién está en el Jakut.

**Canon que reutiliza:** Jakut (trono), Jakut'tar (enseñanza), Feg (manada), Ashi (oler), Vash'grath (primera pieza).

**Preguntas abiertas para Álvaro:**
1. ¿Cuántos Faerus caben en el Jakut? ¿Todos o solo un consejo?
2. ¿Un Faerus puede ser expulsado si cambia de opinión?
3. ¿El Jakut se mueve con la manada o está fijo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus)

---

### 2026-10-03 — Ashi'tar (la limpieza después del error)
**Estado: SIN REVISAR**

**Qué hueco cubre:** No hay descripción de cómo se procesa un fracaso, caza fallida o muerte dentro de la manada. Falta el mecanismo de "reparación" social tras un error que no es abandono de herido.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Ger, La Hondonada) · Ashi'tar
- **Qué se hace, cuándo y quién:** Baño olfativo con hierbas tras fracaso
- **Por qué existe:** Sin escritura, el estrés no se limpia, se acumula en los sentidos
- **Qué pasa si se rompe:** La manada tacha al miembro; él es paria
- **Cómo lo notaría un forastero:** Faerus que evitan a otro, herbales que pican, aire limpio de error

**Descripción:**
- **El problema:** Si un cazador falla, hiere a un joven o rompe una caza, debe pasar el Tovh'ash (baño olfativo) con Jusha Esmeralda y ceniza de Telda Atardecer.
- **Duración:** Tres ciclos de luz/oscuridad (Terud'beh).
- **Resultado:** Cuando el olor en la piel es "limpio" (no pica), puede volver a cazar.
- **Consecuencia de no limpiar:** Quien no se limpia huele a "culpa" y la manada lo evita. Puede ser expulsado sin juicio.

**Base física:** El fracaso produce una respuesta química de estrés (feromonas) que el sistema olfativo de Faerus detesta. La Jusha neutraliza esas señales.

**Canon que reutiliza:** Ashi (oler), Tovh (palma), Terud'beh (día), Jusha Esmeralda (de La Hondonada), Telda Atardecer, Jakut (trono), Feg (manada).

**Preguntas abiertas para Álvaro:**
1. ¿La Jusha Esmeralda se seca o se usa fresca?
2. ¿Cuántos Faerus tocan en el ritual de limpieza? ¿El grupo o solo el individuo?
3. ¿Hay algún nombre para los Faerus no limpios?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "fracaso/limpieza")

---

### 2026-10-03 — Feg'ish (el saludo de la manada)
**Estado: SIN REVISAR**

**Qué hueco cubre:** No hay descripción del saludo o reconocimiento social entre Faerus. Solo se menciona la manada como institución sin ritual de interacción cotidiana.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha, Hashma) · Feg'ish
- **Qué se hace, cuándo y quién:** Saludo entre miembros de manada usando colmillos y olores
- **Por qué existe:** Sin escritura, el olfato identifica quién pertenece
- **Qué pasa si se rompe:** Un forastero no puede interactuar sin ser reconocido; una manada separada
- **Cómo lo notaría un forastero:** Colmillos que se apoyan, roces de hocico, olfateos

**Descripción:**
- **El acto:** Dos Faerus se acercan. Uno huele el colmillo del otro (Krul'feg = "el colmillo de la manada").
- **La marca:** Quien huele "correctamente" apoya el colmillo del otro sobre el propio y se frotan el hocico.
- **La respuesta:** El otro acepta o rechaza. Si rechaza, no es de la manada; si acepta, puede compartir pieles.
- **Duración:** Un saludo dura segundos, pero la manada espera que sea respetado.

**Base física:** El olfato detecta feromonas de identidad. El colmillo está marcado con grasa de caza que indica lealtad.

**Canon que reutiliza:** Krul (colmillo), Ashi (oler), Feg (manada), Vash'grath (primera pieza), Jakut (trono), Sil (fuego).

**Preguntas abiertas para Álvaro:**
1. ¿Feg'ish viene de una palabra conocida o es nuevo?
2. ¿Los Faerus de diferentes manadas se saludan igual?
3. ¿Un Faerus herido puede saludar a distancia?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "saludo/cotidiano")

---

### 2026-10-03 — Karo'feg (la memoria del camino)
**Estado: SIN REVISAR**

**Qué hueco cubre:** Falta historia oral de los Faerus sobre su relación con el Margen y la migración histórica. Ningún rito de peregrinación o memoria de rutas abandonadas.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha, Hashma) · Karo'feg
- **Qué se hace, cuándo y quién:** Jóvenes siguen la ruta anual desde El Claro a Hashma
- **Por qué existe:** Conectar con el origen histórico de la manada; memoria sin escritura
- **Qué pasa si se rompe:** Los jóvenes pierden su sentido de pertenencia
- **Cómo lo notaría un forastero:** Línea de piedras, jóvenes que caminan, anfitriones que narran

**Descripción:**
- **La ruta:** Los ancianos narran el camino desde El Claro de la Manada hasta La Veta Helada y por la costa de Hashma.
- **Los lugares:** Cada parada marca un "punto de memoria": el lugar donde se encontraron agua, donde se separaron, donde la conciliación con el Clan Maktor.
- **El ciclo:** Anualmente, un grupo de jóvenes sigue la ruta por día (Terud'beh) y vuelve. Recopilan piedras del camino y las ponen en el Jakut.
- **La enseñanza:** Quien no llega al destino no es "de la ruta", y la manada no lo acepta hasta que repara la prueba.

**Base física:** La memoria está en las marcas físicas del camino (piedras, árboles). La narración conecta con el olor del lugar y el relieve.

**Canon que reutiliza:** El Claro de la Manada, Hashma, Veta Helada, Krul (colmillo), Jakut (trono), Jakut'tar (enseñanza), Sil (fuego), Feg (manada).

**Preguntas abiertas para Álvaro:**
1. ¿Karo viene del vocabulario de Nabieus (Karo = carta)?
2. ¿La ruta tiene algún nombre común? ¿Qué lugares se nombran?
3. ¿Los Faerus de Kegi tienen su propia versión?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "historia/migración")

---

### 2026-10-03 — Feg'nur'tar (el deber del cuidado)
**Estado: SIN REVISAR**

**Qué hueco cubre:** Tabú Feg'nur ("el que no se abandona") sin rito de ejecución. Falta el protocolo colectivo de recuperación de un herido que no puede cazar.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha, Hashma o Yegr) · Feg'nur'tar
- **Qué se hace, cuándo y quién:** Manada cuida a herido hasta que caza de nuevo
- **Por qué existe:** El herido es vulnerabilidad; la manada lo cubre con caza
- **Qué pasa si se rompe:** El miembro exiliado muere solo; la manada se debilita
- **Cómo lo notaría un forastero:** Faerus que apoyan a otros, alimento compartido

**Descripción:**
- **El herido:** Cuando un Faerus se lesiona y no puede cazar, los mayores lo trasladan al Yegr (vergel) o a un nido.
- **La curación:** La manada lo alimenta y le da su propia caza. Nadie abandona a un herido.
- **La prueba:** Cuando puede cazar de nuevo, debe traer al grupo una presa nueva.
- **El tabú roto:** Si la manada abandonara a un herido, el miembro sería exiliado sin recurso.

**Base física:** Los Faerus son animales sociales que dependen de la cooperación. Cuidar a un herido asegura que todos sigan vivos.

**Canon que reutiliza:** Feg'nur (el que no se abandona), Yegr (vergel), Ashi (oler), Feg (manada), Jakut (trono), Ashi'krul (colmillo).

**Preguntas abiertas para Álvaro:**
1. ¿Cuántos heridos puede soportar una manada?
2. ¿Hay algún nombre específico para el nido de recuperación?
3. ¿Qué sucede con el herido si nunca recupera?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "herido/recuperación")

---

### 2026-10-03 — Krul'feg (el límite del territorio)
**Estado: SIN REVISAR**

**Qué hueco cubre:** No hay descripción de delimitación de territorio ni marcaje olfativo de zona de caza en Faerus. Solo se menciona Kegi como territorio del Feg Ger.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Ger, Kegi) · Krul'feg
- **Qué se hace, cuándo y quién:** Marcaje territorial con colmillos y feromonas
- **Por qué existe:** Delimitar zona de caza sin escritura, evitar conflictos
- **Qué pasa si se rompe:** Invasión de zona de caza; conflictos entre manadas
- **Cómo lo notaría un forastero:** Promontorios con feromonas, avizores que advierten

**Descripción:**
- **El marcaje:** Un Faerus macho mayor coloca el Krul sobre un promontorio o árbol y huele fuerte para liberar feromonas (Tovh'ash).
- **La marca:** Quien huele "su" colmillo, no entra. Quien no huele su feromona, es forastero o enemigo.
- **La defensa:** Si un forastero marca en suelo Faerus, toda la manada mata a su marca.

**Base física:** Feromonas de marcaje de territorio. El sistema olfativo detecta y evita zonas marcadas por otros.

**Canon que reutiliza:** Krul (colmillo), Ashi (oler), Feg (manada), Vash'grath (pieza), Jakut (trono), Kegi (territorio).

**Preguntas abiertas para Álvaro:**
1. ¿Cuántos Faerus machos marcan territorio al año?
2. ¿La marca caduca o se renueva por generación?
3. ¿Kegi tiene su propio Krul'feg distinto de Hashma?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "territorio/marca")

---

### 2026-10-03 — Vash'mek (la fiesta del éxito)
**Estado: SIN REVISAR**

**Qué hueco cubre:** No hay descripción de celebración colectiva tras caza exitosa. Los Faerus necesitan ritos de refuerzo positivo más allá del tabú de abandono de herido.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha, Hashma y Kegi) · Vash'mek
- **Qué se hace, cuándo y quién:** Celebración tras caza grande, todos comen y recuerdan
- **Por qué existe:** Refuerzo de memoria olfativa; asegurar que todos coman
- **Qué pasa si se rompe:** La manada no come bien; los jóvenes no aprenden
- **Cómo lo notaría un forastero:** Faerus hambrientos que celebran, comida en el suelo, olfato a caza

**Descripción:**
- **El momento:** Tras cazar una pieza grande (Gargantúa, Corredor, Aullador Rojo), la manada deja una parte central del trofeo para el Jakut.
- **La celebración:** Todos comen en torno a la pieza hasta agotar. Quien no come, no puede cazar la próxima vez.
- **La memoria:** Los jóvenes aprenden del olor a caza que se descomponía en sus narices.
- **Duración:** Una fiesta dura un cazo de luz (Terud'orik).

**Base física:** Las grandes presas tienen más carne. El grupo come y comparte. La memoria olfativa refuerza el aprendizaje.

**Canon que reutiliza:** Vash'grath (primera pieza), Jakut (trono), Jakut'tar (enseñanza), Terud'orik (noche), Ashi (oler), Sil (fuego), Feg (manada).

**Preguntas abiertas para Álvaro:**
1. ¿La Vash'mek es obligatoria o solo sugerida?
2. ¿Hay algún límite de tamaño de pieza para celebrar?
3. ¿Los Faerus comen con las manos o con la boca?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "celebración/comida")

---

### 2026-10-03 — Krul'dor (el paso de la manada)
**Estado: SIN REVISAR**

**Qué hueco cubre:** No hay descripción de rito funerario ni de qué sucede con un Faerus que muere, especialmente si es miembro del Jakut. Falta rito de muerte y transferencia de liderazgo.

**Ficha técnica:**
- **Raza o clan:** Faerus (Feg Tusha o Feg Ger, Hashma o Kegi) · Krul'dor
- **Qué se hace, cuándo y quién:** Rito funerario y elección de nuevo Jakut
- **Por qué existe:** Sin jerarquías, el Jakut es símbolo, no cargo
- **Qué pasa si se rompe:** Vacío en el Jakut debilita la manada
- **Cómo lo notaría un forastero:** Cuerpo sin comer, ceniza marcada, círculos de Faerus

**Descripción:**
- **El fallecido:** Se deja el cuerpo junto al Jakut (si es líder) o cerca de El Yegr.
- **La marca:** Se marca su trazo con ceniza de Telda y grasa de caza.
- **La elección:** Los mayores se reúnen y deciden quién entra al Jakut. Quien huele mejor al muerto, suele ser candidato.
- **El rito:** Un Faerus menor trae la lección de caza del muerto y la manada la comparte.

**Base física:** El cuerpo no se come por respeto. La ceniza marca dónde murió. La elección del siguiente Jakut se basa en olfato y posición social.

**Canon que reutiliza:** Jakut (trono), Jakut'tar (enseñanza), Ashi (oler), Vash'grath (primera pieza), Terud'beh (día), Telda (ceniza), Feg (manada).

**Preguntas abiertas para Álvaro:**
1. ¿El cuerpo se entierra o se deja expuesto?
2. ¿Qué sucede si no hay nadie para el Jakut?
3. ¿El Jakut de muerte tiene algún nombre especial?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/canonical/cultura.md` (añadir a Faerus, hueco "muerte/tradición")

## Categoría Recetas
