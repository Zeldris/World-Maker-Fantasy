# Propuestas aprobadas

Copia aquí, tal cual o ya editadas a tu gusto, las propuestas de
[propuestas-lore.md](propuestas-lore.md) (o de cualquier debate con el agente `lore`) que te
interesa llevar adelante. Mismo criterio de categorías, mismo formato — la diferencia es que este
archivo solo contiene lo que ya decidiste que vale la pena, listo para que se procese con el
runbook de [docs/runbooks/ampliar-lore.md](../runbooks/ampliar-lore.md) y pase a
`docs/rpgtarkor/` de verdad.

El agente `lore` de OpenCode NO tiene permiso de escritura sobre este archivo — es solo tuyo,
edítalo tú directamente o pídeselo a Claude.

**Campos extra por propuesta** (se añaden a los de `propuestas-lore.md`):
`Acción de implementación` (añadir / modificar / fusionar / reemplazar / eliminar), `Prioridad`
(alta / media / baja), `Dependencias`, `Archivos destino`, `Notas del aprobador`.

**Plantilla:**

### [FECHA] — [tema]
**Estado: APROBADA ([quién], [cuándo])**

**Acción de implementación:** [añadir / modificar / fusionar / reemplazar / eliminar]
**Prioridad:** [alta / media / baja]
**Dependencias:** [lista, o "ninguna"]
**Archivos destino:**
- `docs/rpgtarkor/...`

**Notas del aprobador:** [instrucciones específicas, o "ninguna"]

---

**Propuesta:**

[texto completo de la propuesta, ya editado si hace falta]

**Preguntas abiertas resueltas:**
1. [pregunta] → [tu respuesta]
2. [pregunta] → [tu respuesta]

---

## Tanda 2026-09-27 — cierre de la primera ronda de OpenCode

Versión final de todo lo aprovechable de `propuestas-lore.md` (ronda del 2026-09-24 al 09-27),
revisado contra el canon completo y el código real. Las propuestas originales que dieron lugar a
estas fichas se han retirado de `propuestas-lore.md`. Lo descartado, y por qué, está al final, en
"Categoría: Otros".

**Estado de aplicación (2026-09-27):** las 39 fichas están **aplicadas a los `.md` maestros**
(`docs/rpgtarkor/`). **Falta todo el código.** Cada ficha lleva un bloque "Seguimiento": `[x]` lo que
ya está en docs y `[ ]` cada tarea de código, para ir marcándolas. Lo que se añadió después, en las
pasadas de conexión (sin ficha propia), está al final, en "Añadido en las pasadas de conexión".

| ID | En docs | Código pendiente |
|---|---|---|
| A-01 | ✅ | 5 tarea(s) |
| A-02 | ✅ | 4 tarea(s) |
| A-03 | ✅ | 4 tarea(s) |
| A-04 | ✅ | 3 tarea(s) |
| A-05 | ✅ | 3 tarea(s) |
| A-06 | ✅ | — (solo opcional) |
| A-07 | ✅ | — (solo opcional) |
| A-08 | ✅ | — (solo opcional) |
| A-09 | ✅ | 3 tarea(s) |
| A-10 | ✅ | — (solo opcional) |
| A-11 | ✅ | — (solo opcional) |
| A-12 | ✅ | — (solo opcional) |
| A-13 | ✅ | — (solo opcional) |
| A-14 | ✅ | — (solo opcional) |
| A-15 | ✅ | 1 tarea(s) |
| A-16 | ✅ | 1 tarea(s) |
| A-17 | ✅ | 1 tarea(s) |
| A-18 | ✅ | — (solo opcional) |
| A-19 | ✅ | — (solo opcional) |
| A-20 | ✅ | 1 tarea(s) |
| A-21 | ✅ | 1 tarea(s) |
| A-22 | ✅ | 1 tarea(s) |
| A-23 | ✅ | 1 tarea(s) |
| A-24 | ✅ | 1 tarea(s) |
| A-25 | ✅ | 1 tarea(s) |
| A-26 | ✅ | 1 tarea(s) |
| A-27 | ✅ | 1 tarea(s) |
| A-28 | ✅ | 1 tarea(s) |
| A-29 | ✅ | 1 tarea(s) |
| A-30 | ✅ | 1 tarea(s) |
| A-31 | ✅ | 1 tarea(s) |
| A-32 | ✅ | 2 tarea(s) |
| A-33 | ✅ | 1 tarea(s) |
| A-34 | ✅ | 1 tarea(s) |
| A-35 | ✅ | 1 tarea(s) |
| A-36 | ✅ | 1 tarea(s) |
| A-37 | ✅ | 1 tarea(s) |
| A-38 | ✅ | 1 tarea(s) |
| A-39 | ✅ | 1 tarea(s) |

**Orden de implementación sugerido:** NPC primero (A-37, A-38, A-39 y P-04), luego facciones
(A-01 a A-05, que necesitan esos NPC como líderes), después edificios (A-09), ítems y flora y fauna.

**Criterios aplicados a toda la tanda:**
- **Moratoria del Corredor de Cauce.** Ninguna ficha nueva usa material de Corredor. Es la presa
  sagrada de la cacería ritual, no una materia prima, y el catálogo ya tiene cuatro objetos suyos.
- **Nada de `Silh` en nombres Feg.** `Silh` es Kektira ("Musgo"), y `Sil` en Feg es "Fuego". Los
  nombres de flora y fauna nuevos van en lengua común salvo que se indique otra cosa.
- **Sin sufijo `-shra` en serie.** Solo se conserva en *Leshra*.
- **No todo va al Margen.** Tres piezas de flora pasan a Ciénaga Troncal, que tiene todavía menos
  contenido documentado que el Margen.
- **Valores económicos calibrados contra `worldCatalog.ts`.** Un objeto de tier 6 vale unos 20
  Goirnos, no cientos. Los precios de OpenCode estaban inflados entre 10 y 15 veces.
- **Preguntas abiertas.** Las marcadas *(decidido por Claude, revisable)* son decisiones que tomé
  para dejar la ficha implementable. Cualquiera se puede cambiar antes de pasar a `docs/rpgtarkor/`.

**Índice:**

| ID | Categoría | Propuesta | Prioridad |
|---|---|---|---|
| A-01 | Facciones | Los del Obelisco (moderados Goirntes) | media |
| A-02 | Facciones | Keseg Sael (Nabieus del Margen) | media |
| A-03 | Facciones | Keseg Prisilke como facción | media |
| A-04 | Facciones | Feg Tusha (Faerus de Hashma) | media |
| A-05 | Facciones | Feg Ger (Faerus de Kegi) | media |
| A-06 | Razas y cultura | El Jakut: mandar sin cargo | media |
| A-07 | Idiomas | Vocabulario nuevo de la tanda | media |
| A-08 | Idiomas | Nombres de las tormentas: forma plena y forma contraída | baja |
| A-09 | Construcciones | Los talleres que faltan en Karot Veku | **alta** |
| A-10 | Historia | Fundación de El Baluarte de Goirme (mítica) | baja |
| A-11 | Historia | La segunda huida Nabieus y la escucha con la palma (mítica) | media |
| A-12 | Historia | El Pacto de la Primera Pieza y la fundación de Kegi (~2.300) | **alta** |
| A-13 | Historia | La Mesa del Lazo (~2.855) | media |
| A-14 | Historia | El Primer Edicto del Tributo (~3.600) | media |
| A-15 | Lugares | El Cruce de las Ausencias (Margen) | baja |
| A-16 | Lugares | Las Aguas Sordas (Margen) | baja |
| A-17 | Lugares | La Proa Gris (Margen) | baja |
| A-18 | Lugares | El Puesto del Corredor (Meseta) | baja |
| A-19 | Lugares | Las Canteras del Eje (Meseta) | baja |
| A-20 | Flora | Musgo Callado | media |
| A-21 | Flora | Veldria Hueca | media |
| A-22 | Flora | Flor de Víspera | baja |
| A-23 | Flora | Cántaro de Hoja | baja |
| A-24 | Flora | Carnosa de Tocón | baja |
| A-25 | Flora | Bulbo de Turbera (Ciénaga) | baja |
| A-26 | Flora | Velo de Charca (Ciénaga) | baja |
| A-27 | Flora | Herrumbrera (Ciénaga) | media |
| A-28 | Fauna | Leshra | media |
| A-29 | Fauna | Morvasa | baja |
| A-30 | Fauna | Brozán | baja |
| A-31 | Fauna | Hoscón | baja |
| A-32 | Items | Colmillo de Ferike y Ashi'krul | media |
| A-33 | Items | Desollador de sílice | media |
| A-34 | Items | Ungüento de Espina | media |
| A-35 | Items | Manto de Cornisa | baja |
| A-36 | Items | Incisivos de Miruina | baja |
| A-37 | Personajes | Primer Censor Tarsen Vold (líder radical de la Concordia) | media |
| A-38 | Personajes | Cinco Faerus de Hashma | media |
| A-39 | Personajes | Dos Faerus de Kegi | media |

**Orden de implementación recomendado:** A-09 → A-12 → A-04/A-05/A-06 → A-39 → A-37/A-01 →
A-02/A-03/A-11 → A-07 → el resto por prioridad. A-09 y A-12 cierran huecos que el canon ya da por
existentes; lo demás es contenido nuevo.

---

## Categoría: Facciones y diplomacia

### A-01 · 2026-09-27 — Los del Obelisco: la facción moderada Goirnte
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Facciones Goirntes: Concordia de Hierro", 2026-09-24)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): historia.md § Las Alianzas · facciones-diplomacia.md § 7.2-bis · `regiones/meseta-del-orden.md`
- [x] **Código:** `worldCatalog.ts` → `factions`: añadir `los-del-obelisco` (texto de `description` en la ficha) — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `seed-catalog.ts` → `FACTION_LEADER_SLUG`: `los-del-obelisco: yovenne-tal` y `concordia-de-hierro: tarsen-vold` (depende de A-37) — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `reputation.ts` → `REGION_OWNING_FACTIONS['La Meseta del Orden']` = Concordia + Los del Obelisco — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `worldPopulation.ts`: 300 del pool `goirntes` — *hecho, verificado en código el 2026-09-28*
- [ ] **Código:** `FactionRelation` inicial Concordia ↔ Los del Obelisco, presión 65 (TENSION) — *pendiente: no se siembra ninguna `FactionRelation` inicial (referencia técnica X4, H-7)*

