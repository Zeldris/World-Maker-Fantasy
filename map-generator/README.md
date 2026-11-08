# map-generator — el mapa de Helek Sirik en formato propio

Plan y decisiones: [`roadmap-mapas.md`](../docs/producto/roadmap-mapas.md). Solo Python 3 de la biblioteca estándar.

```bash
python3 map-generator/importar.py      # MAP-1: docs/map/Helek_World.map → mundo/helek.json, helek.geojson, revisar.json
python3 map-generator/medir.py         # MAP-2: medidas del mapa contra canon.json (sale con 1 si algo se sale del ±3 %)
python3 map-generator/comprobar.py     # MAP-3: reglas de lore.json sobre el mapa (orden, fronteras, corredor; sale con 1 si alguna falla)
python3 map-generator/exportar.py      # MAP-4: fronteras para el juego → frontend/src/data/helekRegiones.ts (--comprobar: falla si está desfasado)
python3 map-generator/enciclopedia.py # MAP-8: los lugares de la enciclopedia (slug, nombre, región, tipo) que se pueden enlazar
bash map-generator/abrir.sh           # MAP-5…MAP-8: visor y editor local en http://127.0.0.1:8765/ (sin red; --puerto N)
python3 -m unittest discover -s map-generator/tests
```

## Qué hay

- `importar.py`: lee el `.map` de **FMG 1.137.6** una vez (y no pisa un `helek.json` editado sin `--sobrescribir`) (falla con su motivo si es de otra versión) y **nunca lo
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
- `lore.json` y `comprobar.py`: las reglas del lore que el mapa tiene que cumplir (franjas N-S, Llanuras al oeste,
  fronteras, corredor costero, Vaelira al oeste, sin Isla Cambiante) y quien las ejecuta, con la cifra medida de cada
  una. Las de `sinDecidir` se muestran con `?` y no hacen fallar. **Las reglas las cambia solo la usuaria.**
- `exportar.py`: lo que lee el juego. Hoy el contorno y la envolvente de cada región, que dibuja
  `InteractiveMap.tsx`; **tras cambiar `helek.json` se vuelve a exportar** (el test falla si no).
- `abrir.sh`, `servir.py` y `visor/index.html`: el visor. El servidor escucha solo en 127.0.0.1 y sirve solo `/`,
  `/helek.json`, `/enciclopedia.json` y `/medidas.json` (áreas y envolventes con `medir.py`, las mismas del test del canon); la página no
  carga nada de fuera. Es la base del editor de `MAP-6`…`MAP-9`.
- `editar.py` (MAP-6…MAP-8): el editor del visor (modos Región, Provincia, Relieve, Lugares, Rutas y Ríos; pincel, provincia nueva,
  renombrar, deshacer, Comprobar y Guardar). Relieve: Subir, Bajar, Tierra y Mar cambian la altura `h` y la costa
  (mar ↔ tierra: bioma, región y provincia se heredan de las vecinas, los continentes se recalculan; una isla nueva es
  `Isla nueva N`; unir continentes o vaciar uno se rechaza); **Berig está bloqueado por defecto** (su tierra y su agua de
  costa; casillas «Bloquear» en el visor, `"bloqueo": []` en un lote). Lugares, Rutas y Ríos (MAP-8): crear, mover,
  renombrar, borrar y enlazar cada lugar a su ficha de la enciclopedia (`slug`, de `enciclopedia.py`, que lee
  `worldCatalog.ts`); dibujar, redibujar y borrar rutas y ríos. Lo dibujado tiene que estar en su sitio (caminos y
  ríos por tierra, rutas marítimas por agua), y el relieve no puede dejar fuera de sitio una ruta o un río que el lote
  no redibuje; las capitales y los lugares que nombra `canon.json` no se borran ni se renombran. Valida cada lote, dice qué medidas cambian y cómo quedan el
  canon y el lore, y guarda `helek.json`, `helek.geojson` y el archivo del juego; el servidor solo acepta los POST
  en JSON desde la propia página y sobre la versión que se abrió. **Tras editar, el mapa ya no sale del `.map`:**
  `importar.py` se niega a reimportar sin `--sobrescribir`. `--sin-juego` en `servir.py` no toca el archivo del juego.
- **Por consola, sin servidor ni navegador** (agentes): `python3 map-generator/editar.py lote.json` comprueba y muestra el
  informe (`--json`: en JSON; sale con 1 si el lote no vale o canon/lore fallan); `--guardar` escribe (con canon o lore
  en rojo, solo con `--forzar`); `--mundo RUTA` trabaja sobre una copia (y entonces no toca el archivo del juego) y `--sin-juego` tampoco lo toca. Ejemplo
  de lote (`base` es opcional): `{"alturas": [[1234, 30], [1235, 5]], "bloqueo": [], "celdas": [[1234, 18, 0]]}`;
  de MAP-8: `{"lugares": [{"i": 900, "slug": "agujas-iman", "x": 540, "y": 190}], "rutas": [{"i": 451, "grupo":
  "trails", "puntos": [[534, 185], [560, 186]]}], "rios": [{"i": 1, "nombre": "…", "puntos": [[…], […]]}]}` (el
  formato completo, en el docstring de `editar.py`).

## Fuentes y licencias

- Azgaar's Fantasy Map Generator (MIT), commit `73e43d2b`: orden de registros de `save.ts` y `reGraph` de
  `public/main.js`, `src/generators/voronoi.ts` y `src/utils/graphUtils.ts`.
- Delaunator 5.0.1 (ISC, Mapbox), portado en `fmg/delaunator.py` con el mismo orden de triángulos.
