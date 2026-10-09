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

### 2026-10-09 — Fauna ambiental y sus fuentes de recurso (QA-27)
**Estado: SIN REVISAR** (la usuaria, jugando: la fauna muy pequeña no combate ni aparece como punto
en el mapa). Lebude, Gesgurio, Quio y la fauna sin habilidades (Ruptidar…) pasan a ser ambientales.
Lo que daban al cazarlos sale ahora de tres fuentes nuevas, descritas con lo que ya dice el lore:
- **Colmena de Lebude** (El Pozo de Cauce Viejo): Cera y Miel Lebude.
- **Pared de arcilla de los Gesgurios** (La Hondonada del Eco): trozos de caparazón (quitina roja)
  que quedan en las grietas.
- **Fango de los Quios** (Los Manaderos): los Quios se sacan a mano del barro (filtro de Quio).

**Preguntas para Álvaro:**
1. ¿Valen estas tres fuentes y sus descripciones (`harvestSourceDescriptions` en `worldCatalog.ts`)?
2. ¿La colmena debería picar al recolectar mal (merma del veneno del Lebude)?

Archivos que tocaría si se aprueba: `docs/rpgtarkor/lore-mundo/regiones/llanuras-del-viento-rojo.md`
(Lebudes, Gesgurios, Quios).

---


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

## Categoría Recetas

### 2026-10-06 — Platos de Obrador y Gran obrador (CR-61)
**Estado: SIN REVISAR** (la usuaria decidió el 2026-10-06 que la cocina multiplique la comida:
Taller ×1,5, Obrador ×2, Gran obrador ×2,5). Hoy solo hay recetas de Taller (Cuajada de Múrgol,
Boungo asado, Pan de trigo escarlata, Panal endulzado). Faltan dos o tres platos por escalón, que
combinen ingredientes de cada región: p. ej. guiso de carne y raíz, queso curado de Múrgol. ¿Qué
platos cocina cada pueblo?
