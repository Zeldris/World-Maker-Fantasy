# Helek Sirik — "Origen Azul"

**Estado:** Biblia del mundo v4 — dividida en varios archivos (ver índice abajo) para que cada tema sea más manejable a medida que crece.
**Fecha:** 2026-07-17.
**Rol de este documento:** este es el **índice** del **primer mundo semilla real** de Tarkor (decisión de producto 5, [02-decisiones.md](../../producto/02-decisiones.md)), y sustituye por completo al mundo placeholder **"Valdreth"** que se usó solo para la demo de frontend (Concilio de Plata, Clanes de Skarn, etc. — ninguno de esos nombres pertenece a Helek Sirik y hay que retirarlos del código).

El contenido completo del mundo vive repartido en `docs/rpgtarkor/` — este archivo es el punto de entrada: aquí están el contrato de mundo (lo que necesita el motor de juego) y el seguimiento de pendientes técnicos. El contenido narrativo puro (mitología, geografía, historia, razas, personajes, NPCs) mezcla texto redactado por la autora (guardado tal cual) con ampliaciones de Claude claramente marcadas como tales — todo pensado para revisar y ajustar, no como cierre definitivo.

> **Nota de naming, confirmada intencionada por la autora:** la Semilla caída se llama **Tarkor** — el mismo nombre que el proyecto/app. Es un guiño deliberado, no un error. Tenerlo en cuenta al escribir prompts o documentación técnica para no generar ambigüedad entre "Tarkor la app" y "Tarkor la Semilla".

---

## Índice del mundo

