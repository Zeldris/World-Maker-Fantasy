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


## Categoría: Facciones y diplomacia

---

## Categoría: Razas y cultura

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

2026-09-28 — Choque de nombres "Bolco" (árbol) / "Bulco" (caracol de arena)
Estado: SIN REVISAR

Qué se propone: renombrar UNO de los dos para que no difieran en una sola letra. Opción preferida:
mantener **Bolco** (árbol de las Marismas, Veldrias — tiene más peso en el lore: su resina forma la
capa de las Marismas de Lodo Negro) y renombrar el **Bulco de Arena** (NADANTES, nivel 1,
INOFENSIVO, Playa de Ceniza Blanca) a un nombre que no empiece por "B-lco" (el nombre concreto lo
decide Álvaro; debe seguir la fonética de las Llanuras y no ser una especie real).

Por qué: en las pruebas en la nube (hallazgo B18 de
`docs/registros/pruebas-nube-2026-09-28-hallazgos.md`) el reconocimiento de nombres del motor
tolera erratas de una letra (Levenshtein ≤1 en alias cortos), así que "bolco" y "bulco" se
confundían entre sí al escribir texto libre; hoy se esquiva con una exclusión en código
(`NPC_ALIAS_FUZZY_EXCLUSIONS`). Para el jugador también son casi indistinguibles leídos en el log.
Renombrar el caracol toca menos lore que renombrar el árbol (el árbol aparece en región, flora y
geografía de la Ciénaga; el caracol solo en el catálogo de fauna de las Llanuras).

Archivos que tocaría si se aprueba: `docs/rpgtarkor/lore-mundo/flora-fauna.md`,
`docs/rpgtarkor/lore-mundo/regiones/llanuras-del-viento-rojo.md`,
`docs/rpgtarkor/items-y-catalogo/items.md` (y, fuera de lore, el slug `bulco-de-arena` del
catálogo en `backend/src/scripts/worldCatalog.ts` y la exclusión de alias en código).

---

## Categoría: Personajes y NPCs

2026-09-29 — Dessa Kaltrenn, Yerin Slaad y Riko pasan de pregenerados a NPC (Fase 8, alcance pre-alpha)
Estado: SIN REVISAR

Qué se propone: decidir qué papel y dónde viven HOY los tres, para poder darlos de alta como `Npc`
en `backend/src/scripts/worldCatalog.ts`. Decisión del 2026-09-01: solo Gorhorn es jugable; los tres
salen de la selección de personaje (ya hecho en código). Se han dejado FUERA del catálogo de NPC
porque el lore no fija lo que un NPC necesita (ubicación, papel actual, nivel, facción operativa) y
no se ha inventado nada. Lo que sí está fijado (`docs/rpgtarkor/personajes/personajes.md` §§ 2, 6, 7;
`razas.md`; `npcs.md`; `margen-silencioso.md`; `cronologia.md`) y sirve como base de la ficha:

- **Dessa Kaltrenn** (Goirnte, mujer): soldado rasa de la guardia menor de Berig, escoltó el sello la
  noche de la ruptura y desertó esa misma noche; las patrullas de la Concordia llevan su descripción
  como desertora. Personalidad, facultad (percibe el "orden") y voz están en `personajes.md` § 2.
  `npcs.md` la enlaza con Vrask Ombra, Kael Dorn y Yovenne Tal (los tres necesitan lo que ella vio).
- **Yerin Slaad** (Nabieus): mensajero de bajo rango; una semana antes de la ruptura entregó, sin
  saberlo, la carta con las instrucciones del sabotaje. Personalidad, facultades (silencio, leer
  mentiras en las pausas) y voz en `personajes.md` § 6; Sella Marn quiere comprar lo que recuerda
  (`npcs.md`); Keseg Sael lo ve como testigo potencial (`propuestas-aprobadas.md`).
- **Riko** (Faerus, "de la Manada Rota"): cazador de las fronteras de Berig; su manada se reunía en El
  Claro de la Manada (Margen Silencioso), arrasado por la magia salvaje tras El Detonante
  (~4.006-4.008); viaja buscando rastro de los suyos. Personalidad, facultades y voz en
  `personajes.md` § 7.

Lo que NO fija el lore y hay que decidir (el motivo de que no se hayan creado):
1. **Dónde están en el momento de arranque (año 4.010)**: los tres son "errantes" o fugitivos sin
   sitio fijo (Dessa huye de las patrullas; Yerin es un "cabo suelto"; Riko "viaja"). `Npc` pide, para
   ser útil, una ubicación (`homeLocationSlug`) o al menos una región/ruta. Propuesta abierta: Dessa
   en algún punto de la Meseta del Orden o su frontera con el Margen; Yerin en el Margen oriental
   (zona Nabieus) o cerca de Sella Marn; Riko entre el Margen occidental y los alrededores del Claro
   de la Manada. Son sugerencias, no canon: Álvaro decide.
2. **Papel actual como NPC** (`role`, `interactionTypes`: ¿NPC_LORE, NPC_MISION?, ¿reclutables?):
   los ganchos de aventura de `personajes.md` están escritos para un jugador que los encarna, no para
   un NPC que el jugador encuentra.
3. **Nivel, clase y facción** (`level`, `clase`, `faction`): el lore no fija ninguno. Solo hay el
   bloque de atributos de cada pregenerado (`personajes.md`, tabla de atributos) y la raza. Dessa
   desertó de la Concordia y no se sabe si sigue contando como facción Goirnte.
4. **Si Gorhorn puede encontrarlos y cuándo** (respetando la cronología: nada después de 4.010 y sin
   resolver lo reservado — p. ej. qué sabe Tarsen Vold del Detonante, y sin tocar el destino de la
   verdad del sabotaje que estos tres poseen a medias).

Por qué: el catálogo de NPC exige campos de diseño (ubicación, nivel, papel) que en el lore de estos
tres solo existen como material de personaje jugable. Inventarlos rompería la regla de coherencia
del mundo; dejarlos sin NPC pierde tres personajes con conexiones ya escritas (Vrask, Kael, Yovenne,
Sella, Keseg Sael). Aprobada la ficha, el alta en código es rápida (la plantilla es Kael Dorn o
Sella Marn en `worldCatalog.ts`; `aliases`: 'dessa kaltrenn'/'dessa', 'yerin slaad'/'yerin', 'riko'
— ojo: "riko" es corto, comprobar colisiones fuzzy como en el hallazgo B18 de Bolco/Bulco).

Archivos que tocaría si se aprueba: `docs/rpgtarkor/personajes/npcs.md` (añadir las tres fichas de
NPC con ubicación y papel actual), `docs/rpgtarkor/personajes/personajes.md` (nota de que ya no son
pregenerados jugables), `docs/rpgtarkor/lore-mundo/razas.md` (las menciones a "pregenerado Riko/
Yerin" en Nabieus y Faerus), `docs/canon-opencode/catalogo/facciones-npcs.md` (marcarlos como NPC) y,
fuera de lore, `backend/src/scripts/worldCatalog.ts`.

---

## Categoría: Otros
