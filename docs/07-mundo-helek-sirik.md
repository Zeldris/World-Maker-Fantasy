# Helek Sirik — "Origen Azul"

**Estado:** Biblia del mundo v4 — dividida en varios archivos (ver índice abajo) para que cada tema sea más manejable a medida que crece.
**Fecha:** 2026-07-17.
**Rol de este documento:** este es el **índice** del **primer mundo semilla real** de Tarkor (decisión de producto 5, [02-decisiones.md](02-decisiones.md)), y sustituye por completo al mundo placeholder **"Valdreth"** que se usó solo para la demo de frontend (Concilio de Plata, Clanes de Skarn, etc. — ninguno de esos nombres pertenece a Helek Sirik y hay que retirarlos del código).

El contenido completo del mundo vive repartido en `docs/rpgtarkor/` — este archivo es el punto de entrada: aquí están el contrato de mundo (lo que necesita el motor de juego) y el seguimiento de pendientes técnicos. El contenido narrativo puro (mitología, geografía, historia, razas, personajes, NPCs) mezcla texto redactado por la autora (guardado tal cual) con ampliaciones de Claude claramente marcadas como tales — todo pensado para revisar y ajustar, no como cierre definitivo.

> **Nota de naming, confirmada intencionada por la autora:** la Semilla caída se llama **Tarkor** — el mismo nombre que el proyecto/app. Es un guiño deliberado, no un error. Tenerlo en cuenta al escribir prompts o documentación técnica para no generar ambigüedad entre "Tarkor la app" y "Tarkor la Semilla".

---

## Índice del mundo

| Archivo | Contenido |
|---|---|
| [rpgtarkor/genesis.md](rpgtarkor/genesis.md) | Era 0 (Madre, las 13 Semillas, la Entidad Desconocida, el arco de Tarkor) y Era 1 (La Formación, El Estallido). |
| [rpgtarkor/areas.md](rpgtarkor/areas.md) | Geografía global, idiomas, los continentes Vaelira y Berig con sus regiones/flora/fauna, y los clanes orcos. |
| [rpgtarkor/historia.md](rpgtarkor/historia.md) | Era 3 (Los Ciclos) y Era 4 (El Presente: Paz Templada, el Detonante, las Alianzas, El Giro) — el momento en el que arranca cualquier partida. |
| [rpgtarkor/razas.md](rpgtarkor/razas.md) | Tabla resumen de las 8 razas jugables. |
| [rpgtarkor/personajes.md](rpgtarkor/personajes.md) | Los 8 personajes pregenerados, atributos jugables, conceptos de Magia/Poder de Semilla, y ganchos de aventura para las partidas de Gorhorn. |
| [rpgtarkor/npcs.md](rpgtarkor/npcs.md) | Los 10 NPCs de apoyo. |

---

## Contrato de mundo (cerrado el 2026-07-17, magia ampliada el 2026-07-17)

Estos son los valores confirmados que necesita el `World` de la base de datos y el prompt del Narrador:

| Campo | Valor |
|---|---|
| **Tono** | Épico y trágico: pueblos que se creen en lo correcto libran una guerra sobre una verdad que nadie tiene completa, en un mundo tan pequeño que cada muerte deja cicatriz. |
| **Letalidad** | Media — con una población máxima de ~6.000 habitantes, la muerte de un personaje con nombre debe seguir siendo un hecho raro y con peso, no algo casual por una mala tirada. |
| **Magia (`arcano/elementos/oscura/purificadora/naturaleza/dominio`)** | Siempre conlleva un pequeño riesgo, incluso en éxito — el Narrador puede añadir un coste o efecto secundario narrativo aunque la tirada salga bien (algo se resiente, atrae atención, deja un rastro), reflejando que es un poder que nadie diseñó ni controló nunca del todo. No es una mecánica nueva de dados — se resuelve en la narración del resultado, no cambia la fórmula de tirada. **Importante (ver pendientes abajo):** de estas 6 escuelas, solo `arcano` está implementado en el motor de dados/clasificación hoy — las otras 5 son diseño futuro, todavía no funcional. |
| **Tecnología** | Medieval-fantástico. Sin pólvora ni armas de fuego en ningún continente. Berig (Goirntes) tiene metalurgia/minería algo más avanzada (Hierba del Hierro, Meseta del Orden), pero sigue siendo pre-industrial. |

---

## Revisión y pendientes técnicos (Claude, actualizado 2026-07-17)

