# Roadmap del generador de mapas — Tarkor

**Creado:** 2026-11-05 (usuaria). **Qué cubre:** una herramienta local propia (`map-generator/`) para el mapa del
mundo de Helek Sirik: forma, continentes, regiones, relieve, ríos, rutas y lugares, editable sin Azgaar y sin lo
que de Azgaar no se usa, y los exportes que pide el juego.
**Orden y hito:** los fija el [mapa de roadmaps](21-roadmap.md#mapa-de-roadmaps).
**No empieza hasta cerrar las pruebas de juego** (regla del 2026-10-13), salvo que la usuaria lo adelante como hizo
con las voces. **Adelantado por la usuaria el 2026-11-08** (rama `claude/generador-mapas`), empezando por la fase M-A.

**Cómo se usa** (mismo convenio que [roadmap-front.md](roadmap-front.md)): al cerrar un punto se tacha con su
commit; **[A]** pedido por Álvaro, **[P]** propuesta de Claude; esfuerzo **S** (horas) · **M** (1-2 días) ·
**L** (varios días).

## La decisión (usuaria, 2026-11-05)

El mapa actual, `docs/map/Helek_World.map`, lo dibujó la usuaria en Azgaar (FMG 1.137.6, lienzo 800×600, 1 unidad
≈ 1 km) y es **canon medido**: de él salen las fronteras de `InteractiveMap.tsx`, la escala y las medidas de
[`13-escala-del-mundo.md`](../mecanicas/13-escala-del-mundo.md) y `areas.md`. Hoy nada lo lee por script: las
fronteras se pegaron a mano y las medidas se tomaron a ojo.

Un intento anterior de editar el `.map` y volver a cargarlo en Azgaar casi siempre lo rompía. Por eso:

- **El `.map` se lee una vez y no se vuelve a escribir.** Leerlo es seguro (es texto plano, 46 secciones); escribirlo
  depende de un formato interno sin documentar.
- **Desde la importación, la fuente es un formato propio** (`map-generator/mundo/helek.json`), en git y con diff
  legible, y se edita con un editor local pequeño que solo tiene lo que el juego usa.
- **El canon se protege con tests**: áreas, envolventes y distancias entre lugares con nombre contra `13-escala` y
  `areas.md` (±3 %); lo que las mueva tiene que decidirlo la usuaria.
- **La generación procedural va solo donde aporta**: tierras aún sin dibujar (Vaelira, la tierra nueva tras El
  Detonante) y los mapas de zona, nunca rehaciendo Berig.

Se descartó un generador del continente entero desde cero: semanas de trabajo, sobre todo en el dibujo y las
etiquetas, para rehacer un mapa que ya es canon. Valoración completa, con fuentes, al final.

## Fase M-A · Importar y proteger el canon

- ~~**MAP-1 · Importador de solo lectura del `.map`**~~ [P] (usuaria, 2026-11-05): `map-generator/importar.py` lee el
  `.map` de FMG 1.137.6 (falla con un mensaje claro si la versión es otra) y escribe `mundo/helek.json` y un
  GeoJSON: celdas con altura y bioma, costas, los dos continentes, regiones (`state17`–`state21`) y provincias,
  ríos, rutas y lugares con nombre. Los ~300 burgs con nombre automático no entran: van a una lista aparte para
  revisar. **S-M** ✅ 2026-11-08: las celdas se rehacen como `reGraph()` de FMG (port de Delaunator) y cuadran
  exactas con las áreas que guardó FMG (5120 celdas). El mapa **no tiene ríos**, y los burgs automáticos ya estaban
  borrados en Azgaar (quedan las 5 capitales): `revisar.json` lleva los 40 marcadores automáticos.
- ~~**MAP-2 · Medidas automáticas y test del canon**~~ [P] (usuaria, 2026-11-05): `medir.py` calcula área (shoelace),
  envolvente y distancias de `helek.json`; un test las compara con `13-escala-del-mundo.md` §3-4 y `areas.md`, con
  tolerancia, y falla si algo se mueve. **S** ✅ 2026-11-08: `canon.json` (±3 %) con el área de las Llanuras, las
  envolventes de las 5 regiones y de Berig y dos distancias; todo dentro. **Sin decidir (usuaria):** el área de
  Berig (canon 100.000-115.000 km², el mapa da ~91.200: salió del rectángulo) y la forma de Vaelira (el canon la
  quiere más ancha que alta; en el `.map` está dibujada, ~260 × 504 km).
- **MAP-3 · El lore en datos y su comprobador** [P] (usuaria, 2026-11-05): `mundo/lore.json` con las reglas del
  mapa (tres franjas norte-sur, Llanuras al oeste y Ciénaga al este, el Margen como cinturón que linda con toda la
  Ciénaga y se adelgaza hacia la costa oeste, el corredor costero, el muro de obsidiana al norte, la Isla Cambiante
  fuera del mapa) y `comprobar.py`, que las ejecuta sobre `helek.json`. **M**
- **MAP-4 · El juego lee del mapa propio** [P] (usuaria, 2026-11-05): las fronteras de `InteractiveMap.tsx` y la
  imagen de fondo se generan desde `helek.json` en vez de pegarse a mano; el juego se ve igual (comparación de
  capturas antes y después). **El fondo sigue siendo la imagen exportada de Azgaar** hasta que `MAP-13` la iguale
  y la usuaria lo apruebe (usuaria, 2026-11-05). **S-M**

## Fase M-B · Editor local propio

- **MAP-5 · Visor local por capas** [P] (usuaria, 2026-11-05): `map-generator/abrir.sh` sirve una página sin red
  que pinta `helek.json` por capas (relieve, biomas, regiones, ríos, rutas, lugares), con zoom, escala en km y
  medidas al pasar el ratón. **M**
- **MAP-6 · Editar regiones y fronteras** [P] (usuaria, 2026-11-05): mover límites celda a celda, crear y renombrar
  provincias; al guardar se pasan `comprobar.py` y el test del canon, y se avisa de qué medidas cambian. **M**
- **MAP-7 · Editar relieve y costa** [P] (usuaria, 2026-11-05): pinceles para subir y bajar terreno y para pasar
  celdas de mar a tierra, con zonas bloqueables (Berig entero, por defecto). **M**
- **MAP-8 · Ríos, rutas y lugares** [P] (usuaria, 2026-11-05): dibujar y editar ríos y rutas, y colocar lugares
  enlazados a su ficha de la enciclopedia (slug), con su nombre de lore. **M**
- **MAP-9 · Guardar con historial** [P] (usuaria, 2026-11-05): cada guardado reescribe `helek.json` con orden
  estable (diff legible en git) y se puede deshacer; nunca escribe en el `.map`. **S**

- **MAP-13 · Dibujo propio a la altura de Azgaar** [P] (usuaria, 2026-11-05): costas con trazo, iconos de
  relieve, texturas de bioma y colocación de etiquetas sin solapes, en un estilo propio de Helek. Se compara lado a
  lado con la imagen de Azgaar en las mismas vistas, y **solo con el visto bueno de la usuaria** pasa a ser el fondo
  del juego. Es lo más caro del proyecto: hasta entonces la calidad visual no baja. **L**
- **MAP-14 · Capas del juego** [P] (usuaria, 2026-11-05): lo que Azgaar no tiene: tormentas magnéticas de las
  Llanuras, zonas de peligro, territorio de cada clan y rutas con km y tiempos, como capas editables del visor y
  exportables al juego. **M**

## Fase M-C · Generar donde aporta

- **MAP-10 · Tierras nuevas por generación** [P] (usuaria, 2026-11-05): relieve, costa, ríos y biomas por
  plantilla y ruido (Delaunay + ruido + erosión, estilo mapgen4) para lo que aún no está dibujado (Vaelira en
  detalle, la tierra nueva tras El Detonante), sin tocar lo bloqueado. **L**
- **MAP-11 · Mapa de zona desde su celda del mundo** [P] (usuaria, 2026-11-05): prototipo que, del relieve, bioma
  y ríos de una celda, genera una base de mapa de zona coherente con el mundo, para completar los `*-mapa.png` de
  `backend/uploads/images/zona/`. **L**
- **MAP-12 · Grafo de viaje con tiempos** [P] (usuaria, 2026-11-05): nodos y aristas con km y `minutosBase`
  derivados de rutas y terreno, en el formato de `frontend/src/data/map.ts`. **M**

- **MAP-15 · Acabado pintado con el generador de imágenes** [P] (usuaria, 2026-11-05): pasar el dibujo de
  `MAP-13` por `image-generator/` (como referencia o con LoRA) para un acabado ilustrado, sin mover costas ni
  fronteras (se comprueba superponiendo las capas). Depende de `MAP-13`. **M**

## Pendiente de comprobar en la Deck

- Que el editor (`abrir.sh`) abra y se use bien en la Deck sin red (lo comprueba la usuaria).

## Valoración (2026-11-05)

| Opción | Esfuerzo | Por qué sí o no |
|---|---|---|
| Seguir con Azgaar y extraer por script | S-M | Seguro al leer, pero editar sigue atado a Azgaar y el retorno al `.map` rompía |
| Azgaar en local o forkado | M-L | Sin modo sin interfaz; un fork se separa de un original muy activo; trae todo lo que no usamos |
| Generador propio del continente entero | L, semanas | Rehace un mapa que ya es canon; lo caro es el dibujo y las etiquetas |
| **Importar una vez + formato y editor propios + generar donde aporta** | M la base, L la generación | **Elegida**: sin volver a escribir el `.map`, sin lo que no se usa, con el canon protegido; el dibujo propio sustituye al de Azgaar solo cuando lo iguala (`MAP-13`) |

Fuentes:

- Licencia de Azgaar (MIT con una cláusula que permite derivados y uso comercial):
  https://raw.githubusercontent.com/Azgaar/Fantasy-Map-Generator/master/LICENSE
- FMG en local y exportes (JSON, GeoJSON; el GeoJSON no se reimporta):
  https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Run-FMG-locally ·
  https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export ·
  https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-import
- Sin modo sin interfaz (solo `maplink` carga datos por URL):
  https://github.com/Azgaar/Fantasy-Map-Generator/wiki/URL-parameters
- mapgen4 y mapgen2 (Apache-2.0): https://github.com/redblobgames/mapgen4 ·
  https://raw.githubusercontent.com/redblobgames/mapgen2/master/LICENSE
- d3-delaunay (ISC): https://raw.githubusercontent.com/d3/d3-delaunay/main/LICENSE
- mewo2/terrain (MIT, sin mantenimiento): https://github.com/mewo2/terrain
- WorldEngine (MIT, placas y erosión, Python): https://github.com/Mindwerks/worldengine
- Erosión hidráulica en JS (MIT): https://github.com/ctkrug/erosion