**Acción de implementación:** añadir (facción nueva) + modificar (líder de la Concordia)
**Prioridad:** media
**Dependencias:** A-37 (el líder radical que sustituye a Yovenne al frente de la Concordia); A-14 (el edicto que citan)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/historia.md` (§ Las Alianzas, Concordia de Hierro)
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Goirntes, "La guerra, vista desde aquí")
- `docs/rpgtarkor/sistemas-reino/facciones-diplomacia.md`
- `docs/rpgtarkor/sistemas-reino/expediciones-poblacion.md` (§ 4.6, reparto del pool `goirntes`)
- `docs/rpgtarkor/personajes/npcs.md` (Yovenne Tal)
- *(código: `worldCatalog.ts` → `factions`; `seed-catalog.ts` → `FACTION_LEADER_SLUG`; `reputation.ts` → `REGION_OWNING_FACTIONS`)*

**Notas del aprobador:** corrige de paso la incoherencia actual de `seed-catalog.ts`, donde Yovenne Tal figura como líder de la facción a la que se opone.

---

**Propuesta:**

**Qué es.** La corriente moderada del orden Goirnte. El canon ya la tiene (Yovenne Tal, "la
facción moderada libra su propia guerra en los pasillos"), pero sin `Faction` propia. No es una
rama de la Concordia: es la parte del orden que se niega a que la Concordia sea *todo* el orden.
Su fuerza no son los soldados, sino el procedimiento. Una ley grabada en un obelisco obliga también
a quien la grabó, y ellos son quienes lo recuerdan en voz alta.

**Nombre.** En lengua común, *Los del Obelisco*. En Kerost, *los del Vresk'ord*, porque se les
nombra por aquello a lo que apelan (palabra ya canon, sin morfemas nuevos). El contraste es
deliberado: puertas adentro la Concordia se llama a secas *Ord*, "el Imperio". Para un Goirnte
moderado, Imperio y ley escrita no son lo mismo, y toda su política cabe en esa diferencia.

**Quiénes son.** La Archimagistrada Yovenne Tal y los magistrados y archiveros de los obeliscos.
Salen de la casta de ley. Dentro de la casta hay **linajes**, no familias nobles: el oficio de
archivero o magistrado se hereda. El castigo más temido, por encima de cualquier pena tasada, es
que un linaje quede **degradado**: expulsado de la casta por haber dejado algo inacabado, sea un
juicio sin sentencia o un registro sin cerrar. Es el tabú Goirnte llevado a la política, y la razón
por la que ningún moderado se atreve a presentar las pruebas de la traición del sello sin tenerlas
completas.

**Qué quieren.**
1. Frenar la guerra sin romper el orden. Desobedecer es desorden, así que no se rebelan: exigen
   que cada orden se sostenga por escrito y se pueda contrastar con un edicto grabado.
2. Conseguir pruebas "en orden" de la traición del sello: lo que vio Dessa Kaltrenn, lo que sabe
   Kael Dorn y lo que registró la piel de Cassia Von-Thair. Ninguna ha llegado todavía por un canal
   legítimo.
3. Devolver los contingentes orcos a lo que dice el Primer Edicto del Tributo (A-14): "en defensa
   del orden", no "donde el mando decida".

**Relaciones iniciales.**

| Con | Postura | Por qué |
|---|---|---|
| Concordia de Hierro | tensión alta, sin ruptura | Se necesitan: los radicales, la legitimidad de la ley; los moderados, la protección del mando. |
| Keseg Sael (A-02) | desconfianza útil | Son sus testigos potenciales (Yerin Slaad llevó la carta del sabotaje), pero el Yugo pesa. |
| Clan Helsig / Clan Goshg | neutral | Proponen limitar el tributo a lo pactado. Los clanes no se fían, pero escuchan. |
| Clan Serhu | frialdad | Los ven como el brazo de los radicales. No los reconocen como interlocutores. |
| Faerus (A-04, A-05) | sin contacto | Nadie en la Meseta los considera sujetos de ley, tampoco los moderados. Es su ceguera. |

**Ficha técnica (`FactionInput`):**
- `slug: 'los-del-obelisco'`, `name: 'Los del Obelisco'`, `raza: 'goirntes'`.
- `description`: "Corriente moderada del orden Goirnte, nacida de la casta de ley. Magistrados y
  archiveros de los obeliscos que se niegan a que la Concordia sea todo el orden: no se rebelan,
  porque desobedecer es desorden, pero exigen que cada orden se sostenga en un edicto grabado. Los
  lidera la Archimagistrada Yovenne Tal desde El Baluarte de Goirme. Buscan pruebas presentadas en
  orden de la traición del sello y citan de memoria el Primer Edicto del Tributo contra el uso que
  la Concordia hace hoy de los contingentes orcos."
- Líder: `yovenne-tal` (pasa de la Concordia a esta facción).
- Región: comparte La Meseta del Orden → `REGION_OWNING_FACTIONS['La Meseta del Orden'] =
  ['Concordia de Hierro', 'Los del Obelisco']`.
- Población: **300** del pool `goirntes` (4.000; la Concordia conserva el resto). Casi sin
  soldados, apenas una guardia de archivo de unos **20**.
- `FactionRelation` inicial con la Concordia: presión 65 (TENSION).

**Preguntas abiertas resueltas:**
1. ¿Quién lidera la Concordia si no es Yovenne? → El Primer Censor Tarsen Vold, ficha nueva en A-37. *(decidido por Claude, revisable)*
2. ¿"Familias nobles" o "linajes de casta de ley"? → Linajes dentro de la casta de ley. La degradación es el castigo al linaje que deja algo inacabado. *(decidido por Claude, revisable)*
3. ¿Cifras? → 300 miembros y unos 20 guardias de archivo. *(decidido por Claude, revisable)*

---

### A-02 · 2026-09-27 — Keseg Sael: los Nabieus del Margen
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Facciones Nabieus" + "El Archivo Silente")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): razas.md § Nabieus · regiones/margen-silencioso.md (Refugio + Archivo) · `lenguas-helek.md` · facciones-diplomacia.md § 7.2-bis
- [x] **Código:** `factions`: añadir `keseg-sael` — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `REGION_OWNING_FACTIONS['El Margen Silencioso']` = Keseg Sael + Feg Tusha (el Margen deja de ser `SIN_DUENO`) — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `worldPopulation.ts`: 1.500 del pool `nabieus` — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `FACTION_LEADER_SLUG`: `keseg-sael: aven-tessk` (NPC de la pasada de conexión, ver P-04) — *hecho, verificado en código el 2026-09-28*
- [ ] **Código:** Opcional: `Location` interior del Archivo del Refugio

**Acción de implementación:** añadir
**Prioridad:** media
**Dependencias:** ninguna (A-11 da su historia; A-07 fija el nombre en `lenguas-helek.md`)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Nabieus)
- `docs/rpgtarkor/lore-mundo/areas.md` (§ El Margen Silencioso; El Refugio sin Nombre)
- `docs/rpgtarkor/sistemas-reino/facciones-diplomacia.md`
- `docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md` (§ 5-bis punto 12: el Margen deja de ser `SIN_DUENO`)
- *(código: `worldCatalog.ts` → `factions`; `reputation.ts` → `REGION_OWNING_FACTIONS`; `worldPopulation.ts`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**El nombre.** Los Nabieus nombran a sus clanes como "el fin de algo". *Keseg Sael* es "el fin del
callar". El Refugio sin Nombre es el único sitio de Berig donde un Nabieus no tiene que guardar lo
que sabe, porque allí solo hay Nabieus. Hacia fuera nunca dicen ese nombre, por la misma regla que
deja al Refugio sin nombre en lenguas ajenas: un forastero que sabe cómo se llama el clan ha oído
algo que no debía.

**Quiénes son.** El grueso de los Nabieus de Berig: la mitad oriental del Margen, dispersos en
grupos pequeños alrededor del Refugio. De aquí salen casi todos los mensajeros que la Concordia
usa por presión. Su código es el *Karo'sael*: llevar sin abrir y sin preguntar. No tienen gobierno.
Ante algo grave se convoca un *Keseg'Vhurne* (cónclave), y Keseg Sael pone siempre la mayor parte
de las voces.

**El Archivo del Refugio.** Cámaras excavadas bajo el Refugio, tapizadas de Musgo Callado (A-20),
donde se guardan **tablillas de observación**: lo que un Nabieus ha visto, medido o contado con sus
propios ojos. Nunca se guardan cartas, porque copiarlas o conservarlas rompería el Karo'sael. Es la
herencia directa del Archivo Cegado del reino enterrado, y lo saben: su pueblo no dejó de
investigar, aprendió dónde hacerlo. Una norma sin excepciones: quien alza la voz dentro del Archivo
no vuelve a entrar.

**Relaciones iniciales.**

| Con | Postura | Por qué |
|---|---|---|
| Concordia de Hierro | sumisión sin lealtad | Sirven porque sobrevivir exige servir. El Yugo y la Purga no se olvidan. |
| Los del Obelisco (A-01) | cautela | Son los únicos Goirntes que podrían escucharles, y los primeros que les pedirían hablar. |
| Feg Tusha (A-04) | convivencia distante | Canon: sin desprecio. Comparten el Margen por mitades y el Cruce de las Ausencias (A-15). |
| Keseg Prisilke (A-03) | parentesco | Noticias por mensajero. No hay rivalidad, pero sí la sensación de que "los del borde" cambiaron. |
| Clanes orcos | poco contacto | Sin conflicto ni interés común. |

**Ficha técnica (`FactionInput`):**
- `slug: 'keseg-sael'`, `name: 'Keseg Sael'`, `raza: 'nabieus'`.
- `description`: "Los Nabieus de la mitad oriental de El Margen Silencioso, dispersos en torno a El
  Refugio sin Nombre. Hacia fuera el clan no da su nombre, 'el fin del callar', porque el Refugio es
  el único lugar donde un Nabieus puede dejar de guardar lo que sabe. Sirven a la Concordia como
  mensajeros por pura supervivencia, bajo el código del Karo'sael, y guardan bajo el Refugio un
  archivo de tablillas de observación, herencia del reino que Madre enterró."
- Sin líder `Npc` (no tienen cargo de mando). El motor de disputas necesita leer Inteligencia de un
  líder: se propone un **portavoz de cónclave** sin título, con su propia ficha cuando se siembre el
  Refugio (fuera de esta tanda).
- Región: `REGION_OWNING_FACTIONS['El Margen Silencioso'] = ['Keseg Sael', 'Feg Tusha']`. Es la
  primera vez que el Margen tiene dueño mecánico.
- Población: **1.500** del pool `nabieus` (2.600). Keseg Prisilke toma 500 (A-03) y unos 600 quedan
  sin facción: mensajeros que viven en la Meseta y en los puestos de la Concordia.

**Preguntas abiertas resueltas:**
1. ¿`Keseg Sael` como "el fin del callar"? → Sí. *(decidido por Claude, revisable)*
2. ¿Dueña mecánica del Margen o frontera libre? → Dueña compartida con Feg Tusha, por mitades. *(decidido por Claude, revisable)*
3. ¿El Archivo es visitable? → Sí, pero solo con reputación máxima con Keseg Sael y sin interacción posible dentro (no se puede hablar en voz alta). Diseño de la visita fuera de esta tanda. *(decidido por Claude, revisable)*

---

### A-03 · 2026-09-27 — Keseg Prisilke como facción
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Facciones Nabieus", facción 2)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): razas.md § Nabieus · regiones/cienaga-troncal.md (Jeyselt) · facciones-diplomacia.md § 7.2-bis
- [x] **Código:** `factions`: añadir `keseg-prisilke` — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `REGION_OWNING_FACTIONS['Ciénaga Troncal']` = Clan Goshg + Keseg Prisilke — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `worldPopulation.ts`: 500 del pool `nabieus` — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `FACTION_LEADER_SLUG`: `keseg-prisilke: ilka-dren` (ver P-04) — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir (el poblado y el interior ya existen; falta la `Faction`)
**Prioridad:** media
**Dependencias:** A-11 (explica su origen)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Nabieus, "Los del borde de la Ciénaga")
- `docs/rpgtarkor/sistemas-reino/facciones-diplomacia.md`
- *(código: `worldCatalog.ts` → `factions`; `reputation.ts` → `REGION_OWNING_FACTIONS`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Qué es.** El clan ya canon de Jeyselt ("Fin Susurrado"), en el sur de Ciénaga Troncal
(`conclave-keseg-prisilke` y su interior ya están sembrados). Es la rama de extremidades largas y
piel con manchas verdes, que vive de la caza y de la madera de los Trepadores Ocaso más que de los
mensajes. Su nombre es el final de la segunda huida (A-11): el silencio que dejaron de necesitar
entero y rebajaron a susurro.

**Rasgo propio.** Son los únicos Nabieus que la Concordia apenas usa como mensajeros. Les exige
madera, igual que a los Goshg, y eso los ha alejado de los secretos y acercado a sus vecinos orcos.
Keseg Sael los ve como "los que se olvidaron de callar", sin desprecio pero con distancia.

**Relaciones iniciales.**

| Con | Postura | Por qué |
|---|---|---|
| Clan Goshg | convivencia práctica | Vecinos de la Ciénaga. Intercambian madera y noticias; no se casan entre sí. |
| Concordia de Hierro | tributo resignado | Madera, no mensajeros. |
| Keseg Sael (A-02) | parentesco | Ver A-02. |
| Faerus | sin contacto | No comparten región. |

**Ficha técnica (`FactionInput`):**
- `slug: 'keseg-prisilke'`, `name: 'Keseg Prisilke'`, `raza: 'nabieus'`.
- `description`: "El clan nabieus del sur de Ciénaga Troncal, con poblado en Jeyselt ('Fin
  Susurrado'). Generaciones en aguas altas les dieron brazos y piernas más largos, piel con manchas
  verdes y una postura encorvada. Viven de la caza y de la madera de los Trepadores Ocaso más que
  del sigilo, y comparten la Ciénaga con el Clan Goshg en una convivencia práctica. La Concordia les
  exige madera, no cartas."
- Región: `REGION_OWNING_FACTIONS['Ciénaga Troncal'] = ['Clan Goshg', 'Keseg Prisilke']`.
- Población: **500** del pool `nabieus`.

**Preguntas abiertas resueltas:**
1. ¿Comparte la Ciénaga como dueña mecánica? → Sí, con el Clan Goshg. `REGION_DEFENSOR` (worldAgenda.ts) sigue siendo Goshg. *(decidido por Claude, revisable)*

---

### A-04 · 2026-09-27 — Feg Tusha: los Faerus de Hashma
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Facciones Faerus" + "Asentamiento del Feg Tusha en Hashma")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): razas.md § Faerus · regiones/margen-silencioso.md (Hashma) · cronologia-mitica.md (año 0) · facciones-diplomacia.md § 7.2-bis
- [x] **Código:** `factions`: añadir `feg-tusha` — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `worldPopulation.ts`: 850 del pool `faerus` — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `FACTION_LEADER_SLUG`: `feg-tusha: hulki` (depende de A-38) — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** media
**Dependencias:** A-06 (cómo se manda sin cargo)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Faerus)
- `docs/rpgtarkor/lore-mundo/areas.md` (§ El Margen Silencioso, Hashma)
- `docs/rpgtarkor/lore-mundo/cronologia.md` (fila del año 0)
- `docs/rpgtarkor/sistemas-reino/facciones-diplomacia.md`
- *(código: `worldCatalog.ts` → `factions`; `reputation.ts`; `worldPopulation.ts`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Qué es.** "Manada Madre". Es el nombre canon del grupo de Hashma/Selviterna, el poblado colgado
de los árboles en la selva occidental del Margen, cerca de la costa. Su interior es el *Jakut
Tusha*, "Trono Madre". Es la manada base: la más numerosa y la más salvaje, con pelaje denso en
tonos de corteza y musgo y una artesanía mínima.

**Origen (año 0).** El canon fecha el año 0 cuando "los Faerus, la última raza diseñada, terminan de
asentarse". Se concreta así: el año 0 es el primer año que la manada base pasó entera en un
poblado fijo, colgado en la selva junto a la costa, en lugar de moverse con la caza. Hashma es
literalmente el hito con el que empieza a contarse el tiempo en Berig, aunque ningún Faerus lo
sepa ni le importe: no cuentan los años.

**Rasgo propio.** El olfato manda sobre la vista en una selva donde no se oye nada. Los de Hashma
son los mejores rastreadores de Berig en terreno cerrado, y los únicos que cruzan el Margen de
lado a lado sin perderse, siguiendo el olor y no el sonido.

**Relaciones iniciales.**

| Con | Postura | Por qué |
|---|---|---|
| Concordia de Hierro | hostil | Las patrullas los tratan como presa. Nadie los invitó a ninguna alianza. |
| Clan Serhu | hostil | Las incursiones de la casta de Ketg en el Margen van contra ellos. |
| Keseg Sael (A-02) | convivencia distante | Canon. |
| Feg Ger (A-05) | misma raza | Sin rivalidad. Las crías pueden cambiar de manada. |
| Clan Maktor | memoria | El vínculo antiguo es de Kegi (A-12); aquí se conoce de oídas. |

**Ficha técnica (`FactionInput`):**
- `slug: 'feg-tusha'`, `name: 'Feg Tusha'`, `raza: 'faerus'`.
- `description`: "La manada base de los Faerus, en Hashma (Selviterna), el poblado colgado sobre
  los árboles en la selva occidental de El Margen Silencioso, cerca de la costa. La más numerosa y
  la más salvaje: pelaje denso en tonos de corteza y musgo, artesanía mínima y un olfato que manda
  sobre la vista. Su asentamiento marca el año 0 de Berig. No tienen cargo de mando: decide quien
  está sentado en el Jakut Tusha, el Trono Madre. Hostiles a la Concordia y a los Serhu, que los
  tratan como presa."
- Líder `Npc`: **Hulki** (A-38). No es un título: es quien más a menudo está en el Jakut (A-06).
- Región: `El Margen Silencioso`, compartida con Keseg Sael (A-02).
- Población: **850** del pool `faerus` (1.200). Feg Ger toma 200 y unos 150 quedan como manadas
  errantes sin poblado, entre ellas lo que quede de la de Riko.

**Preguntas abiertas resueltas:**
1. ¿Costa norte u oeste? → Oeste, como dice `areas.md`. La propuesta original ponía "norte" por error.
2. ¿Cifras? → 850 / 200 / 150 errantes. *(decidido por Claude, revisable)*

---

### A-05 · 2026-09-27 — Feg Ger: los Faerus de Kegi
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Facciones Faerus", facción 3)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): razas.md § Faerus · regiones/llanuras-del-viento-rojo.md (Kegi) · facciones-diplomacia.md § 7.2-bis
- [x] **Código:** `factions`: añadir `feg-ger` (sin región propia) — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `worldPopulation.ts`: 200 del pool `faerus` — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `FACTION_LEADER_SLUG`: `feg-ger: yeru` (depende de A-39) — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** media
**Dependencias:** A-06, A-12 (origen de Kegi)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Faerus, "Las manadas de la frontera norte")
- `docs/rpgtarkor/lore-mundo/areas.md` (§ Kegi; El Vergel de Kegi)
- `docs/rpgtarkor/sistemas-reino/facciones-diplomacia.md`
- *(código: `worldCatalog.ts` → `factions`; `reputation.ts`; `worldPopulation.ts`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Qué es.** "Manada Roja", en Kegi ("Arena" en Feg), en la franja sur de las Llanuras que el canon
reconoce como Faerus. Su interior es el *Jakut Ger*, "Trono Rojo". `Ger` es el rojo de su pelaje:
corto, rojizo con matices verdes, moldeado por generaciones de calor y polvo. Son los Faerus más
sociables y los mejores curtidores de su raza, por el trato con los orcos (A-12).

**Rasgo propio.** Son la única manada que **comercia de verdad**. En El Vergel de Kegi, junto al
poblado, se cambian pieles curtidas y colmillo tallado (A-32) por hierro, sal y Lana de Múrgol.
Comercian con cualquier orco, pero solo **comparten la primera pieza** con quien la manada considera
propio. Desde el segundo golpe contra los Maktor, eso no ha vuelto a pasar con ningún orco, salvo
con un joven que pasó un año entre ellos (Gorhorn; ver A-39).

**Relaciones iniciales.**

| Con | Postura | Por qué |
|---|---|---|
| Clan Serhu | comercio frío | Dueños de la región y vecinos inevitables. Comercian, pero huelen el miedo que gobierna el Karot Veku y no se fían. |
| Clan Maktor | vínculo antiguo | El Pacto de la Primera Pieza (A-12). Hoy se reduce a Gorhorn. |
| Concordia de Hierro | hostil | La misma que con Feg Tusha, aunque en la llanura hay menos patrullas. |
| Feg Tusha (A-04) | misma raza | Ver A-04. |

**Ficha técnica (`FactionInput`):**
- `slug: 'feg-ger'`, `name: 'Feg Ger'`, `raza: 'faerus'`.
- `description`: "La manada Faerus de la llanura, en Kegi, en la franja sur de las Llanuras del
  Viento Rojo. Pelaje corto y rojizo, la artesanía de cuero más fina de su raza y la única manada
  que comercia de verdad, en El Vergel de Kegi. Nació de un pacto antiguo con el Clan Maktor:
  comercian con cualquier orco, pero solo comparten la primera pieza con quien consideran de la
  manada. Deciden desde el Jakut Ger, el Trono Rojo, sin cargo de mando."
- Líder `Npc`: **Yeru** (A-39).
- Región: no es dueña. Vive en la región de los Serhu sin disputarla (`REGION_OWNING_FACTIONS` no
  cambia para las Llanuras).
- Población: **200** del pool `faerus`.

**Preguntas abiertas resueltas:**
1. ¿Feg Ger debe figurar como dueña de alguna región? → No. Se recomienda un `ZonePoint`/`Location` propio para Kegi con dueño local cuando exista la granularidad por zona. *(decidido por Claude, revisable)*

---

## Categoría: Razas y cultura

### A-06 · 2026-09-27 — El Jakut: mandar sin cargo
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: extraído de "Facciones Faerus", corrigiendo los títulos inventados Ger-tusha / Ger-ash)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): razas.md § Faerus (El Jakut) · lenguas-helek.md (Jakut)
- [ ] **Código:** Nada propio. Queda cubierto por los `liderNpcId` de A-04 y A-05. Opcional: `ZonePoint` del Jakut dentro de cada interior

**Acción de implementación:** añadir
**Prioridad:** media
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Faerus)
- `docs/rpgtarkor/lore-mundo/lenguas-helek.md` (Feg: nota en `Jakut`)

**Notas del aprobador:** ninguna.

---

**Propuesta:**

`lenguas-helek.md` dice que la manada no se gobierna y que no hay palabra para quien manda. Pero
los dos interiores Faerus se llaman *Jakut*, "trono". Las dos cosas encajan si lo que tiene nombre
es el **sitio** y no el cargo.

- El Jakut es un lugar físico: en Hashma, una plataforma ancha en la horquilla del árbol más viejo
  del poblado; en Kegi, una losa plana de piedra roja a la sombra del Vergel.
- Quien está sentado en el Jakut decide lo que hay que decidir **mientras está sentado**. Cuando se
  levanta, deja de decidir. Nadie "es" líder: *se está* en el Jakut.
- ¿Quién se sienta? Quien la manada deja sentarse. En la práctica, casi siempre el más fuerte o el
  más viejo, pero no hay regla. Cuando dos quieren el sitio a la vez, se resuelve con el olfato y no
  a golpes: el que huele a miedo se aparta. Es el mismo sentido que lee el ánimo de los demás
  (canon), usado para zanjar disputas.
- Consecuencia para el jugador: negociar con una manada Faerus es negociar con quien esté en el
  Jakut **ese día**. Un acuerdo no obliga a quien se siente mañana, salvo que se haya sellado con la
  primera pieza (*Vash'grath*). Para un Faerus, lo único que dura es el parentesco, no la palabra
  dada.

**Por qué funciona en el mundo.** Es el mismo principio del canon ("se sigue al más fuerte o al más
viejo en el momento"), ahora con un lugar donde ocurre. Y da al motor un "líder" que no contradice
la cultura: el `liderNpcId` de cada facción Faerus es quien más a menudo está en el Jakut, no un
cargo.

**Preguntas abiertas resueltas:**
1. ¿"Se está en el Jakut" como regla cultural? → Sí. *(decidido por Claude, revisable)*

---

## Categoría: Idiomas

### A-07 · 2026-09-27 — Vocabulario nuevo de la tanda
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)**

**Seguimiento:**
- [x] **En docs** (2026-09-27): `lenguas-helek.md`
- [ ] **Código:** Opcional: `loreChunks.ts` con el vocabulario nuevo + `npm run reindex-lore`

**Acción de implementación:** añadir
**Prioridad:** media (va junto con las fichas que lo usan)
**Dependencias:** las fichas citadas en cada entrada
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/lenguas-helek.md`

