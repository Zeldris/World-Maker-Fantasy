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

## Categoría: Otros
