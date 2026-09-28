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
`docs/runbooks/pruebas-nube-2026-09-28-hallazgos.md`) el reconocimiento de nombres del motor
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

---

## Categoría: Otros