**Notas del aprobador:** ninguna.

---

**Propuesta:**

Solo se crean **tres raíces nuevas**. El resto son combinaciones de palabras que ya existen.

**Kektira**
- `Drogh` — **Lazo** | **atadura** *(raíz nueva)*. Consonante final gutural, igual que `Tugh` o `Makut`.
- `Drogh'tugh` — **El Lazo del honor**: el juramento de la Mesa del Lazo (A-13).
- `Vash'grath` — préstamo del Feg entre los Maktor ("la primera pieza"). Los orcos usan la palabra
  Faerus sin traducirla, igual que los Goirntes usan "Concordia" sin traducirla al Kerost (A-12).

**Feg**
- `Leshra` — **Ave de noche** *(raíz nueva)*. Nombre del ave de A-28.
- `Ashi'krul` — **El colmillo que huele**: nombre de la daga de A-32 (`Ashi` + `Krul`, ya canon).
- Nota en `Jakut`: "el sitio desde el que se decide, no el cargo" (A-06).

**Naebius**
- `Keseg Sael` — **El fin del callar**: nombre interno del clan del Refugio sin Nombre (A-02). No
  se pronuncia ante extranjeros.
- `Tovh` — **Palma** | **mano abierta** *(raíz nueva)*.
- `Tovh'vhurne` — **Escuchar con la palma**: leer vibraciones del suelo, las raíces o el agua
  apoyando la mano (A-11). Es el equivalente, con el terreno, de lo que el `Tannis'sael` hace con
  las personas.

**Kerost**: sin palabras nuevas. *Los del Vresk'ord* (A-01) y *Ord'teandu* (A-14) usan vocabulario
ya existente.

**Preguntas abiertas resueltas:**
1. ¿Nombres Naebius o Feg para el Cruce de las Ausencias (A-15)? → Ninguno, a propósito. Los Nabieus no nombran lugares ante extraños y los Faerus no nombran lo que no es suyo. *(decidido por Claude, revisable)*

---

### A-08 · 2026-09-27 — Nombres de las tormentas: forma plena y forma contraída
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: incoherencia de canon detectada en la revisión, no una propuesta de OpenCode)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `lenguas-helek.md` · `clima-tormentas.md`
- [ ] **Código:** Nada: el código ya usa las formas contraídas

**Acción de implementación:** modificar
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/lenguas-helek.md` (Kektira: tormentas)
- `docs/rpgtarkor/lore-mundo/clima-tormentas.md` (una línea de referencia)

**Notas del aprobador:** no hay que tocar código.

---

**Propuesta:**

**El problema.** `clima-tormentas.md`, `areas.md`, `worldClock.ts` y `loreChunks.ts` usan
**Sek'tar / Rokthar / Rok'ithek**. `lenguas-helek.md` usa **Sekt'ithek / Rokth'arho /
Rokth'ithek**.

**La solución, sin tocar código.** Las dos series son correctas: una es la forma plena y la otra la
forma hablada. `lenguas-helek.md` ya tiene un precedente: `Ur'sedsar` es `Arho` + `Sedsar`
contraído. Se aplica lo mismo a las tormentas:

| Forma plena (etimología) | Forma hablada (la que usa el juego) | Significado |
|---|---|---|
| `Sekt'ithek` | **Sek'tar** | el viento cortante |
| `Rokth'arho` | **Rokthar** | la gran tormenta |
| `Rokth'ithek` | **Rok'ithek** | la ira del viento |

En `lenguas-helek.md` se añade la forma hablada junto a cada entrada. En `clima-tormentas.md` se
añade una línea que remite a la etimología. El motor sigue mostrando lo mismo que hoy.

**Preguntas abiertas resueltas:**
1. ¿Unificar hacia la versión de `lenguas-helek.md` y cambiar el código? → No. Contraer es natural en una lengua hablada, y así el cambio sale gratis. *(decidido por Claude, revisable)*

---

## Categoría: Construcciones y reino

### A-09 · 2026-09-27 — Los talleres que faltan en Karot Veku
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Construcciones de Clan Serhu")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/llanuras-del-viento-rojo.md § Karot Veku
- [x] **Código** (2026-09-28): `factionBuildings` (`worldCatalog.ts`): Herboristería, Taller de Alquimia, Corrales del Domador, Desolladero y Carpintería del Clan Serhu
- [x] **Código** (2026-09-28): `ZonePoint` EDIFICIO de cada uno en `campamento-serhu-interior`, junto al ZonePoint NPC ya existente de su Maestro (Herborista, Alquimista, Domador, Desollador, Carpintero) — los Maestros ya vivían en `campamento-serhu-interior`, no hizo falta reubicarlos, solo darles su edificio.
- [x] **Código** (2026-09-28): `herreria-serhu.description` ampliada con el horno de arcilla y la lona de parches.

**Acción de implementación:** añadir (edificios de facción de catálogo) + modificar (descripción de la Herrería)
**Prioridad:** **alta**: `areas.md` ya promete estos talleres y el catálogo no los tiene.
**Dependencias:** ninguna (los Maestros ya existen)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/areas.md` (§ Dentro de Karot Veku — el Ketg'lukar)
- *(código: `factionBuildings` en `worldCatalog.ts` + un `ZonePoint` por edificio en `campamento-serhu-interior` + `homeLocationSlug`/posición del Maestro correspondiente)*

**Notas del aprobador:** no son recetas de `construction.ts`. El jugador no puede construirlas: son edificios de la facción Serhu (`Building.factionId`), igual que la Herrería, la Curtiduría y la Cocina ya sembradas.

---

**Propuesta:**

`areas.md` enumera siete talleres en el Ketg'lukar: forja, curtiduría, cocina común, herboristería,
alquimia, corrales del Domador y desolladero. El catálogo solo tiene los tres primeros más el
Ketg'sedsar. Faltan cuatro, y se añade la carpintería porque el oficio y el Maestro Carpintero Serhu
ya existen. Cada taller se construye con un material distinto de la región, para que el poblado no
parezca hecho solo de Telda. Los nombres siguen el patrón de los que ya existen ("X del Clan Serhu").

| # | Edificio | Maestro que lo ocupa (ya sembrado) |
|---|---|---|
| 1 | Herboristería del Clan Serhu | Maestra Herborista Serhu |
| 2 | Taller de Alquimia del Clan Serhu | Maestro Alquimista Serhu |
| 3 | Corrales del Domador | Maestro Domador Serhu |
| 4 | Desolladero del Clan Serhu | Maestro Desollador Serhu |
| 5 | Carpintería del Clan Serhu | Maestro Carpintero Serhu |

1. **Herboristería del Clan Serhu.** Estancia baja de adobe con tejado de **Musgo Rojo**. Es el
   primer uso real del material de construcción del Musgo Arcilla, que `flora-fauna.md` reserva
   para "futuras edificaciones orcas". De cuerdas de fibra de Enredadera cuelgan a secar manojos de
   Salvia del Polvo y Flor de Ceniza. Hay mesas de piedra con morteros de hueso. Huele a amargo y a
   ceniza fría. De aquí sale la cataplasma de salvia que Gorhorn lleva de serie.
2. **Taller de Alquimia del Clan Serhu.** Pegado a la herboristería, separado por una cortina de
   piel curtida. Tiene un fogón pequeño alimentado con **Matorral de Cuerno** (arde lento y
   caliente, la leña que la alquimia necesita), recipientes de cuerno de Múrgol y Flor Salvatura en
   conserva. Es el único lugar del poblado donde se trabaja a fuego lento y con paciencia, a
   contrapelo del carácter del clan. Los demás Serhu lo miran con cierta desconfianza.
3. **Corrales del Domador.** Recinto dentro de la empalizada con postes de **Huesos de Gargantúa**
   del Osario de la Manada. Según el canon allí "se toma hueso, no se profana", y el Domador es
   precisamente el oficio ligado a la Gargantúa. Tiene un abrevadero de piedra que se llena a mano
   desde el Pozo de Cauce Viejo. Aquí se aclimatan las bestias recién domadas antes de pasar al gran
   recinto de Múrgol de fuera. La Terk'ikar Ulkha Ketg, que es Domadora, lo visita a diario.
4. **Desolladero del Clan Serhu.** A sotavento, junto a la salida trasera hacia el recinto de
   Múrgol. Bastidores de **cornamenta de Múrgol** para tensar pieles, y un canal de arcilla que saca
   la sangre fuera de la empalizada. Es el oficio en el que los Serhu destacan de verdad (canon:
   "desuello y peletería"). Aquí se venden los Desolladores de sílice (A-33).
5. **Carpintería del Clan Serhu.** Suelo de arcilla y bancos con herramientas de asta y hueso. En
   soportes de piedra se secan vigas de **Telda**, impregnadas de Resina Telda Gris. De aquí salen
   las estacas de la empalizada y los botes de fondo plano del Embarcadero de Ceniza.

**Mejora de la Herrería existente** (de "Forja de Ceniza Caliente"). Se añade a la descripción
actual: horno de arcilla endurecida bajo una lona de parches y un humo que nunca termina de irse.
Encaja con la herrería "mediocre y mal orientada" del canon.

**Descartado de la propuesta original:** Cantera y Bodega (no hay oficio que las ocupe) y los
nombres "Karot Veku - X Vek" ("Vek" no significa nada; *Veku* es colmillo).

**Preguntas abiertas resueltas:**
1. ¿Nombres en Kektira? → No. Se quedan en lengua común, como los tres edificios ya sembrados. *(decidido por Claude, revisable)*
2. ¿Qué Maestro va a cada taller? → Tabla de arriba. Todos existen ya en `worldCatalog.ts`.

---

## Categoría: Historia y cronología

### A-10 · Era mítica, sin fechar — Fundación de El Baluarte de Goirme
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Fundación del Reino de Goirme sobre la Meseta")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `cronologia-mitica.md` · `regiones/meseta-del-orden.md`
- [ ] **Código:** Opcional: `historiaEntries` (`era: 'semillas'`) + objeto documento

**Acción de implementación:** añadir
**Prioridad:** baja (la Meseta no es jugable todavía)
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/cronologia-mitica.md` (§ Las razas diseñadas, tras la primera oleada)
- `docs/rpgtarkor/lore-mundo/areas.md` (§ La Meseta del Orden)
- *(código opcional: `historiaEntries` con `era: 'semillas'`, `year: null`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Qué pasó.** El canon dice que los primeros Goirntes "leyeron la simetría de la Meseta como una
ley escrita expresamente para ellos". Su primer acto como pueblo fue coherente con eso: antes de
levantar un muro, buscaron el punto donde se cruzan los ejes de la Meseta, tallaron allí un
**obelisco** y grabaron en él las primeras leyes. La ciudad-fortaleza se construyó después,
alrededor del obelisco y siguiendo sus ejes. Por eso El Baluarte tiene hoy "el obelisco de leyes
más alto de todo Berig en su plaza central": es el primero, no el más grande. Los Goirntes lo
enseñan a sus hijos como lección fundacional: *primero la ley, después la ciudad*.

**Base física.** La simetría de la Meseta es obra de Goirme durante la Formación, sobre el material
de Liania. Los Goirntes no crearon nada: la midieron.

**Documento para la Enciclopedia (opcional):** un calco del primer edicto en papel encerado, de los
que se regalan a los niños Goirntes al entrar en su casta. Sería el `documentoItemSlug` si se
siembra como `HistoriaEntry`.

**Corregido de la propuesta original:** la ciudad no se llama Vresk'ord (esa palabra es el
obelisco), no se funda en el 2.200 (los Goirntes son de la primera oleada), las Semillas no están
"extinguidas" y los orcos no están al sur.

**Preguntas abiertas resueltas:**
1. ¿Sin fecha, dentro de la primera oleada? → Sí, por la regla de `cronologia-mitica.md`.

---

### A-11 · Era mítica, sin fechar — La segunda huida Nabieus y la escucha con la palma
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "La División del Silencio" + piezas de "El Código de la Arena" y "El Registro de las Cuatro Señas")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `cronologia-mitica.md` · razas.md § Nabieus
- [ ] **Código:** Opcional: `historiaEntries` + `loreChunks.ts`

**Acción de implementación:** añadir
**Prioridad:** media
**Dependencias:** A-07 (`Tovh'vhurne`); da origen a A-03
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Nabieus, "Los del borde de la Ciénaga")
- `docs/rpgtarkor/lore-mundo/cronologia-mitica.md` (tras "La caída del Reino Nabierus")
- `docs/rpgtarkor/lore-mundo/areas.md` (§ Antes de los orcos: una frase)

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Qué explica.** El canon dice que los supervivientes del Reino Nabierus huyeron al Margen y,
"generaciones después", a la Ciénaga. No dice por qué se separaron.