### Lo más destacable de esta versión
- **La Isla Cambiante** sustituye a la vieja "herida que sangra magia" con algo mucho más visual y misterioso — nadie que ve a sus habitantes sobrevive para describirlos.
- El giro de los **seres elementales tipo colmena** ("purgar", parte del "plan" de Madre) sube las apuestas del presente y añade ambigüedad moral real a Madre — ya no es solo una figura temerosa, puede estar orquestando algo mucho más oscuro. Buen contraste con el arco de Tarkor, reservado para más adelante.
- Las secciones de **flora y fauna** por continente dan al Narrador contenido real para acciones de observar/explorar/recolectar — sirve directamente al enfoque "no solo combate" ya decidido en las mecánicas.
- El guiño **Tarkor = nombre del proyecto** y el desarrollo extra de **Gorhorn** (personaje de test de la autora) están confirmados como intencionados, no como problemas a corregir.
- **Ampliación 2026-07-17**: arco de Tarkor mucho más desarrollado (su desarrollo tardío, el encuentro con la luz morada, la voz que crece dentro de él); dos regiones nuevas en Berig (Cristal Helado con el Clan Helsig, Ciénaga Troncal con el Clan Goshg) con su propia flora/fauna; historia, aspecto físico e inventario inicial de Gorhorn mucho más detallados.
- **Ampliación 2026-07-17 (segunda pasada, Claude)**: cultura de liderazgo orco (Terk'ikar mayoritariamente hembra / Kort'ikar mayoritariamente macho — indicación de la autora), los 4 clanes orcos detallados con su relación con Gorhorn, flora/fauna propia de las Llanuras del Viento Rojo (le faltaba respecto a las otras regiones orcas), una nota breve de cómo los orcos ven a Tarkor culturalmente (sin traerlo al presente narrativo), definición de "Magia" (5 escuelas) y "Poder de Semilla" como conceptos, tabla de atributos rellenada por completo, y una lista de ganchos de aventura concretos para las partidas de test de Gorhorn.
- **Reorganización 2026-07-17 (tercera pasada)**: el documento se dividió en `docs/rpgtarkor/` (genesis.md, areas.md, historia.md, razas.md, personajes.md, npcs.md) — este archivo queda como índice + contrato + pendientes.

### Pendientes de diseño abiertos
- **Mapa de estadísticas ampliado — relleno como propuesta, pendiente de tu revisión**: las 9 columnas nuevas (Inteligencia, Magia, Poder de semilla, Moral, 4 Resistencias) ya tienen valores para los 8 personajes en [rpgtarkor/personajes.md](rpgtarkor/personajes.md), derivados de sus biografías existentes. Son una propuesta de Claude, no un cierre — ajústalos con confianza si algo no encaja. El motor de juego (dados, clasificación de acciones) sigue usando solo Fuerza/Destreza/Sigilo/Voluntad/Carisma/Arcano; estas 9 quedan documentadas para cuando se decida construir esa capa, no son jugables todavía.
- **Magia de 6 escuelas**: el contrato de mundo (arriba) ahora nombra `arcano/elementos/oscura/purificadora/naturaleza/dominio` en vez de solo `arcano`, y [rpgtarkor/personajes.md](rpgtarkor/personajes.md) ya propone qué escuela hereda cada raza de su Semilla. Documentado como ampliación real pero **no implementada** — el Modelfile del Narrador y el servicio de clasificación (`backend/src/services/narrador.ts`) solo reconocen `arcano` como atributo válido hoy. Sigue pendiente la decisión técnica antes de tocar código: ¿las 5 escuelas nuevas son atributos jugables independientes (como Fuerza o Sigilo), o son "sabores" narrativos de un único atributo `arcano`? La propuesta de esta pasada (columna "Magia" separada de "Arcano") apunta a la segunda opción, pero no está cerrado.

### Continuidad menor (no bloqueante)
- **"La Cicatriz"** nombra ahora dos cosas distintas en versiones distintas del documento: antes era la herida marina que causó la primera guerra; ahora "La Cicatriz de Cristal" es un valle en territorio Kelife sin relación con aquello (ver [rpgtarkor/areas.md](rpgtarkor/areas.md)). No es un error, solo algo a tener en cuenta si se reutiliza el nombre más adelante.
- Sigue sin resolver si los **Nabieus** deberían figurar explícitamente en la lista de "razas diseñadas" de la Era 1 (están vinculados a Kroj, una Semilla Fiel, igual que Kalisar a Sezix) — detalle menor, no bloqueante.

### Pendientes de implementación (siguiente paso técnico)
1. ~~Atributos numéricos para los 8 personajes~~ — **hecho**, ver tabla en [rpgtarkor/personajes.md](rpgtarkor/personajes.md) (las 6 estadísticas base; el resto queda pendiente, ver arriba).
2. **Sustituir el mundo placeholder "Valdreth"** por Helek Sirik en `frontend/src/data/mock.ts` (nombre, sinopsis, facciones = Alianza de la Rama Blanca / Concordia de Hierro, tema de color — probablemente tonos azules/cristalinos dado "Origen Azul", no el latón/musgo actual) y en el `Modelfile` del Narrador con el contrato de mundo de arriba.
3. ~~Sustituir los 4 personajes pregenerados actuales~~ — **hecho**, los 8 personajes de Helek Sirik ya están en `frontend/src/data/mock.ts`.
4. **Elegir el gancho de partida concreto** para una partida en solitario: con 8 protagonistas potenciales pero una sola partida jugable a la vez (MVP en solitario), decidir cómo se presenta esto en la selección de personaje.
