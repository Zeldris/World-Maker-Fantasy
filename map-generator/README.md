# map-generator — el mapa de Helek Sirik en formato propio

Plan y decisiones: [`roadmap-mapas.md`](../docs/producto/roadmap-mapas.md). Solo Python 3 de la biblioteca estándar.

```bash
python3 map-generator/importar.py      # MAP-1: docs/map/Helek_World.map → mundo/helek.json, helek.geojson, revisar.json
python3 map-generator/medir.py         # MAP-2: medidas del mapa contra canon.json (sale con 1 si algo se sale del ±3 %)
python3 -m unittest discover -s map-generator/tests
```

## Qué hay

- `importar.py`: lee el `.map` de **FMG 1.137.6** una vez (falla con su motivo si es de otra versión) y **nunca lo
  escribe**. FMG no guarda las celdas del mapa (`pack`): las rehace al cargar con `reGraph()`. Aquí se rehacen igual
  (`fmg/grafo.py`, con un port de Delaunator en `fmg/delaunator.py`), índice a índice: si la suma de áreas de cada
  región o las celdas de cada continente no cuadran con lo que guardó FMG, no se escribe nada.
- `mundo/helek.json`: la fuente desde la importación. Celdas (`p` centro, `v` vértices, `c` vecinas, `h` altura,
  bioma, región, provincia, continente), vértices, regiones, provincias, lugares, rutas y ríos. Una fila por
  elemento, para que el diff de git se lea. `helek.geojson` es lo mismo en GeoJSON (1 unidad ≈ 1 km).
- `mundo/revisar.json`: lo automático de Azgaar que no entra en el mapa (los 40 marcadores con nombre en inglés).
- `canon.json`: las medidas del canon que el mapa tiene que respetar y las que están `sinDecidir`. **Las cambia solo
  la usuaria.**
- `medir.py` y `geometria.py`: área (shoelace), envolvente E-O × N-S y distancias entre lugares.

## Fuentes y licencias

- Azgaar's Fantasy Map Generator (MIT), commit `73e43d2b`: orden de registros de `save.ts` y `reGraph` de
  `public/main.js`, `src/generators/voronoi.ts` y `src/utils/graphUtils.ts`.
- Delaunator 5.0.1 (ISC, Mapbox), portado en `fmg/delaunator.py` con el mismo orden de triángulos.