**La escucha con la palma (*Tovh'vhurne*).** El Margen apaga el sonido en el aire, pero no apaga la
vibración que viaja por el suelo y las raíces. Obligados a vivir donde el oído sirve de poco, los
Nabieus aprendieron a apoyar la mano en una raíz o en el suelo para leer pasos, cargas o bestias
que se acercan. Es física corriente: el Kirelon Arenoso caza exactamente así. La Veldria Hueca
(A-21), cuyo tronco conduce la vibración de toda la red de raíces, es su mejor aliada. No sustituye
a la gramática de los silencios, que sirve para leer a las personas. Es lo mismo aplicado al
terreno.

**La segunda huida.** Un grupo de cazadores descubrió que en el agua estancada la vibración viaja
todavía mejor: una presa que chapotea a cien pasos se siente en la pierna metida en el agua.
Primero lo aprendieron en Las Aguas Sordas (A-16). Después siguieron la caza hacia el norte, hasta
las aguas altas del sur de Ciénaga Troncal. Lo que empezó como temporadas de caza acabó siendo una
vida. Generaciones caminando por aguas altas dieron el cuerpo que describe el canon (brazos y
piernas más largos, manchas verdes, postura encorvada), y el oficio pasó del mensaje a la caza y la
madera. Es el origen de Keseg Prisilke (A-03).

**Base física.** Transmisión de vibraciones por sólidos y líquidos, más una adaptación física
acelerada durante generaciones. Todo ocurre antes del año 0, sin intervención de ninguna Semilla.

**Cuándo.** Sin fecha, antes del año 0 y después de la caída del reino. Encaja con el canon, que
sitúa las dos huidas "mucho antes del año 0" y la segunda "generaciones después" de la primera.

**Preguntas abiertas resueltas:**
1. ¿Nombre Naebius de la técnica? → `Tovh'vhurne` (A-07). *(decidido por Claude, revisable)*
2. ¿~1.100 o sin fechar? → Sin fechar. Poner un año contradiría el "mucho antes del año 0" del canon. *(decidido por Claude)*

---

### A-12 · ~2.300 (provisional) — El Pacto de la Primera Pieza y la fundación de Kegi
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Ikar'huanios Veku" + "Fundación del poblado Kegi y el Tratado de Pieles")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `cronologia.md` · clanes-orcos.md § Los Faerus y los Maktor · razas.md § Faerus
- [ ] **Código:** Opcional: `historiaEntries` (`year: 2300`) con el documento "colmillo de Canizor con dos marcas"

**Acción de implementación:** añadir
**Prioridad:** **alta**: explica un hecho canon que hoy no tiene origen.
**Dependencias:** A-05
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` (fila provisional ~2.300)
- `docs/rpgtarkor/lore-mundo/areas.md` (§ Historia profunda; § Los Faerus y los Maktor)
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Faerus)
- *(código opcional: `historiaEntries`, `era: 'comun'`, `year: 2300`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Qué explica.** `areas.md` afirma que "la relación de confianza real de los Faerus fue siempre con
los Maktor, no con los Serhu", pero no dice por qué ni desde cuándo. Kegi tampoco tiene origen.

**Qué pasó.** Unas generaciones después de Krugo y Tevya, una partida de caza Maktor y una manada
Faerus de la frontera sur de las Llanuras abatieron la misma presa, un Canizor adulto, a la vez.
Lo esperable era pelear por ella. La cabecilla Maktor, de sangre de Tevya (la que transmitió "el
vínculo con la naturaleza con más fuerza que ninguno"), hizo algo que los Faerus solo habían visto
entre los suyos: ofreció a la manada la **primera pieza**. Para un Faerus, compartir la primera
pieza (*Vash'grath*) define quién es de la manada. El gesto se entendió así: como parentesco, no
como comercio. Que la presa fuera un Canizor, el animal que da nombre a los Maktor, añadió peso al
gesto en los dos pueblos.

**Consecuencias.**
- La manada montó un campamento fijo para seguir tratando con los Maktor. Ese campamento es
  **Kegi** y el origen de Feg Ger (A-05).
- Los Faerus enseñaron el curtido fino y los Maktor compartieron lo que sabían de la llanura
  abierta. Por eso los Faerus de la llanura tienen más artesanía que los de la selva.
- Los Maktor adoptaron la palabra *Vash'grath* sin traducirla (A-07).
- Tras el golpe de Ketg (~2.850), los Serhu no heredaron el pacto: nunca compartieron la primera
  pieza con nadie. Por eso los Faerus comercian con orcos pero confían solo en los Maktor, y por eso
  el año de Gorhorn con ellos "no fue casualidad" (canon).

**Base física.** Ninguna magia: un malentendido cultural afortunado entre dos pueblos con tabúes
parecidos.

**Documento para la Enciclopedia (opcional):** los Faerus no escriben. El objeto puede ser un
**colmillo de Canizor con dos marcas**, un zarpazo Maktor y una muesca Faerus, que se guarda en el
Jakut Ger.

**Preguntas abiertas resueltas:**
1. ¿~2.300 dentro de los 800 años de prosperidad (2.000-2.800)? → Sí, provisional, como el resto de fechas orcas. *(decidido por Claude, revisable)*
2. ¿Nombre Kektira del pacto? → No tiene: los Maktor usan la palabra Feg (A-07). *(decidido por Claude, revisable)*

---

### A-13 · ~2.855 (provisional) — La Mesa del Lazo
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "La Mesa de Pacto de Krugo y la Ley del Lazo")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `cronologia.md` · clanes-orcos.md § La Mesa del Lazo · regiones/llanuras-del-viento-rojo.md (Los Restos de Maktor)
- [ ] **Código:** Opcional: `ZonePoint` narrativo de la Mesa en `restos-de-maktor` + `historiaEntries` (`year: 2855`)

**Acción de implementación:** añadir
**Prioridad:** media
**Dependencias:** A-07 (`Drogh'tugh`)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` (fila provisional ~2.855)
- `docs/rpgtarkor/lore-mundo/areas.md` (§ Historia profunda; § Los Restos de Maktor)
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Orcos, costumbres)

**Notas del aprobador:** no se canoniza que Gorhorn pronunciara el Lazo (ver pregunta 2).

---

**Propuesta:**

**Corrección de base.** En la propuesta original, Krugo preside la mesa, pero en el 2.850 llevaba
siglos muerto (los orcos viven 40-50 años). Ketg era Tarkurok, no Maktor. En ese momento
encabezaban el Clan Maktor la Terk'ikar Tregig y el Kort'ikar Prehk.

**Qué pasó.** Tras la traición de Ketg a Nietka, Tregig vio fallar a dos jefes de guerra: uno por
ambición (Ketg) y otro por debilidad (Prehk, que dejó que Ketg se quedara también con los Maktor).
Sin fuerza para rebelarse, hizo lo único que estaba en su mano: reunió en secreto a los Maktor ante
una losa de piedra roja de la llanura, con un surco en el centro, y fijó un juramento, el
***Drogh'tugh***, el Lazo del honor. Desde entonces, todo Maktor lo pronuncia allí al cumplir los
10 años, el mismo año de la cacería ritual:
1. reconocer los errores de quienes le precedieron;
2. proteger al clan incluso de su propio líder, si ese líder lo daña;
3. aceptar que la unidad vale más que cualquier mando.

Tras cada juramento se echa un puñado de tierra fresca en el surco. Cuando el surco se llena, la
tierra se retira a un montículo junto a la mesa, que crece con cada generación. Es memoria física.

**Consecuencias.**
- Explica el carácter Maktor del canon ("los primeros en dar la cara por su gente") y la clemencia
  de Kadrog con Mordek (~2.900-2.950): perdonar al vencido para que la unidad importe más que la
  victoria. Fue el mayor error de los Maktor, y nació del Lazo.
- También explica que el padre de Gorhorn se rebelara contra el yugo Serhu: el segundo punto
  obliga a proteger al clan de quien lo daña, aunque mande.
- La mesa sobrevive, partida en dos, entre Los Restos de Maktor, junto a un montículo de tierra más
  alto que un orco. Es un elemento narrativo, no un botín: la zona es "sin recursos a propósito".

**Preguntas abiertas resueltas:**
1. ¿Nombre Kektira? → `Drogh'tugh` para el juramento. La mesa se llama "la Mesa del Lazo" en lengua común. *(decidido por Claude, revisable)*
2. ¿Se canoniza que Gorhorn juró el Lazo? → **No, de momento.** Cumplió 10 años el año de la aniquilación y pudo haberlo pronunciado semanas antes, pero afecta a la biografía del protagonista. Queda como posibilidad para una misión personal futura, y el Narrador no debe afirmarlo. *(decidido por Claude, revisable)*

---

### A-14 · ~3.600 (provisional) — El Primer Edicto del Tributo
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Sedsar'tugh del Ithal'ord")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): historia.md § El Yugo de Hierro · `cronologia.md`
- [ ] **Código:** Opcional: `historiaEntries` (`year: 3600`) con un calco del edicto como documento

**Acción de implementación:** añadir
**Prioridad:** media (A-01 lo usa en el presente)
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/historia.md` (§ El Yugo de Hierro)
- `docs/rpgtarkor/lore-mundo/cronologia.md` (tabla provisional: inicio del Yugo)

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Qué es.** El acto que abre el *Ithal'ord*, el Yugo de Hierro ("el imperio que se paga"): el
primer tratado desigual impuesto a los clanes orcos, grabado como *Ord'teandu* (edicto) en el
obelisco de El Baluarte de Goirme (A-10). Todas las palabras ya existen en `lenguas-helek.md`.

**Qué dice.** Tributo anual de mineral y **contingentes de guerra obligatorios**, que cada clan
entrega "en defensa del orden". Lo firmó la casta de Ketg en nombre de los clanes de las Llanuras.
Los grupos emigrados a Cristal Helado y a la Ciénaga, todavía pequeños, quedaron obligados después
por extensión, sin haber firmado nada.

**Por qué importa hoy.**
- El texto sigue grabado y dice "en defensa del orden", no "donde el mando decida". Los del Obelisco
  (A-01) lo citan de memoria contra el uso que la Concordia hace hoy de los contingentes orcos.
- Los archivos oficiales llaman "reajuste de los tratados" a la Purga Silenciosa que lo rompió
  (canon). Para un Goirnte, el edicto nunca se derogó, solo se "reajustó". Ahí está el argumento
  legal con el que la Concordia resucita los contingentes.

**Retirado de la propuesta original:** los "Kuri", las "casas nobles", la supuesta dependencia de
los Helsig (que en el 3.600 aún no se llamaban así) y la firma de los Maktor (ya estaban sometidos a
los Serhu).

**Preguntas abiertas resueltas:**
1. ¿El obelisco original será visitable o legible en juego? → Sí, cuando la Meseta sea jugable. Leerlo sería una pieza de la cadena de pruebas de Los del Obelisco. *(decidido por Claude, revisable)*

---

## Categoría: Lugares y geografía

*(Categoría añadida: la plantilla no la tenía, pero `propuestas-lore.md` sí.)*

### A-15 · 2026-09-27 — El Cruce de las Ausencias
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: fusión de "El Cruce de las Ausencias" y "La Vetea Sin Huella")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `regiones/margen-silencioso.md`
- [x] **Código** (2026-09-28): `Location` `cruce-de-las-ausencias` en `worldCatalog.ts`, sembrada. Sin `LocationLink`: ninguna región fuera de núcleo (Margen/Ciénaga/Meseta/Cristal Helado) tiene `LocationLink`s todavía — no son navegables mecánicamente, coherente con "fuera del núcleo jugable actual". Prompt de imagen pendiente.

**Acción de implementación:** añadir
**Prioridad:** baja (Margen fuera del núcleo jugable)
**Dependencias:** A-20 (flora del lugar)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/areas.md` (sección nueva "Puntos de interés — El Margen Silencioso")
- `docs/rpgtarkor/items-y-catalogo/imagenes-prompts.md` (prompt de imagen, lo escribe Claude y la genera Álvaro)
- *(código: `Location` nueva `cruce-de-las-ausencias`, región El Margen Silencioso, `faunaTerrainTag: 'humedo'`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Dónde.** El centro del Margen, en la línea donde la selva Faerus (oeste) da paso a la mitad
oriental de los Nabieus. No es de nadie.

**Cómo es.** Bosque cerrado de coníferas de madera negra, de copas bajas. El suelo es un entramado
de raíces cubierto de Musgo Callado (A-20). La quietud es total: no se oye el viento, ni los pasos
propios, ni la respiración del que va al lado.
**Etiquetas de terreno:** húmedo, vegetación.

**Para qué sirve.** Es el paso entre las dos mitades del Margen: cazadores Faerus hacia las Llanuras
y mensajeros Nabieus hacia el sur. No hay asentamiento. Rige una norma que nadie ha pactado pero
todos cumplen: **dentro del Cruce nadie ataca a nadie de otra raza**, porque nadie oiría pedir
ayuda.

**La leyenda y su explicación.** Las manadas cuentan que aquí grupos enteros "se desvanecieron". No
hay nada sobrenatural. El Mekiosi espera inmóvil horas, cubierto de musgo, y caza de una embestida.
Donde no se oye un grito, un grupo que se separa unos pasos puede perder a uno tras otro sin que el
resto lo note. El miedo es real y el mecanismo también. Por eso quien cruza lo hace **atado** a sus
compañeros con una cuerda corta: si tira, alguien se ha parado.

**Fauna:** Mekiosi (ya canon) y Brozán (A-30). **Flora:** Musgo Callado, Veldria Hueca (A-21).

**Teaser para el mapa:** "Aquí nadie oye cuando llamas."

**Preguntas abiertas resueltas:**
1. ¿Nombre Faerus o Naebius? → Ninguno, a propósito (ver A-07).

---

### A-16 · 2026-09-27 — Las Aguas Sordas
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "El Pantano de los Susurros", rehecho)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `regiones/margen-silencioso.md`
- [x] **Código** (2026-09-28): `Location` `aguas-sordas` en `worldCatalog.ts`, sembrada. Sin `LocationLink` (ver nota en A-15).

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** A-29 (Morvasa)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/areas.md` (Puntos de interés — El Margen Silencioso)
- *(código: `Location` nueva `aguas-sordas`, `faunaTerrainTag: 'humedo'`)*

**Notas del aprobador:** se cambia el nombre original: "Susurros" chocaba con el significado de *Prisilke* ("susurrado").

---

**Propuesta:**

**Dónde.** La franja pantanosa del Margen, entre el Cruce de las Ausencias y la mitad oriental.

**Cómo es.** Canales y charcas de agua negra entre raíces de coníferas, con islas de raíz que ceden
bajo el peso de algo grande. El agua **no suena**: ni chapoteo ni goteo. La única forma de saber que
algo se mueve es **mirar el agua**. Las ondas se ven, pero no se oyen. Por eso quien caza aquí caza
con los ojos en la superficie y no en la orilla.
**Etiquetas de terreno:** húmedo, vegetación. *(La propuesta original añadía "árido" por error.)*

**Quién va.** Nadie vive aquí. Los cazadores de Feg Tusha bajan en temporada seca. Según A-11, aquí
aprendieron los Nabieus que la vibración viaja mejor por el agua, y de aquí partió la segunda huida.

**Fauna:** Morvasa (A-29) en los canales, Mekiosi en las orillas y Hetris en el dosel.
**Flora:** Musgo Callado, Carnosa de Tocón (A-24) en los tocones caídos.

**Teaser para el mapa:** "Mira el agua. No va a avisarte de otra forma."

**Retirado de la propuesta original:** que los orcos llegaran antes que los Faerus, los "Faerus de
las llanuras" viviendo aquí, los hongos bioluminiscentes (sin mecanismo), los reptiles "púrpura
metálico" y la niebla matinal (el Margen no tiene niebla; la niebla es del Estrecho).

**Preguntas abiertas resueltas:**
1. ¿Profundidad significativa? → Canales de hasta dos metros. Un personaje sin nadar no los cruza, pero no hay mecánica de ahogamiento que añadir. *(decidido por Claude, revisable)*

---

### A-17 · 2026-09-27 — La Proa Gris
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "La Mesa del Vuelo Silencioso", rehecho)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `regiones/margen-silencioso.md`
- [x] **Código** (2026-09-28): `Location` `proa-gris` en `worldCatalog.ts`, sembrada. Sin `LocationLink` (ver nota en A-15).

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/areas.md` (Puntos de interés — El Margen Silencioso)
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (§ Sombras de Kroj: una línea sobre dónde cazan)
- *(código: `Location` nueva `proa-gris`, `faunaTerrainTag: 'arido'`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Dónde.** El borde sur del Margen, donde la roca gris de la Meseta del Orden se adentra en la
selva como la proa de un barco. Es la única altura del Margen.

**Cómo es.** Un espolón de piedra gris con la misma simetría antinatural de la Meseta, que se
**deshace a medida que avanza hacia la selva**. En la base, las grietas son rectas y paralelas; en
la punta, ya son irregulares, como si el trabajo de Goirme se hubiera quedado sin fuerza. Termina
en cortados de treinta metros sobre el dosel. Solo crece musgo en las grietas.
**Etiquetas de terreno:** rocoso, árido.

**Para qué sirve.** Es el único punto del Margen desde el que se **ve** lejos. Los Nabieus de Keseg
Sael mantienen aquí un turno de vigía rotativo (5-10 a la vez), que cuenta las columnas de la
Concordia por el corredor costero occidental. No hay asentamiento.

**Por qué es peligrosa.** Es terreno de caza de las **Sombras de Kroj**. El canon ya dice que
devuelven el sonido distorsionado "para atraer viajeros hacia trampas o precipicios". La Proa tiene
los precipicios. Quien sube de noche oye pasos detrás que no son suyos. Los vigías Nabieus bajan
antes del anochecer sin excepción.

**Teaser para el mapa:** "Desde aquí se ve la Meseta entera. Lo que oyes detrás no es tu eco."

**Retirado de la propuesta original:** "la luna del cinturón" (no hay luna), la roca volcánica (el
Margen no tiene volcanes), la Meseta al norte y orcos refugiándose aquí de tormentas de arena (las
tormentas son de las Llanuras).

**Preguntas abiertas resueltas:**
1. ¿Objeto especial para observar? → No. Basta con la altura. *(decidido por Claude)*

---

### A-18 · 2026-09-27 — El Puesto del Corredor
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "El Camino de Afilado", reconvertido)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `regiones/meseta-del-orden.md`
- [x] **Código** (2026-09-28): `Location` `puesto-del-corredor` en `worldCatalog.ts`, sembrada.