| Archivo | Contenido |
|---|---|
| [rpgtarkor/genesis.md](genesis.md) | Era 0 (Madre, las 13 Semillas, la Entidad Desconocida, el arco de Tarkor) y Era 1 (La Formación, El Estallido). |
| [rpgtarkor/areas.md](areas.md) | Geografía global, idiomas y resumen de los dos continentes, con el **índice de regiones**. |
| [rpgtarkor/regiones/](regiones/) | Un fichero por región con geografía, lugares, fauna y flora juntos: [Cristal Helado](regiones/cristal-helado.md) · [Llanuras del Viento Rojo](regiones/llanuras-del-viento-rojo.md) · [Ciénaga Troncal](regiones/cienaga-troncal.md) · [El Margen Silencioso](regiones/margen-silencioso.md) · [La Meseta del Orden](regiones/meseta-del-orden.md) · [Vaelira](regiones/vaelira.md). |
| [rpgtarkor/clanes-orcos.md](clanes-orcos.md) | Cultura y gobierno orco (Terk'ikar, asamblea, Kurig), el Reino Nabierus enterrado, la historia profunda de los cuatro primeros orcos a Gorhorn y los cuatro clanes. |
| [rpgtarkor/lenguas-helek.md](lenguas-helek.md) | Diccionario de las lenguas de Berig (Kektira, Feg, Naebius, Kerost, Sirikel). |
| [rpgtarkor/historia.md](historia.md) | Era 3 (Los Ciclos) y Era 4 (El Presente: Paz Templada, el Detonante, las Alianzas, El Giro) — el momento en el que arranca cualquier partida. |
| [rpgtarkor/razas.md](razas.md) | Tabla resumen de las 8 razas jugables. |
| [rpgtarkor/flora-fauna.md](flora-fauna.md) | Las 26 familias de fauna y flora y el índice de qué especie vive en cada región (las fichas están en `regiones/`). |
| [rpgtarkor/items.md](../items-y-catalogo/items.md) | Armamento, loot y objetos de trasfondo por región. |
| [rpgtarkor/personajes.md](../personajes/personajes.md) | Los 8 personajes pregenerados, atributos jugables, conceptos de Magia/Poder de Semilla, y ganchos de aventura para las partidas de Gorhorn. |
| [rpgtarkor/npcs.md](../personajes/npcs.md) | Los 10 NPCs de apoyo. |
| [rpgtarkor/clases.md](../sistemas-combate/clases.md) | Clases de combate y sus especializaciones (elegidas a nivel 10), las 7 escuelas de Magia y las 12 ramas de Poder de Semilla como caminos de la clase Mago, y el sistema de armas a una/dos manos + escudo. **APLICADO al motor** (2026-08-24): 8 de 9 clases reales (todas salvo Mago), 136 `ClassAbilityUnlock`, restricción de armas por clase para Guerrero/Cazador/Chamán. |
| [rpgtarkor/combate-multiple.md](../sistemas-combate/combate-multiple.md) | Combate con varios aliados/enemigos a la vez — iniciativa individual real, objetivo individual por ronda (duelo/golpe gratis). **APLICADO al motor** (2026-08-25, objetivo individual 2026-08-26). |
| [rpgtarkor/companeros-y-supervivencia.md](../sistemas-reino/companeros-y-supervivencia.md) | Captura (transporte en inventario, 1 a la vez)/tameo/persuasión de compañeros, Hambre/Sed, Almacén de Reino, plantillas de equipo. **APLICADO al motor** (2026-08-25; rediseño de captura 2026-08-28). |
| [rpgtarkor/mundo-determinista.md](mundo-determinista.md) | Por qué la narración libre nunca decide (solo narra lo ya resuelto): zonas navegables, cola de eventos, aparición determinista de NPC/fauna, disparo real de combate múltiple. **APLICADO al motor** (2026-08-25; zonas navegables extendidas a Las Llanuras 2026-08-31). |
| [rpgtarkor/estaciones.md](estaciones.md) | Calendario único global (120 días/año), nombres Kektira por raza, gate de estación en recolección. **APLICADO al motor** (2026-08-24). |
| [rpgtarkor/clima-tormentas.md](clima-tormentas.md) | Clima real de Las Llanuras del Viento Rojo (tormentas/vientos por severidad). **APLICADO al motor** (2026-08-24). |
| [rpgtarkor/imagenes-prompts.md](../items-y-catalogo/imagenes-prompts.md) | Sistema de prompts de imagen de la Enciclopedia: fix del bug estilo/tono nunca llegaba al LLM, variantes de día/noche/estación en Location/Zona. **APLICADO al motor** (2026-08-27). |

---

## Contrato de mundo (cerrado el 2026-07-17, magia ampliada el 2026-07-17)

Estos son los valores confirmados que necesita el `World` de la base de datos y el prompt del Narrador:

| Campo | Valor |
|---|---|
| **Tono** | Épico y trágico: pueblos que se creen en lo correcto libran una guerra sobre una verdad que nadie tiene completa, en un mundo tan pequeño que cada muerte deja cicatriz. |
| **Letalidad** | Media — con una población máxima de ~6.000 habitantes, la muerte de un personaje con nombre debe seguir siendo un hecho raro y con peso, no algo casual por una mala tirada. |
| **Magia (`arcano/elementos/oscura/purificadora/naturaleza/dominio/salvaje`)** | Siempre conlleva un pequeño riesgo, incluso en éxito — el Narrador puede añadir un coste o efecto secundario narrativo aunque la tirada salga bien (algo se resiente, atrae atención, deja un rastro), reflejando que es un poder que nadie diseñó ni controló nunca del todo. No es una mecánica nueva de dados — se resuelve en la narración del resultado, no cambia la fórmula de tirada. **7 escuelas** (ampliado 2026-08-23, ver [rpgtarkor/genesis.md § Las 7 ramas de la magia de Tarkor](genesis.md#era-0--el-génesis) y [rpgtarkor/clases.md](../sistemas-combate/clases.md)): las 6 de siempre más **Salvaje**, la rama concreta que dio origen a los Orcos y otras razas sin Semilla — antes esta fila describía TODA la magia de Tarkor como "salvaje e incontrolada" a secas; con las 7 ramas ya definidas, eso aplica en concreto a la rama Salvaje, no a Arcano (fuerza pura, sin ese matiz de mutación). **Importante (ver pendientes abajo):** de estas 7 escuelas, solo la mecánica del atributo `magia` (antes `arcano`, renombrado 2026-09-01) está implementada en el motor de dados/clasificación hoy — las 7 escuelas comparten esa misma tirada, diferenciadas solo por qué habilidades tiene disponibles cada una; las otras 6 siguen sin habilidades concretas construidas, diseño futuro todavía no funcional. |
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
- **Reorganización 2026-07-28 (cuarta pasada)**: `areas.md` tenía mezcladas geografía, flora/fauna y armamento/loot en un mismo archivo. Se extrajeron a `rpgtarkor/flora-fauna.md` (flora y fauna de ambos continentes) y `rpgtarkor/items.md` (armamento y loot), dejando `areas.md` centrado solo en geografía, razas por región, clanes orcos y puntos de interés. Contenido sin cambios, solo reubicado — cada categoría del mundo (génesis, historia, razas, áreas, flora y fauna, items, personajes, NPCs) tiene ahora su propio archivo.

### Pendientes de diseño abiertos
- **Mapa de estadísticas ampliado — relleno como propuesta, pendiente de tu revisión**: las 9 columnas nuevas (Inteligencia, Magia, Poder de semilla, Moral, 4 Resistencias) ya tienen valores para los 8 personajes en [rpgtarkor/personajes.md](../personajes/personajes.md), derivados de sus biografías existentes. Son una propuesta de Claude, no un cierre — ajústalos con confianza si algo no encaja.
  **Corrección (2026-08-13): esto ya se construyó.** El rediseño de atributos del 2026-07-29 (`backend/src/services/dice.ts`) promocionó **Inteligencia** a atributo primario jugable (junto con Constitución) — el motor de dados usaba entonces `fuerza/destreza/constitucion/inteligencia/voluntad/carisma/arcano` (7, no 6; `sigilo` bajó a secundario). Las 8 columnas restantes (`magia`, `poderSemilla`, `moral` y 4 resistencias, más `sigilo`) vivían como **atributos secundarios** (`backend/src/services/secondaryAttributes.ts`) — no se tiraban, pero sí eran jugables de verdad: alimentaban comprobaciones de umbral en requisitos de objetos/construcciones/oficios (`requisitos.ts`). **Superado (2026-09-01)**: `arcano` se renombró a `magia` como atributo primario (ver decisión de abajo) y los secundarios `magia`/`poderSemilla` se retiraron del todo — hoy el motor usa `fuerza/destreza/constitucion/inteligencia/voluntad/carisma/magia`, con solo 5 secundarios (`moral` y 4 resistencias, más `sigilo`).
- **Magia de 7 escuelas** (ampliado 2026-08-23, antes 6): el contrato de mundo (arriba) ahora nombra `arcano/elementos/oscura/purificadora/naturaleza/dominio/salvaje`. [rpgtarkor/clases.md](../sistemas-combate/clases.md) es ahora el documento de referencia para qué hace cada escuela (clase Mago § Poder Magia) — [rpgtarkor/personajes.md](../personajes/personajes.md) ya tiene la tabla de afinidad raza↔escuela actualizada a las 7 (completada 2026-08-23 con las 2 razas que faltaban, Goirntes y Faerus). Documentado como ampliación real pero **no implementada** — el Modelfile del Narrador y el servicio de clasificación (`backend/src/services/narrador.ts`) solo reconocen `arcano` como atributo válido hoy. **Cerrado (2026-08-24, revisión de checklist): la decisión "Atributo `arcano` → `Magia`" de abajo ya resuelve esta pregunta** — las 7 escuelas (y las 12 ramas de Poder de Semilla) tiran todas con el mismo atributo Magia, diferenciadas solo por qué habilidades/efectos tiene disponibles cada una, nunca por un atributo de dado propio. La nota "sigue pendiente" que había aquí antes se quedó desactualizada frente a esa decisión, escrita el mismo día.

- **Clases de combate y especializaciones** (nuevo 2026-08-23, ver [rpgtarkor/clases.md](../sistemas-combate/clases.md)): diseño de 9 clases (Guerrero, Cazador, Chamán, Arquero, Caballero, Mago, Segador, Asesino, Druida), cada una con 2-4 especializaciones elegidas a nivel 10, más el sistema de armas a una/dos manos + escudo. Cuatro clases exclusivas por raza (Chamán/orcos, Caballero/Goirntes, Segador/Nabieus, Druida/Faerus) — Kelife/Kalisar/Jusaly/Ilvenar se quedan sin clase única a propósito por ahora, no son jugables todavía. **APLICADO al motor (2026-08-24)**: 8 de las 9 clases ya son reales (todas salvo Mago, que sigue solo diseño) — enums `Clase`/`Especializacion` reales, `classAbilities.ts` reescrito con tronco común + especializaciones, 136 `ClassAbilityUnlock` sembrados, restricción de armas por clase para Guerrero/Cazador/Chamán (`weaponAbilities.ts § weaponPoolFor`). Efectos de habilidad (`AbilityEffect`) siguen desbloqueándose por fases aparte — ver `docs/producto/21-roadmap.md` § Fase 1-4.
- **Atributo `arcano` → `Magia`** (decisión 2026-08-23, ver [rpgtarkor/clases.md § Atributo Magia](../sistemas-combate/clases.md)): se renombra y pasa a cubrir TAMBIÉN las tiradas de Poder de Semilla (mismo atributo para las dos, ya no dos conceptos separados) — los secundarios `magia`/`poderSemilla` (`secondaryAttributes.ts`) quedan redundantes y se retiran. **APLICADO al motor (2026-09-01)**.

### Continuidad menor (no bloqueante)
- **"La Cicatriz"** nombra ahora dos cosas distintas en versiones distintas del documento: antes era la herida marina que causó la primera guerra; ahora "La Cicatriz de Cristal" es un valle en territorio Kelife sin relación con aquello (ver [rpgtarkor/areas.md](areas.md)). No es un error, solo algo a tener en cuenta si se reutiliza el nombre más adelante.
- ~~Sigue sin resolver si los **Nabieus** deberían figurar explícitamente en la lista de "razas diseñadas" de la Era 1~~ — **resuelto**: `genesis.md` y `cronologia-mitica.md` ya los listan explícitamente en la segunda oleada, junto a los Faerus.

### Pendientes de implementación (siguiente paso técnico)

*(Actualizado 2026-08-02 — 1-3 hechos desde hace tiempo. El punto 4 sigue abierto pero atado al
lore de los otros 7 personajes, pausado a propósito — ver `docs/archivo/11-roadmap-historico.md` § 0.)*

1. ~~Atributos numéricos para los 8 personajes~~ — **hecho**, ver tabla en [rpgtarkor/personajes.md](../personajes/personajes.md) (las 6 estadísticas base originales; desde 2026-07-29 el motor de juego usa 7 atributos primarios y las 8 columnas restantes ya son atributos secundarios jugables, ver corrección arriba).
2. ~~Sustituir el mundo placeholder "Valdreth"~~ — **hecho**, `frontend/src/data/mock.ts` y el `Modelfile` del Narrador usan Helek Sirik.
3. ~~Sustituir los 4 personajes pregenerados actuales~~ — **hecho**, los 8 personajes de Helek Sirik ya están en `frontend/src/data/mock.ts`.
4. **Elegir el gancho de partida concreto** para una partida en solitario: con 8 protagonistas potenciales pero una sola partida jugable a la vez (MVP en solitario), decidir cómo se presenta esto en la selección de personaje — solo Gorhorn es jugable hoy, ver punto 0 de `docs/archivo/11-roadmap-historico.md`.
