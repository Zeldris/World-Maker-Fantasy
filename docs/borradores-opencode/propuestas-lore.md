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