**Acción de implementación:** añadir
**Prioridad:** baja (Meseta no jugable)
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/areas.md` (§ La Meseta del Orden, nueva lista de puntos de interés)

**Notas del aprobador:** se documenta ya porque el corredor costero es canon y conviene fijar dónde termina.

---

**Propuesta:**

**Qué es.** El puesto de control en el extremo sur del corredor costero occidental, donde el camino
que bordea el Margen entra en la Meseta. Toda columna de la Concordia que va o vuelve del Cruce de
las Cenizas pasa por aquí. Las patrullas "llegan siempre en columna y por una sola puerta" (canon),
y esta es la otra puerta.

**Cómo es.** Una explanada de piedra gris pulida, con tres caminos que se cruzan en ángulos
exactos: el corredor costero, el que sube a El Baluarte y el que lleva a las forjas de la frontera
norte. Hay un obelisco menor con los edictos de paso. Los inspectores anotan cada carga, cada
nombre y cada hora. Un registro de entrada sin su salida es un asunto inacabado, y se persigue.

**Para qué sirve en juego (futuro).** Es el lugar donde un personaje sin sello de patrulla no puede
entrar en la Meseta sin mentir, sobornar o rodear por el Margen. El sello de patrulla de la
Concordia (ya en catálogo) sirve de salvoconducto.

**Retirado:** el vocabulario técnico ("certificación", "técnicos") y el nombre "Afilado".

**Preguntas abiertas resueltas:**
1. ¿Guardias permanentes? → Una escuadra de 12 y dos inspectores de la casta de ley. *(decidido por Claude, revisable)*

---

### A-19 · 2026-09-27 — Las Canteras del Eje
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "El Oficio de Talla", reconvertido)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `regiones/meseta-del-orden.md`
- [x] **Código** (2026-09-28): `Location` `canteras-del-eje` en `worldCatalog.ts`, sembrada.

**Acción de implementación:** añadir
**Prioridad:** baja (Meseta no jugable)
**Dependencias:** A-10
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/areas.md` (§ La Meseta del Orden, puntos de interés)

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Qué es.** La cantera y el taller de talla de donde sale **cada obelisco de leyes de Berig**.
Siempre de la misma veta, la del primer obelisco de El Baluarte (A-10). Un edicto grabado en otra
piedra no se considera del todo válido, y ningún Goirnte sabría explicar por qué: simplemente, no
está en su sitio.

**Cómo es.** Galerías paralelas excavadas siguiendo los ejes de la Meseta. Los bloques se cortan con
herramientas de aleación de Hierba del Hierro y se pulen con arena y agua en surcos tallados en el
suelo. Se trabaja en silencio y por turnos. Un obelisco a medio tallar nunca se abandona: si su
talladora muere, otra lo termina con la misma herramienta.

**Retirado de la propuesta original:** las galerías de "silicio" y "cristal fino" (el hielo sílice
es de Cristal Helado y el cristal es Kelife), las mesas "calibradas", la "certificación de
precisión" y los Faerus trayendo materiales.

**Preguntas abiertas resueltas:**
1. ¿Maestros permanentes? → Un linaje de talladores de la casta de construcción, unos 30 activos. *(decidido por Claude, revisable)*

---

## Categoría: Fauna y flora

### A-20 · 2026-09-27 — Musgo Callado
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Musgo Silencioso")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/margen-silencioso.md § Flora
- [x] **Código:** `ItemCatalog` `musgo-callado` + `HarvestYield` en las Location del Margen — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** media (da mecanismo físico a un rasgo central del Margen)
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (bloque nuevo "Flora — El Margen Silencioso")
- `docs/rpgtarkor/lore-mundo/genesis.md` (§ El dominio de Kroj, una línea de referencia en el párrafo del Margen)
- *(código: `ItemCatalog` `musgo-callado` + `HarvestYield` en las `Location` del Margen)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

- **Familia:** Muscarias (Florial), con la huella de Kroj. Es el mismo reparto de autoría que
  `genesis.md` describe para la flora nocturna: la planta es de Florial y el rasgo es de Kroj.
- **Qué es.** El musgo gris apagado, sin brillo, que cubre troncos, ramas y suelo en todo el Margen.
  Es una maraña de filamentos finísimos con bolsas de aire entre ellos. El sonido entra, rebota
  dentro de los filamentos y se disipa sin salir, como en un fieltro grueso, pero a escala de
  bosque. Junto con el aire denso, es la mitad física del "follaje que absorbe el sonido" del canon.
  **No sustituye al dominio de Kroj: es la forma en que se manifiesta en la flora.**
- **Aspecto:** cojines de 5-15 cm de grosor, gris ceniza. Al tacto parece pelusa seca aunque esté
  empapado.
- **Usos:** los Nabieus tapizan con él las cámaras del Refugio y del Archivo (A-02). Los Faerus
  forran sus refugios de caza para dormir sin ser oídos. Un orco lo usaría como relleno de un
  jergón.
- **Recurso:** *Musgo Callado*, tier 1, material de relleno y aislante. `metodoObtencion`:
  recolectar, sin herramienta. Valor: 1 Goirno.
- **Nombre:** en lengua común. Se retira "Silh-X" (`Silh` es Kektira).

**Preguntas abiertas resueltas:**
1. ¿Nombre Naebius? → No. Los Nabieus no lo nombran: para ellos es el suelo, no una planta. *(decidido por Claude, revisable)*

---

### A-21 · 2026-09-27 — Veldria Hueca
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Veldria del Eco", invertida para que encaje con el dominio de Kroj)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/margen-silencioso.md § Flora
- [x] **Código:** `ItemCatalog` madera y resina de Veldria Hueca + `HarvestYield` — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** media
**Dependencias:** A-11 (la técnica que la usa)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (Flora — El Margen Silencioso)
- *(código: 2 `ItemCatalog` + `HarvestYield`)*

**Notas del aprobador:** la propuesta original tenía un tronco que *amplificaba ecos*, lo contrario del Margen. Aquí se conserva la idea del tronco hueco, pero lo que conduce es la vibración del suelo, no el sonido del aire.

---

**Propuesta:**

- **Familia:** Veldrias (madera + resina).
- **Qué es.** Conífera de madera negra de 8-12 m, con un corazón hueco y seco que recorre el tronco
  de arriba abajo. Sus raíces se enlazan con las de las Veldrias vecinas. El aire del hueco no
  transmite nada (el Margen lo apaga), pero la **pared del tronco sí conduce la vibración** de toda
  la red de raíces. Un Nabieus que apoya la palma en ella (*Tovh'vhurne*, A-11) siente pasos a
  centenares de metros. Es la conocida "madera que escucha": no oye el aire, oye el suelo.
- **Aspecto:** corteza lisa gris con vetas negras. Las ramas bajas se doblan hasta el suelo y dejan
  claros debajo. La resina es oscura y huele a lluvia.
- **Recursos:**
  - *Madera de Veldria Hueca*, tier 3, ligera. Los Nabieus fabrican con ella tubos de escucha
    enterrados. Valor 4.
  - *Resina de Veldria*, tier 3, pegamento que no cruje al secar. Valor 5.
- **Cultura:** los Faerus no la talan (canon: artesanía mínima). Los Nabieus solo toman ramas
  caídas: talar una Veldria deja sordo un trozo de bosque.

**Preguntas abiertas resueltas:**
1. ¿Propiedades mágicas de la resonancia? → No. Es conducción de vibración por un sólido. *(decidido por Claude)*

---

### A-22 · 2026-09-27 — Flor de Víspera
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Flor Gris del Silencio")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/margen-silencioso.md § Flora
- [x] **Código:** `ItemCatalog` `petalos-vispera` + `HarvestYield` (comprobar si existe gate horario; si no, solo texto en `condicion`) — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (Flora — El Margen Silencioso)
- *(código: `ItemCatalog` + `HarvestYield`; verificar si existe un gate horario en `HarvestYield.condicion`: el estacional sí existe, el horario probablemente no)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

- **Familia:** Salviras (flora de alquimia y curación de campo), con la huella de Kroj (florece de
  noche).
- **Qué es.** Planta baja de 20-40 cm, con hojas estrechas de un gris plateado. Sus flores, pequeñas
  y de color gris perla, **solo se abren al atardecer** y se cierran ante un movimiento brusco. El
  aroma de la flor abierta es un sedante suave.
- **Diferencia con la Flor de Ceniza:** la Flor de Ceniza adormece el dolor. La Flor de Víspera no
  toca el dolor: calma y ayuda a dormir. Son dos ingredientes distintos.
- **Uso:** los Faerus mastican un pétalo antes de dormir en un refugio de caza en territorio
  hostil. En alquimia, es un ingrediente base de infusiones de descanso.
- **Recurso:** *Pétalos de Víspera*, tier 1, ingrediente de alquimia (`alquimista-orcos-llanuras`).
  Valor 1. Si existe el gate horario, solo se recolectan al atardecer; si no, lo indica la
  `condicion` en texto.
- **Retirado:** el nombre "Silh-Gris-Sael", los bonus inventados ("+20 Voz, -30 Miedo") y los orcos
  recolectándola en expediciones.

**Preguntas abiertas resueltas:**
1. ¿Receta de infusión? → Sí, una receta de alquimia tier 1-2 cuando se diseñe el siguiente lote de recetas. Fuera de esta tanda. *(decidido por Claude, revisable)*

---

### A-23 · 2026-09-27 — Cántaro de Hoja
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Cántaro de Hoja")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/margen-silencioso.md § Flora
- [x] **Código:** `ItemCatalog` agua y tallo de Cántaro + `HarvestYield` — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (Flora — El Margen Silencioso)
- *(código: `ItemCatalog` + `HarvestYield`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

- **Familia:** Zarcos (arbustos de leña sin resina). Sus tallos secos también sirven de leña.
- **Qué es.** Arbusto de 60-90 cm con un tallo central hueco de 4-8 cm de diámetro, cuyas paredes
  tienen un mucílago que retiene el agua de lluvia. Sus hojas anchas, de 15-25 cm, la encauzan
  hacia el tallo.
- **Por qué importa.** Las charcas del Margen son de agua estancada y negra. El Cántaro guarda
  **agua de lluvia limpia**. Es el equivalente de la Gradias de las Llanuras (que suelta el agua de
  sus hojas al triturarlas), pero almacenada en el tallo.
- **Recursos:**
  - *Agua de Cántaro*, consumible de sed, tier 1, valor 1.
  - *Tallo de Cántaro* seco: leña y tubo simple, tier 1, valor 1.
- **Retirado:** el nombre "Silh-Ud" y la mención a la Telda (no crece en el Margen).

**Preguntas abiertas resueltas:**
1. ¿Se regenera? → Sí, con la siguiente lluvia. En el motor, igual que cualquier `HarvestYield` de flora. *(decidido por Claude)*

---

### A-24 · 2026-09-27 — Carnosa de Tocón
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Trufa de la Niebla")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/margen-silencioso.md § Flora
- [x] **Código:** `ItemCatalog` `carnosa-de-tocon` + `HarvestYield`; receta de cocina opcional — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (Flora — El Margen Silencioso)
- *(código: `ItemCatalog` + `HarvestYield`; receta de cocina opcional)*

**Notas del aprobador:** se cambia el nombre original: "trufa" es un hongo real y en el Margen no hay niebla.

---

**Propuesta:**

- **Familia:** Fongares (setas).
- **Qué es.** Seta carnosa en forma de embudo que crece **sobre los tocones caídos** de las
  coníferas de madera negra. Mide 15-30 cm de diámetro, con el sombrero gris azulado por fuera y
  beige por dentro. Pesa hasta 1 kg.
- **Uso:** alimento. Cruda amarga; asada o en guiso, de sabor suave a tierra. Es la comida del
  Brozán (A-30), así que donde hay Brozanes hay Carnosa.
- **Recurso:** *Carnosa de Tocón*, tier 2, alimento (ingrediente de `cocinero-orco-llanuras` si se
  diseña receta). Valor 2.
- **Retirado:** el nombre "Silh-Kesh" y el tallo "que se despliega como una trompa".

**Preguntas abiertas resueltas:**
1. ¿Límite de recolección? → El normal de `HarvestYield`. *(decidido por Claude)*

---

### A-25 · 2026-09-27 — Bulbo de Turbera (Ciénaga Troncal)
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Bulbo del Eco", trasladado)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/cienaga-troncal.md § Flora
- [x] **Código:** `ItemCatalog` `bulbo-de-turbera` + `HarvestYield` — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (bloque nuevo "Flora — Ciénaga Troncal")
- *(código: `ItemCatalog` + `HarvestYield` en las `Location` de la Ciénaga)*

**Notas del aprobador:** se traslada a la Ciénaga, que apenas tiene flora documentada (solo los Trepadores Ocaso). Se cambia el nombre, porque en el Margen no hay eco.

---

**Propuesta:**

- **Familia:** Bulvias (raíces y tubérculos de agua).
- **Qué es.** Tubérculo elíptico de 15-30 cm, con piel parda y pulpa blanca y firme, que crece en el
  fango de turba de las zonas llanas de la Ciénaga.
- **Quién lo come:** es el alimento base de Keseg Prisilke y de los Goshg cuando falla la caza de
  Cornantes. Cocido, frito o seco al humo.
- **Recurso:** *Bulbo de Turbera*, tier 1, alimento. Valor 1.
- **Retirado:** "Silh-Tuba", los "guisos orcos" en el Margen y la Telda.

**Preguntas abiertas resueltas:**
1. ¿Consumible energético? → No. Es comida base. *(decidido por Claude)*

---

### A-26 · 2026-09-27 — Velo de Charca (Ciénaga Troncal)
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Alga de la Niebla", trasladada)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/cienaga-troncal.md § Flora
- [x] **Código:** `ItemCatalog` `velo-de-charca` + `HarvestYield` — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (Flora — Ciénaga Troncal)
- *(código: `ItemCatalog` + `HarvestYield`)*

**Notas del aprobador:** la propuesta original citaba como fauna del Margen a los Guchapos, los Lebudes y la Telda, que son del Pozo de Cauce Viejo.

---

**Propuesta:**

- **Familia:** Marelas (algas de costa o charca).
- **Qué es.** Láminas gelatinosas y translúcidas de 5-15 cm que cubren la superficie de las charcas
  quietas de la Ciénaga, entre los pilotes y bajo los Trepadores Ocaso.
- **Uso:** comestible en sopa. Aplicada fresca sobre una quemadura, **enfría y protege**. Es la
  cura de campo más habitual de los Goshg, que se queman a menudo con la resina de sus antorchas.
- **Recurso:** *Velo de Charca*, tier 1, alimento y medicinal (ingrediente de
  `primeros-auxilios-orcos-llanuras` o de un futuro oficio de la Ciénaga). Valor 1.

**Preguntas abiertas resueltas:**
1. ¿Medicinal o alimento? → Las dos cosas. *(decidido por Claude)*

---

### A-27 · 2026-09-27 — Herrumbrera (Ciénaga Troncal)
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Corteza Luminis", rehecha sin brillo)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/cienaga-troncal.md § Flora
- [x] **Código:** `ItemCatalog` `corteza-herrumbre` + `HarvestYield` + receta de fundición (10 → 1 `mena-hierro-llanuras` o una mena pobre nueva) — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** media (tiene una implicación económica real)
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (Flora — Ciénaga Troncal)
- `docs/rpgtarkor/lore-mundo/areas.md` (§ Clan Goshg: una línea sobre su poco metal)
- *(código: `ItemCatalog` + `HarvestYield`; receta de fundición opcional con `herrero-orco-llanuras`)*

**Notas del aprobador:** la propuesta original daba a la corteza un brillo que la bioacumulación no puede producir. Aquí se conserva lo que sí funciona: una Vetria que concentra mineral, como la Hierba del Hierro.

---

**Propuesta:**

- **Familia:** Vetrias (flora con mineral incrustado). Sería la segunda de Berig, tras la Hierba del
  Hierro.
- **Qué es.** Arbusto de 40-70 cm de tallos gruesos, con una corteza de color óxido, pesada y
  áspera. Crece en las orillas de agua estancada, donde el fango arrastra hierro disuelto. Sus
  raíces lo concentran en la corteza, que con el tiempo se vuelve una costra de herrumbre. Es el
  mismo principio que la Hierba del Hierro, pero con un mineral mucho más pobre. **No brilla**: no
  hay mecanismo para ello.
- **Por qué importa.** Explica que los Goshg tengan algo de metal pese a vivir en una región "pobre
  en minerales" (canon): hierro de pantano en cantidades mínimas. Da para puntas de lanza y clavos,
  no para una herrería de verdad.
- **Recurso:** *Corteza Herrumbre*, tier 2, valor 2. **10 unidades equivalen a 1 de mena de hierro
  pobre** en una receta de fundición (verificar el slug real de la mena de hierro del catálogo).
- **Retirado:** el nombre "Silh-Vet", el brillo, los altares Faerus y la "piedra viva".

**Preguntas abiertas resueltas:**
1. ¿Brillo natural o mágico? → Ninguno de los dos: no brilla. *(decidido por Claude)*

---

### A-28 · 2026-09-27 — Leshra, el ave que no suena
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Leshra")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/margen-silencioso.md § Fauna · flora-fauna.md (Umbrias) · `lenguas-helek.md`
- [x] **Código:** `fauna` `leshra` (UMBRIAS, habilidades raciales de la ficha) + `HarvestYield` de sus plumas — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** media (primera especie real de la familia Umbrias)
**Dependencias:** A-30 (su presa)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (§ Las 26 familias: Umbrias ya tiene especie; Fauna — El Margen Silencioso)
- `docs/rpgtarkor/lore-mundo/lenguas-helek.md` (Feg: `Leshra`, ver A-07)
- *(código: fauna `Npc` + `HarvestYield`)*

**Notas del aprobador:** ninguna.

---

**Propuesta:**

**Familia: Umbrias (Kroj).** Hoy la familia existe sin ninguna especie. Esta es la primera, y la
primera fauna de Berig atribuida a Kroj como creadora y no solo como huella.

- **Descripción:** ave nocturna de 50-70 cm de cuerpo y unos 120 cm de envergadura, con alas anchas
  y redondeadas. El borde de sus plumas está deshilachado y rompe el aire en remolinos diminutos
  que no hacen ruido. Su plumaje gris ceniza **atrapa la luz como la piel Nabieus**: a la vista es
  un hueco, no un color. Tiene los ojos muy grandes. No canta ni grazna.
- **Hábitat:** dosel medio y bajo del Margen Silencioso. **Medio:** AEREO. **Temperamento:**
  CAUTELOSO (solo ataca si alguien se acerca a su nido).
- **Dieta:** Brozanes (A-30) e insectos grandes del sotobosque.
- **Ficha técnica:** `slug: 'leshra'`, `articulo: 'la'`, `level: 2`, `levelMax: 5`,
  `attributes: { fuerza: 5, destreza: 13, constitucion: 5, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 }`,
  `faunaCategoria: 'UMBRIAS'`, `ataqueNatural`: "garras en picado desde atrás, sin aviso".
  `habilidadesRaciales`:
  - ataque, **Picado mudo**: cae sobre la presa desde el dosel sin que se oiga.
  - defensa, **Hueco en la noche**: su plumaje no devuelve la luz y cuesta fijar un golpe sobre
    ella en la oscuridad.
  - utilidad, **Vuelo sin rastro**: se aleja entre las ramas sin que se sepa hacia dónde.
- **Recurso:** *Plumas de Leshra*, tier 2, valor 3. Material de emplumado: los Faerus las usan en
  flechas que no silban (receta de flechería futura).
- **Retirado:** "formación de 3-5 aves" y "caza en solitario" a la vez (se contradice), las
  "membranas" y que sea presa del Vistue.

**Preguntas abiertas resueltas:**
1. ¿Nivel y atributos definitivos? → Los de arriba, calibrados contra la Celubia Pálida (2-4, que es agresiva). *(decidido por Claude, revisable)*

---

### A-29 · 2026-09-27 — Morvasa, la serpiente de las Aguas Sordas
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Vesh", renombrada)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/margen-silencioso.md § Fauna
- [x] **Código:** `fauna` `morvasa` (ESCAMADOS, control de 1 turno) + `HarvestYield` de veneno y piel — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** A-16 (su hábitat)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (Fauna — El Margen Silencioso)
- *(código: fauna `Npc` + `HarvestYield`)*

**Notas del aprobador:** se renombra "Vesh" porque se confundía con *Vash* ("sangre" en Feg).

---

**Propuesta:**

- **Familia:** Escamados (Florial).
- **Descripción:** serpiente de 180-220 cm, esbelta, de escamas verde pardo con vetas ceniza. No
  traga presas grandes: las paraliza con un veneno neurotóxico y las come por partes. Caza inmóvil
  bajo el agua; la única señal de que está ahí es una onda en la superficie.
- **Hábitat:** canales de Las Aguas Sordas (A-16). **Medio:** ACUATICO. **Temperamento:** CAUTELOSO.
- **Dieta:** Brozanes, crías de ave y anfibios.
- **Ficha técnica:** `slug: 'morvasa'`, `articulo: 'la'`, `level: 3`, `levelMax: 6`,
  `attributes: { fuerza: 8, destreza: 12, constitucion: 7, inteligencia: 3, voluntad: 6, carisma: 1, magia: 0 }`,
  `faunaCategoria: 'ESCAMADOS'`, `ataqueNatural`: "mordisco desde el agua, rápido y bajo".
  `habilidadesRaciales`:
  - ataque, **Mordida paralizante**: efecto de control de 1 turno (usa el CONTROL ya existente en
    el motor).
  - defensa, **Bajo la superficie**: se sumerge y es difícil de alcanzar.
  - utilidad, **Onda quieta**: espera sin moverse hasta que la presa entra en el agua.
- **Recursos:** *Veneno de Morvasa* (ingrediente de alquimia, tier 3, valor 6) y *Piel de Morvasa*
  (tier 2, valor 3).

**Preguntas abiertas resueltas:**
1. ¿Se mantiene "Vesh"? → No: pasa a Morvasa. *(decidido por Claude, revisable)*

---

### A-30 · 2026-09-27 — Brozán
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Murela", renombrada)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/margen-silencioso.md § Fauna
- [x] **Código:** `fauna` `brozan` (RONDINES) + `HarvestYield` — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** ninguna (sostiene la cadena de A-28 y A-29)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (Fauna — El Margen Silencioso)
- *(código: fauna `Npc` + `HarvestYield`)*

**Notas del aprobador:** se renombra "Murela" porque se parecía demasiado a *Marelas* (la familia de las algas).

---

**Propuesta:**

- **Familia:** Rondines (pequeños mamíferos omnívoros).
- **Descripción:** roedor de 35-45 cm, de cuerpo redondeado, con pelaje gris verdoso y vetas negras
  que imitan la corteza podrida. Orejas pequeñas, cola corta y garras delanteras de excavar. Nombre
  de *broza*: vive entre la hojarasca.
- **Hábitat:** suelo del Margen, entre raíces y tocones. **Medio:** TERRESTRE. **Temperamento:**
  INOFENSIVO (huye siempre).
- **Dieta:** Carnosa de Tocón (A-24), raíces y semillas.
- **Papel ecológico:** es la presa base del Margen. Se lo comen la Leshra desde el aire, la Morvasa
  en el agua y el Mekiosi si pasa demasiado cerca. Cierra el hueco de la "presa pequeña" que el
  Margen no tenía.
- **Ficha técnica:** `slug: 'brozan'`, `articulo: 'el'`, `level: 1`, `levelMax: 2`,
  `attributes: { fuerza: 3, destreza: 9, constitucion: 4, inteligencia: 3, voluntad: 4, carisma: 2, magia: 0 }`,
  `faunaCategoria: 'RONDINES'`, `capturablePct: 25`. Una sola habilidad racial: utilidad,
  **Huida a la madriguera**.
- **Recursos:** `racion-carne` ×1 (reutilizada) y *Piel de Brozán* (tier 1, valor 1).
- **Retirado:** que comiera Quio (el Quio vive en Los Manaderos y no es un insecto) y los "huevos de
  murciélago".

**Preguntas abiertas resueltas:**
1. ¿Nivel y atributos? → Los de arriba. *(decidido por Claude)*

---

### A-31 · 2026-09-27 — Hoscón, el carroñero que camina
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Ushra", completada y renombrada)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): regiones/margen-silencioso.md § Fauna
- [x] **Código:** `fauna` `hoscon` (CORVENES) + `HarvestYield` de plumón — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (Fauna — El Margen Silencioso)
- *(código: fauna `Npc` ambiental o con recurso mínimo)*

**Notas del aprobador:** la ficha original estaba cortada y situaba al ave en Los Manaderos. Se completa con un rasgo que la distingue del Zense Ceniza.

---

**Propuesta:**

- **Familia:** Corvenes (aves de presa o carroñeras).
- **Por qué es distinto.** El Zense Ceniza encuentra la carroña desde el aire, dando círculos sobre
  la llanura. En el Margen eso es imposible: el dosel cerrado no deja ver el suelo. El Hoscón ha
  resuelto el problema **caminando**: vuela poco y bajo, y recorre el suelo del bosque siguiendo el
  olor. Es un ave de patas fuertes y alas cortas.
- **Descripción:** 60-85 cm, plumaje gris pardo apagado, cuello pelado y pico ancho y plano para
  raspar hueso. Nombre de *hosco*: huraño, siempre de espaldas a quien lo mira.
- **Hábitat:** todo el Margen, sobre todo cerca de Las Aguas Sordas. **Medio:** TERRESTRE (vuela
  solo para subir a una rama). **Temperamento:** INOFENSIVO.
- **Uso para quien lo sabe leer:** donde camina un Hoscón hay algo muerto cerca. Los cazadores
  Faerus lo siguen igual que los orcos siguen al Zense.
- **Ficha técnica:** `slug: 'hoscon'`, `level: 1`, `levelMax: 2`,
  `attributes: { fuerza: 4, destreza: 6, constitucion: 6, inteligencia: 3, voluntad: 5, carisma: 1, magia: 0 }`,
  `faunaCategoria: 'CORVENES'`.
- **Recurso:** *Plumón de Hoscón*, tier 1, relleno. Valor 1.
- **Retirado:** las "membranas", la "visión ultravioleta" y el sufijo `-shra`.

**Preguntas abiertas resueltas:**
1. ¿Ambiental sin recurso o cazable? → Cazable con un recurso mínimo, para que exista como `Npc`. *(decidido por Claude, revisable)*

---

## Categoría: Items

*(Categoría añadida: la plantilla no la tenía, pero `propuestas-lore.md` sí.)*

### A-32 · 2026-09-27 — Colmillo de Ferike y Ashi'krul, la daga de colmillo
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Colmillo de Ferike" + "Daga de Colmillo de Faerus")*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `items.md` · regiones/llanuras-del-viento-rojo.md (Ferikes)
- [x] **Código:** `ItemCatalog` `colmillo-ferike` y `colmillo-ferike-hembra` + `HarvestYield` del Ferike — *hecho, verificado en código el 2026-09-28*
- [x] **Código:** `ItemCatalog` `ashi-krul` (en el `loadout` de Tasko, A-39) — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir (+ ampliar el despiece del Ferike)
**Prioridad:** media
**Dependencias:** A-05 (se talla en Kegi); A-39 (quien la vende)
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (§ El Cruce de las Cenizas — Ferikes: recurso nuevo)
- `docs/rpgtarkor/items-y-catalogo/items.md` (sección nueva "Artesanía Faerus — Kegi")
- *(código: 2 `ItemCatalog` + `HarvestYield` del Ferike + `loadout` de Tasko)*

**Notas del aprobador:** se descarta del todo la "daga de colmillo **de Faerus**": los Faerus son una raza sintiente y jugable.

---

**Propuesta:**

**Material: Colmillo de Ferike.** El canon dice que el Ferike tiene "dientes tan largos que no le
permiten cerrar la boca del todo" y que las hembras los tienen más fuertes. Falta en su despiece.
Colmillo de 20-35 cm, marfil con vetas pardas, duro pero quebradizo contra la piedra.
- `slug: 'colmillo-ferike'`, material, **tier 6**, valor **8**. La hembra da la variante de mayor
  calidad (`colmillo-ferike-hembra`, valor 12), con el mismo criterio que el Enganche de hueso de
  Cuernahoja.

**Arma: Ashi'krul, "el colmillo que huele".** Nombre Feg hecho con palabras que ya existen (*Ashi*
= oler, *Krul* = colmillo propio). Daga tallada en un colmillo de Ferike hembra, con la empuñadura
envuelta en piel de Ferike.
- **Por qué es Faerus:** el Ferike solo teme a los Faerus (canon), y la hembra es la cazadora y alfa
  de su manada. Llevar su colmillo dice que su portador cazó a quien caza.
- `slug: 'ashi-krul'`, `equipSlot: 'ARMA_SECUNDARIA'`, `tipoArma: 'DAGA'`, **tier 6**, valor
  **30**, `requisitos: { destreza: 13 }`, `statBonuses: { destreza: 4 }`,
  `lugarOrigen: 'Kegi, Feg Ger'`.
- **Cómo se consigue:** no se fabrica. En `construction.ts`/`crafting.ts` no hay ningún oficio que
  talle colmillo, y crear uno solo para esto no compensa. Se **compra a Tasko en Kegi** (A-39) con
  reputación alta con Feg Ger, o se obtiene como recompensa de una misión Faerus.

**Preguntas abiertas resueltas:**
1. ¿Qué oficio la fabrica? → Ninguno. Es artesanía Faerus y se compra o se gana. *(decidido por Claude, revisable)*
2. Valor corregido: la propuesta original decía 270 Goirnos. En el catálogo real un tier 6 ronda los 20 y un tier 7 llega a 60, así que 30 la sitúa como pieza rara de su tier.

---

### A-33 · 2026-09-27 — Desollador de sílice
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Cuchillo de Espina de Viento", reencaminado)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `items.md` · regiones/llanuras-del-viento-rojo.md (Desolladero)
- [x] **Código:** `ItemCatalog` `desollador-silice` (`herramientaParaOficio`) + ponerlo a la venta con el Maestro Desollador Serhu — *objeto hecho (2026-09-28); los Maestros no venden objetos, esa parte espera a que exista la mecánica*

**Acción de implementación:** añadir
**Prioridad:** media
**Dependencias:** A-09 (se vende en el Desolladero)
**Archivos destino:**
- `docs/rpgtarkor/items-y-catalogo/items.md` (§ Armamento y loot — Llanuras)
- *(código: `ItemCatalog` + `loadout`/`comerciable` del Maestro Desollador Serhu)*

**Notas del aprobador:** la propuesta original ponía a un herrero Serhu a tallar sílice, y eso lo hacen los Helsig.

---

**Propuesta:**

**Qué es.** Un cuchillo de desuello **hecho entre dos clanes**. La hoja, de hielo sílice con forma de
hoz corta, la tallan los Helsig: el canon ya dice que el sílice sirve "especialmente para
cuchillos de deshuello". Las cachas son de **Caparazón de Espina del Viento** y las pone el
Desolladero Serhu: la quitina no resbala con sangre en las manos. Es el único objeto del Karot Veku
que reconoce abiertamente que los Serhu necesitan a otro clan para algo.

- `slug: 'desollador-silice'`, `equipSlot: 'ARMA_SECUNDARIA'`, `tipoArma: 'CUCHILLO'`, **tier 3**,
  valor **20**, `requisitos: { destreza: 9 }`, `statBonuses: { destreza: 2 }`,
  `herramientaParaOficio: ['desollador', 'curtidor', 'peletero']`,
  `dimensiones: 'Hoja curva de 14 cm, empuñadura de 11 cm'`,
  `lugarOrigen: 'Hoja del Clan Helsig; montado en el Desolladero del Clan Serhu'`.
- **Cómo se consigue:** a la venta en el Desolladero (A-09). No tiene receta, porque ningún oficio
  del jugador talla sílice.
- **Diferencia con el cuchillo de hielo sílice de Gorhorn** (tier 1, herramienta de curtidor y
  desollador): este es la versión de oficio, más fina, y sirve también al peletero.

**Preguntas abiertas resueltas:**
1. ¿Bonificación mecánica al desuello? → No: solo habilita la herramienta. No hay sistema de "calidad de herramienta" y no se inventa aquí. *(decidido por Claude)*

---

### A-34 · 2026-09-27 — Ungüento de Espina
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Poción de Veneno Suave", reencaminada)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `items.md`
- [x] **Código:** `ItemCatalog` `unguento-espina` + receta de `alquimista-orcos-llanuras` en `crafting.ts` (comprobar el efecto de los medicinales t3) — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir (receta)
**Prioridad:** media (primer uso de crafteo del veneno de Espina, que hoy solo es loot)
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- *(código: `ItemCatalog` + receta en `crafting.ts`, oficio `alquimista-orcos-llanuras`)*

**Notas del aprobador:** el oficio "sanador-orco-llanuras" no existe; se usa el alquimista, que sí existe y tiene sus recetas.

---

**Propuesta:**

**Qué es.** El canon dice que el veneno de Espina del Viento, "si se extrae con cuidado, altera la
percepción del dolor, valioso para un sanador". Aquí se cumple esa promesa: diluido y ligado en
resina, el veneno deja de ser un peligro y se vuelve un **anestésico de campo**.

- **Receta (`alquimista-orcos-llanuras`):** 1 Aguijón con veneno de Espina del Viento
  (`veneno-espina`) + 2 Flor de Ceniza + 1 Resina Telda Gris → 2 Ungüentos de Espina.
- `slug: 'unguento-espina'`, consumible medicinal, **tier 3**, valor **12**, cuenco de cuerno con
  tapa de cera.
- **Efecto:** el mismo tipo de efecto que los consumibles medicinales de tier 3 ya existentes. Si el
  motor tiene penalización por estado de herida, la ignora durante un tiempo. Si no, cura como un
  medicinal de su tier. *(Verificar contra el efecto de los medicinales actuales al implementar.)*
- **Descripción:** pasta ámbar de olor amargo y picante. Adormece la piel en segundos. Mal
  dosificada, adormece también el juicio.
- **Retirado:** la "poción alcohólica" y la Leche de Múrgol como base (no liga un ungüento).

**Preguntas abiertas resueltas:**
1. ¿Qué oficio? → Alquimista. *(decidido por Claude)*

---

### A-35 · 2026-09-27 — Manto de Cornisa
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Escapulario Ceremonial de Celubia", reencaminado)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `items.md` · regiones/llanuras-del-viento-rojo.md (Acantilados)
- [x] **Código:** `ItemCatalog` `manto-cornisa` + receta de `sastre-orcos-llanuras` — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir (+ receta)
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `docs/rpgtarkor/lore-mundo/areas.md` (§ Los Acantilados Partidos: una línea sobre la costumbre)
- *(código: `ItemCatalog` + receta del oficio `sastre-orcos-llanuras`)*

**Notas del aprobador:** da uso a las Plumas de Celubia, que hoy no tienen ninguno.

---

**Propuesta:**

**La costumbre.** Trepar a las cornisas más altas de Los Acantilados Partidos y volver con plumas de
Celubia, que defiende el nido con saña, es la prueba de valor **de la costa**. No es sagrada como la
cacería ritual de Corredores: es cosa de jóvenes que quieren presumir. Quien vuelve se lo cose en un
manto.

- **Receta (`sastre-orcos-llanuras`):** 4 Plumas de Celubia + 2 Lana de Múrgol → 1 Manto de
  Cornisa.
- `slug: 'manto-cornisa'`, `equipSlot: 'COSMETICO_ESPALDA'`, sin bonificadores, **tier 2**,
  valor **6**.
- **Descripción:** manto corto de fieltro de lana de Múrgol, gris con restos de polvo rojo, con
  plumas blancas de Celubia cosidas en hilera sobre los hombros. En la punta, las plumas conservan
  un rastro de espuma seca que nunca termina de caerse.
- **Retirado:** la base de "lana de Corredor de Cauce" (el Corredor no tiene lana) y el tamaño de
  30 × 50 cm.

**Preguntas abiertas resueltas:**
1. ¿Nombre Kektira? → No. Es una costumbre de la costa sin rito, y se queda en lengua común. *(decidido por Claude)*

---

### A-36 · 2026-09-27 — Incisivos de Miruina
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Hueso de Miruina", reencaminado)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): `items.md` · regiones/llanuras-del-viento-rojo.md (Miruina)
- [x] **Código:** `ItemCatalog` `incisivos-miruina` (`herramientaParaOficio: curtidor, peletero`) + `HarvestYield` de la Miruina — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir (+ ampliar el despiece de la Miruina)
**Prioridad:** baja
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md` (§ Los Manaderos — Miruina: recurso nuevo)
- `docs/rpgtarkor/items-y-catalogo/items.md`
- *(código: `ItemCatalog` + `HarvestYield` de la Miruina)*

**Notas del aprobador:** se traslada a Los Manaderos, porque la Miruina no vive en el Margen. Hueso genérico ya hay (`hueso-ligero`); lo que sí es único de la Miruina son sus dientes.

---

**Propuesta:**

**Qué es.** El canon dice que la Miruina tiene "incisivos orientados en varias direcciones para
rasgar escamas de Jusha". Eso, fuera del animal, es un **rascador natural**: un peine de dientes que
arranca escamas y restos de carne de una piel sin cortarla.

- `slug: 'incisivos-miruina'`, material y herramienta, **tier 2**, valor **3**.
- `herramientaParaOficio: ['curtidor', 'peletero']`: sirve para limpiar pieles antes de curtirlas.
  Es la primera herramienta del catálogo que sale directamente de un animal sin fabricarse.
- **Obtención:** despiece de la Miruina, 1 por pieza, junto a la Piel de Miruina.

**Preguntas abiertas resueltas:**
1. ¿Por qué no "hueso"? → El hueso de Miruina no aportaba nada que no dé ya `hueso-ligero`. *(decidido por Claude)*

---

## Categoría: Personajes y NPCs

### A-37 · 2026-09-27 — Primer Censor Tarsen Vold
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: necesidad de A-01, sin propuesta de OpenCode)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): npcs.md (nº 16) · `historia.md` · `regiones/meseta-del-orden.md`
- [x] **Código:** `Npc` `tarsen-vold` (ficha técnica en la propuesta) + cambiar el líder de la Concordia (ver A-01) — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** media (A-01 depende de él)
**Dependencias:** ninguna
**Archivos destino:**
- `docs/rpgtarkor/personajes/npcs.md`
- `docs/rpgtarkor/lore-mundo/historia.md` (§ Las Alianzas: nombrar al líder radical)
- *(código: `Npc` en `worldCatalog.ts`; `FACTION_LEADER_SLUG['concordia-de-hierro'] = 'tarsen-vold'` en `seed-catalog.ts`)*

**Notas del aprobador:** no resuelve nada de lo reservado sobre el sello ni sobre la isla. Solo pone cara a quien dirige.

---

**Propuesta:**

**Quién es.** El líder de la facción radical y, por tanto, de la Concordia de Hierro. No es un
general, eso es Vrask Ombra: es un **censor**, de la casta de ley igual que Yovenne Tal. Esa es la
tragedia política de la Meseta: las dos cabezas del orden salieron de la misma casta y leyeron las
mismas leyes. Donde Yovenne lee "el edicto obliga también al que lo grabó", Tarsen lee "el orden
que no se defiende no es orden".

- **Aspecto:** Goirnte alto y enjuto, con la piel gris casi azulada por los años de archivo y la
  cabeza afeitada. Los ojos obsidiana no se apartan nunca de quien le habla. Viste la toga gris de
  la casta de ley, sin una sola insignia: presume de no necesitarlas.
- **Voz:** habla en frases completas, sin prisa, y termina siempre lo que empieza. Nunca levanta la
  voz. No le hace falta.
- **Lo que sabe:** pertenece a los "círculos radicales" que conocen la verdad completa del
  Detonante (canon). Qué sabe exactamente queda **reservado**, igual que hoy.
- **Relación con los demás:** Vrask Ombra le obedece sin creerle. A Yovenne la respeta como rival
  legítima: nunca la ha amenazado, porque eso sería desorden. Kael Dorn es el cabo suelto que más
  le preocupa.

**Ficha técnica (`Npc`):** `slug: 'tarsen-vold'`, `name: 'Tarsen Vold'`, `kind: 'PRINCIPAL'`,
`nucleoJugable: false`, `faction: 'Concordia de Hierro'`, `genero: 'M'`, `articulo: 'el'`,
`role: 'Primer Censor de la Concordia de Hierro, líder de la facción radical'`, `level: 7`,
`attributes: { fuerza: 9, destreza: 9, constitucion: 11, inteligencia: 16, voluntad: 15, carisma: 12, magia: 3 }`,
`raza: 'goirntes'`, `clase: 'CABALLERO'`, `especializacion: 'CABALLERO_DEL_ORDEN'`,
`temperamento: 'CAUTELOSO'`, `comerciablePct: 0`, `reclutablePct: 0`, `cortejablePct: 0`,
`atributoResistencia: 'voluntad'`, `personality`: "Frío, paciente, convencido. No odia a nadie:
ordena.", `loadout`: sello de la Concordia, correspondencia sellada.

**Preguntas abiertas resueltas:**
1. ¿Nombre? → Tarsen Vold, en la línea de Vrask Ombra, Yovenne Tal y Kael Dorn. *(decidido por Claude, revisable)*

---

### A-38 · 2026-09-27 — Cinco Faerus de Hashma
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "NPCs Faerus del Margen Silencioso", 13 plantillas reducidas a 5 con ficha completa)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): npcs.md (nº 17-21) · regiones/margen-silencioso.md (Jakut Tusha)
- [x] **Código:** 5 `Npc` (Hulki **nivel 18**, Tira, Kiri, Lusa, Gero) con `homeLocationSlug: campamento-feg-tusha-interior` + `ZonePoint` — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** media (el interior `campamento-feg-tusha-interior` existe y está vacío)
**Dependencias:** A-04, A-06
**Archivos destino:**
- `docs/rpgtarkor/personajes/npcs.md` (sección nueva "Faerus de Hashma")
- *(código: 5 `Npc` en `worldCatalog.ts` con `homeLocationSlug: 'campamento-feg-tusha-interior'` + `ZonePoint`)*

**Notas del aprobador:** de los trece originales se descartan "Hulki = herrero" (los Faerus no trabajan el metal), la Caballero y la ARTESANO (clases imposibles), la piel Ilvenar de Nura Ashi y a Gistera Koh como "Faerus exiliada". Nombres cortos al estilo de Riko, sin repetir *Vash* en cada uno.

---

**Propuesta:**

**Cómo es un Faerus (para todas las fichas).** Piel de hojas finas que susurra al moverse cuando
quieren que se les oiga. En Hashma, pelaje denso en tonos de corteza y musgo. Olfato que lee el
ánimo. No llevan túnica ni sandalias: como mucho, correas de piel para cargar. Inteligencia fría
bajo una apariencia bestial.

| Nombre | Papel | Nivel | Clase / especialización | Temperamento |
|---|---|---|---|---|
| **Hulki** (F) | La que más a menudo está en el Jakut Tusha | 18 | DRUIDA / AULLADOR | CAUTELOSO |
| **Tira** (F) | Cazadora mayor: reparte la primera pieza | 6 | CAZADOR / INSTINTIVO | CAUTELOSO |
| **Kiri** (M) | Vigía del dosel | 5 | DRUIDA / CAMBIAFORMAS | CAUTELOSO |
| **Lusa** (F) | Cuida a los *Feg'nur*, los heridos que no se abandonan | 4 | DRUIDA / ADAPTADO | AMIGABLE |
| **Gero** (M) | Joven corredor entre Hashma y Kegi | 3 | CAZADOR / SUPERVIVENCIA | AMIGABLE |

**Hulki.** Vieja, con el pelaje encanecido en el hocico, delgada pero con los hombros de quien ha
cargado presas toda la vida. Se sienta en el Jakut más que nadie porque casi nadie le disputa el
sitio: huele el miedo ajeno antes de que el otro sepa que lo tiene. Es quien decide si un forastero
pasa del primer árbol. Es el `liderNpcId` de Feg Tusha.
`level: 18`, `attributes: { fuerza: 12, destreza: 15, constitucion: 12, inteligencia: 20, voluntad: 22, carisma: 10, magia: 8 }` *(nivel recalibrado de 8 a 18 al contrastar con los líderes de clan reales, de nivel 20-24)*,
`reclutablePct: 0`, `cortejablePct: 0`, `atributoResistencia: 'voluntad'`.
*Personalidad:* paciente, seca, imposible de engañar.

**Tira.** Cicatrices de garra de Ferike en un antebrazo. Es quien corta y reparte la *Vash'grath*
en cada caza, y por tanto quien sabe quién es de la manada y quién no. Si un forastero come de su
mano, algo ha cambiado.
`attributes: { fuerza: 13, destreza: 15, constitucion: 11, inteligencia: 11, voluntad: 10, carisma: 6, magia: 3 }`,
`reclutablePct: 10`, `atributoResistencia: 'voluntad'`.
*Personalidad:* directa, justa hasta la dureza.

**Kiri.** Joven, delgado y de brazos largos. Pasa las noches en el dosel en forma de Hetris (su
forma de Cambiaformas es fauna real del Margen). Es el primero que ve llegar a una patrulla y el
último en bajar.
`attributes: { fuerza: 10, destreza: 16, constitucion: 9, inteligencia: 10, voluntad: 9, carisma: 4, magia: 5 }`,
`reclutablePct: 15`.
*Personalidad:* callado, nervioso en el suelo y tranquilo en las ramas.

**Lusa.** Mayor, de movimientos lentos. Cuida en una plataforma aparte a los heridos de la manada,
con Musgo Callado para que duerman y Flor de Víspera para calmarlos. Es lo más parecido a una
sanadora que tienen los Faerus, pero no enseña ningún oficio del motor: el oficio de curación
Faerus está por diseñar.
`attributes: { fuerza: 7, destreza: 10, constitucion: 10, inteligencia: 13, voluntad: 14, carisma: 9, magia: 6 }`,
`reclutablePct: 0`, `cortejablePct: 0`.
*Personalidad:* cálida con los suyos y fría con los demás, hasta que un forastero herido le cambia
el juicio.

**Gero.** Joven de pelaje menos denso que el resto: tiene madre de Kegi. Lleva y trae noticias entre
las dos manadas. Es el Faerus más fácil de encontrar fuera del Margen y el único de Hashma que ha
hablado alguna vez con un orco.
`attributes: { fuerza: 10, destreza: 14, constitucion: 10, inteligencia: 9, voluntad: 8, carisma: 7, magia: 3 }`,
`reclutablePct: 25`, `cortejablePct: 10`, `atributoResistencia: 'carisma'`.
*Personalidad:* curioso, impulsivo y hablador para ser Faerus.

**Comunes a los cinco:** `raza: 'faerus'`, `faction: 'Feg Tusha'`, `kind: 'PRINCIPAL'`,
`nucleoJugable: false` (el Margen está fuera del núcleo), `capturablePct: 0` (raza sintiente),
`comerciablePct: 0` (en Hashma no se comercia).

**Preguntas abiertas resueltas:**
1. ¿Cuántos? → Cinco, uno por papel real de la manada. Las trece plantillas originales repetían papeles. *(decidido por Claude, revisable)*
2. ¿Pueden ser Maestros de algún oficio? → No de momento. Si se diseña un oficio Faerus, Lusa y Tira son las candidatas. *(decidido por Claude, revisable)*

---

### A-39 · 2026-09-27 — Dos Faerus de Kegi
**Estado: APROBADA (Álvaro, 2026-09-27 — versión final redactada por Claude)** *(origen: "Vashi Ger", "Ger Sil" y "Sil Kegi" de la propuesta de NPCs, rehechos)*

**Seguimiento:**
- [x] **En docs** (2026-09-27): npcs.md (nº 22-23) · regiones/llanuras-del-viento-rojo.md (Kegi)
- [x] **Código:** 2 `Npc` (Yeru **nivel 18**, Tasko con `loadout` de Ashi'krul) en `jakut-ger-interior` / `yegr-kegi` + `ZonePoint` — *hecho, verificado en código el 2026-09-28*

**Acción de implementación:** añadir
**Prioridad:** media
**Dependencias:** A-05, A-06, A-32
**Archivos destino:**
- `docs/rpgtarkor/personajes/npcs.md` (sección "Faerus de Kegi")
- `docs/rpgtarkor/personajes/personajes.md` (§ Gorhorn: una línea en "el año con los Faerus")
- *(código: 2 `Npc`; `Location`/`ZonePoint` de Kegi cuando se siembre)*

**Notas del aprobador:** Yeru le pone cara al año de Gorhorn con los Faerus sin cambiar nada de su biografía.

---

**Propuesta:**

**Aspecto común:** pelaje corto, rojizo con matices verdes, más fino que el de Hashma. Piel de
hojas que susurra.

**Yeru** (F), quien más a menudo está en el Jakut Ger. Madura, fuerte y de hombros anchos para ser
Faerus. Una muesca en la oreja izquierda. **Conoció a Gorhorn** durante el año que pasó con la
manada: lo recuerda como "el orco que olía a pena y no a miedo". Nunca compartió con él la primera
pieza, y aún no sabe si fue un error. Es el `liderNpcId` de Feg Ger.
`level: 18`, `clase: 'DRUIDA'`, `especializacion: 'SALVAJE'`,
`attributes: { fuerza: 19, destreza: 18, constitucion: 16, inteligencia: 17, voluntad: 16, carisma: 12, magia: 5 }`
*(nivel recalibrado de 8 a 18 al contrastar con los líderes de clan reales, de nivel 20-24)*,
`temperamento: 'CAUTELOSO'`, `reclutablePct: 0`, `atributoResistencia: 'voluntad'`.
*Personalidad:* reservada y leal. Pone a prueba antes de confiar.
*Gancho:* si Gorhorn vuelve a Kegi, Yeru puede ofrecerle la *Vash'grath*. Sería el primer orco en
recibirla desde los Maktor, y renovaría el Pacto (A-12). Es una misión posible, no un hecho
canonizado.

**Tasko** (M), curtidor y tallador. Joven para su oficio, con las manos manchadas de tanino. Talla
las Ashi'krul (A-32) y lleva el comercio en El Vergel de Kegi. Es el único Faerus que regatea, y lo
hace fatal.
`level: 5`, `clase: 'GUERRERO'`, `especializacion: 'ESPECIALISTA'`,
`attributes: { fuerza: 11, destreza: 14, constitucion: 10, inteligencia: 12, voluntad: 9, carisma: 10, magia: 2 }`,
`temperamento: 'AMIGABLE'`, `comerciablePct: 60`, `reclutablePct: 15`,
`atributoResistencia: 'carisma'`, `loadout`: 1 `ashi-krul`, 3 `colmillo-ferike`, pieles curtidas.
*Personalidad:* entusiasta, charlatán y nada diplomático.

**Comunes:** `raza: 'faerus'`, `faction: 'Feg Ger'`, `kind: 'PRINCIPAL'`, `capturablePct: 0`.

**Preguntas abiertas resueltas:**
1. ¿Se canoniza que Yeru conoció a Gorhorn? → Sí: el canon ya dice que pasó un año con los Faerus de las llanuras, y Kegi es su único poblado. No cambia nada más de su historia. *(decidido por Claude, revisable)*

---

## Categoría: Otros

### No incluido en esta tanda, y por qué

| Propuesta original | Motivo |
|---|---|
| La Caída de Nemuey | El destino de las Semillas Perdidas está ligado al "poder que Madre ocultaba" y a la Entidad Desconocida, que se dejaron sin resolver a propósito. `genesis.md` ya cuenta todo lo que la propuesta aportaba sin resolverlo, así que queda **reservada**. |
| Seshra | Se solapaba con el Hetris y el Margen ya tiene tres depredadores más el Ferike. Otro acechante lo satura. |
| Facciones Goshg-tugh / Helsig-tugh | Ya existen como `Faction` reales con líderes. |
| El Regreso de Tarkor, El Abandono del Taller, El Primer Registro de Discrepancia, La Primera Grieta de Goirme | Resuelven contenido reservado o repiten `genesis.md`. |
| Ur'gathek de los Veku'karot, Veku'karot de los Maktor Restantes, El Gran Fracaso, Tregua de las Llanuras, El Desplazamiento del Norte, El Decreto del Vacío, La Tablilla de los Susurros, El Pacto de la Huella Silenciosa, La Primera Frontera, La Diquesía | Anacronismos (orcos en el 1.200, Gorhorn adulto antes de nacer), inversiones del canon (la Purga con batalla, Mordek convertido en Ketg) o fugas a Vaelira (Jusaly en la Ciénaga). |
| Sector de Calibrado, Caverna del Silicio, Pozo de Almacenaje, Torre de Vértice, Almacén de Hierro, Observatorio de la Simetría | La misma plantilla repetida, con tono tecnológico. |
| Las Ruinas del Reino Sepultado | Duplica Las Dunas Ahogadas y La Ciudad Hundida (reservada). |
| Los 41 items descartados | Abuso del Corredor de Cauce, atributos y ranuras inventados, "arcabuz" y objetos con partes de Faerus. Lo aprovechable ya está en A-32 a A-36. |
| Cantera y Bodega del Clan Serhu | No hay oficio que las ocupe. |

### Fallos transversales de la ronda (lista de comprobación)

Rescatados de la revisión del 2026-09-27, que ya no existe. Sirven de lista de comprobación para
el comando `REVISA` de OpenCode y para evaluar cualquier ronda futura.

1. **Abuso del Corredor de Cauce**: 46 menciones en 22 propuestas, con "lana" (no tiene), "quitina"
   (tiene placas óseas), forraje en el Margen (no vive allí) y hueso para arcos y mazas. Es presa
   sagrada, no materia prima. Moratoria: nada nuevo de Corredor.
2. **Falsos positivos de "inventado"**: marcaba como inventado material canon (Hiyerro, Múrgol,
   Towrgu, Los Manaderos, Telda Atardecer, Kegi, Hashma, incluso Gorhorn) porque no tenía cargado el
   fichero donde está.
3. **Fugas a Vaelira**: Amonir Thess, el musgo bioluminiscente del Susurro de las Raíces, la Hebra
   Dorada, la Costa del Azabache, Ilvenar y Jusaly en Berig. La Niebla del Estrecho no se cruza.
4. **Geografía de Berig mal orientada**: Berig va en tres franjas. Norte, Cristal Helado; centro, las
   Llanuras (oeste) y la Ciénaga (este) lado a lado; debajo, el Margen; sur, la Meseta. Los Manaderos está en las Llanuras, no en el Margen.
5. **Resolver contenido reservado**: qué encontró Tarkor, su regreso, los seres de El Giro, las
   ruinas enterradas del Reino Nabierus, el destino de las Perdidas.
6. **Fechas imposibles**: años en la era mítica (va sin fechar), orcos antes del 2.000, Gorhorn
   adulto antes del 4.010, eventos posteriores al arranque de la partida.
7. **Mecánicas que no existen**: atributos (Agilidad, Resistencia), oficios (sanador, curandero),
   clases fuera del enum o de otra raza, ranuras inventadas, e incumplimiento de la regla de peso
   de armadura (LIGERO da Magia + Inteligencia, MEDIO da Destreza + Voluntad, PESADO da Fuerza +
   Constitución). Precios 10-15 veces por encima de la escala real.
8. **Tono**: vocabulario tecnológico, "arcabuz" (no hay pólvora), "luna" (no hay luna), "sangre
   humana" (no hay humanos), Faerus con túnica y sandalias, objetos hechos con partes de Faerus.
9. **Muletillas**: "tela/hilo de hueso", "los Faerus la recogen con respeto" en cada ficha, el
   sufijo `-shra` en serie, `Silh` (Kektira, "musgo") usado como si fuera Feg, medidas imposibles y
   restos del chat pegados dentro de la propuesta.

### Incoherencias del canon actual (ajenas a las propuestas)

- Nombres de las tormentas: `lenguas-helek.md` frente a `clima-tormentas.md` y el código. Lo
  resuelve A-08.
- `seed-catalog.ts` pone a Yovenne Tal como líder de la Concordia, cuando `historia.md` la sitúa
  en la oposición moderada. Lo resuelven A-01 y A-37.
- `areas.md` describe 7 talleres en Karot Veku y el catálogo solo tiene 3. Lo resuelve A-09.
| Manto de Sombra, Red de Telaraña, Espiga del Eco, El Nombre del Susurro, Nymar, Yeshra, Pashra, Terkash duplicado | Forraje para fauna que no vive allí, nombres de seres reales, "sangre humana" y duplicados. |

**Nota para la fase 2 (formato nuevo de los `.md` de lore).** Casi todos los descartes vienen de
que el agente no tenía cargados `flora-fauna.md`, `items.md`, `lenguas-helek.md` ni `areas.md`.
Tres reglas de esta tanda deberían pasar al contexto fijo de OpenCode: la moratoria del Corredor de
Cauce, "`Silh` es Kektira y `Sil` es fuego en Feg", y la escala de valores en Goirnos por tier.

## Añadido en las pasadas de conexión (2026-09-27, sin ficha propia)

Contenido que Claude añadió directamente a los `.md` maestros al conectar el lore, a petición de Álvaro.
Ya está en docs; falta el código. Detalle en cada fichero regional y en
`docs/registros/ampliar-lore-checklist.md`.

### P-01 — Fauna nueva
- [x] **En docs:** Hielaga, Nievón y Escarchín (`regiones/cristal-helado.md`); Tragalodo, Borbol y Zancapilote (`regiones/cienaga-troncal.md`); Vreskal, el primer ORDENADOS (`regiones/meseta-del-orden.md`)
- [x] **Código** (2026-09-28): 7 `fauna` + sus `HarvestYield`, ya en `worldCatalog.ts`

### P-02 — Fauna antigua del lore que nunca llegó al catálogo
- [x] **En docs:** ya tienen familia y nivel: Sombras de Kroj (UMBRIAS 3-8), Hetris (ACECHANTES 4-9), Mekiosi (ACECHANTES 7-13), Vistue (GUELISES 3-7) y Cornantes (BESTIONES 3-8)
- [x] **Código** (2026-09-28): 5 `fauna` + `HarvestYield`, ya en `worldCatalog.ts`

### P-03 — Flora nueva
- [x] **En docs:** Liquen Escarcha (Cristal Helado) y Bolco (Ciénaga)
- [x] **Código** (2026-09-28): `ItemCatalog` `liquen-escarcha` y `resina-bolco` + `HarvestYield`, ya en `worldCatalog.ts`

### P-04 — NPC Nabieus
- [x] **En docs:** Aven Tessk (portavoz de Keseg Sael) e Ilka Dren (Keseg Prisilke), `npcs.md` nº 24-25
- [x] **Código** (2026-09-28): 2 `Npc` (`aven-tessk`, `ilka-dren`), ya en `worldCatalog.ts`, líderes de A-02 y A-03

### P-05 — Lugares descritos que solo tenían nombre
- [x] **En docs:** los 8 lugares de la Ciénaga (`tuneles-musgosos`, `raices-madre-fango`, `cumbre-bruma-negra`, `cataratas-madre-fango`, `costa-marea-vida`, `costa-corredor`, `embarcadero-goshg`, `desfiladero-esmeralda`)
- [x] **Código** (2026-09-28): las 8 `description` rellenadas en `worldCatalog.ts`

### P-06 — Talleres del Cerco de los Pilotes (Goshg)
- [x] **En docs:** astillero de pilotes, resinería, ahumadero y talla de tótems (`regiones/cienaga-troncal.md`)
- [ ] **Código:** `factionBuildings` en `campamento-goshg-interior` + `ZonePoint`
- [ ] **Diseño pendiente:** los Maestros Goshg (ninguno existe todavía)

### P-07 — Ciudades numeradas de la Meseta
- [x] **En docs:** Vresk Hes, Vresk Tuh y Vresk Kei (`regiones/meseta-del-orden.md`, `lenguas-helek.md`)
- [x] **Código** (2026-09-28): 3 `Location` (`vresk-hes`, `vresk-tuh`, `vresk-kei`) en `worldCatalog.ts`

### P-08 — Cronología de conexión
- [x] **En docs:** ciudades numeradas (0-1.000), los mil años salvajes (~1.000-2.000), El Borde (~2.100-2.800), la Senda del Sílice (~3.000-3.500), la corriente radical (~3.650-3.700), El Claro de la Manada arrasado (~4.006-4.008)
- [ ] **Código (opcional):** `historiaEntries` para las que tengan documento; `loreChunks.ts` + `npm run reindex-lore` con los hilos nuevos (Senda del Sílice, El Borde, la tala del borde, el tributo por mar)

### P-10 — Edificios de oficio (X4 + Bellwright + D&D)
- [x] **En docs:** `rpgtarkor/sistemas-reino/edificios-de-oficio.md` (diseño completo: 14 edificios, 3 niveles, plazas, reglas de sitio, qué siembra cada facción)
- [x] **Validado con Álvaro** (2026-09-28): producción agregada de las facciones en `KingdomStats` (§ 4 del documento) — confirmado el agregado simple, implementado.
- [x] **Código** (2026-09-28): la lista del § 7 del documento completa — 14 `ConstructionRecipe` de nivel 1 + 28 mejoras (`construction.ts`), `oficioProducido`/`condicionRegion` nuevos, `computeBuildBlockedReason` con condición de región/Jaula/nivel mínimo de Ayuntamiento, gate `NIVEL_EDIFICIO_INSUFICIENTE` (`kingdomProduction.ts`), plazas de trabajador 1/2/4 (`companeros.ts`), servicio de Casa de curas, Cocina → `KingdomStats.comida` real, `tickFactionProduction` agregado (`kingdomTick.ts`), 4 `CraftingRecipe` de extracción sin ingredientes, 21 edificios de facción sembrados (Serhu completo salvo Obrador de piedra, Helsig completo salvo Casa de curas — ambos aplazados por falta de Maestro real). Verificado con `tsc -b`, seed-catalog y tests de integración contra Postgres real.

### P-09 — Geografía real
- [x] **En docs:** tres franjas y tabla de rutas (`areas.md` § Cómo encajan en el mapa)
- [ ] **Revisar:** la incoherencia antigua entre el mapa de Azgaar (Karot Veku a ~110 km del Cruce) y el grafo del juego (18-25 km). No se ha tocado
