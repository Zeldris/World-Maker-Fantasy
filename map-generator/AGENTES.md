# Editar el mapa de Helek como agente (MAP-16)

Tienes el mapa en `map-generator/mundo/helek.json` y dos órdenes: `consultar.py` (preguntar, solo lee) y
`editar.py` (comprobar y guardar un lote de cambios). No ves el mapa: todo lo sabes preguntando.

## El mapa en dos líneas

800 × 600, 1 unidad ≈ 1 km; **x crece al este y y crece al SUR** (norte = y pequeña). Está hecho de celdas: cada una
tiene `i`, centro `[x, y]`, altura `h` (**tierra si h ≥ 20**), región y provincia (0 = ninguna). Un punto (x, y) cae
en la celda de centro más cercano.

## Cómo se trabaja: siempre en este orden

1. **Pregunta** con `consultar.py` lo que necesites (celdas, fronteras, costa, lugares, fichas, i libres).
2. **Escribe el lote** (JSON) con lo que te piden, y nada más.
3. **Compruébalo sin guardar**: `editar.py -` con el lote por la entrada. Lee el informe: si da error o el canon o el
   lore salen en rojo, corrige el lote y vuelve al paso 3.
4. **Guarda** solo con el informe en verde: `editar.py - --guardar`.
5. Responde con lo que hiciste (o por qué no) en dos o tres frases, con las cifras del informe.

## Consultar (`consultar.py`)

```
consultar.py resumen                    # regiones, provincias, continentes e i libres para lugares/rutas/ríos
consultar.py region Meseta              # celdas, envolvente en km, capital, vecinas
consultar.py frontera Ciénaga Margen    # celdas de A que lindan con B y de B que lindan con A (de norte a sur);
                                        # «agranda N-S» = al pasar a la otra región esa celda agranda su envolvente
consultar.py frontera Llanuras mar      # la costa de una región
consultar.py costa Vaelira              # tierra junto al mar y mar junto a tierra (candidatas a pasar a tierra)
consultar.py celda 540 190              # la celda de ese punto y sus vecinas  (o: celda --i 1715)
consultar.py lugares --cerca 540 190 --radio 40
consultar.py lugares --nombre ordinum   # por fragmento del nombre; se combina con --region, --cerca, --caja
consultar.py camino 571 398 581 317     # puntos de una ruta por tierra listos para el lote (recta o rodeo);
                                        # --mar para rutas marítimas, --paso KM (8). Si no hay camino, dice por qué
consultar.py fichas --sin-lugar         # slugs de la enciclopedia que aún no están en el mapa
```
Nombres sin mayúsculas ni tildes y por fragmento («Margen»). `--caja X0 Y0 X1 Y1` recorta frontera, costa y lugares;
`--json` da la salida en JSON. Si la salida es larga, recórtala con `--caja`.

## El lote (`editar.py`)

Un objeto JSON con solo las claves que uses:
```
{"celdas":  [[celda, region, provincia], ...],             # cambiar de región (provincia 0 = ninguna)
 "alturas": [[celda, h], ...],                            # h de 0 a 100; pasar a tierra: h = 25; a mar: h = 5
 "lugares": [{"i": 616, "slug": "agujas-iman", "x": 545, "y": 200}],   # i nuevo (de resumen) = crear
 "rutas":   [{"i": 451, "grupo": "roads", "puntos": [[x, y], [x, y], ...]}],   # roads, trails o searoutes
 "rios":    [{"i": 0, "nombre": "Río …", "puntos": [[x, y], ...]}]}
```
- Las regiones se cambian por su número `i` (17 Cristal Helado, 18 Llanuras del Viento Rojo, 19 Ciénaga Troncal,
  20 El Margen Silencioso, 21 La Meseta del Orden).
- Un lugar o una ruta **nuevos** llevan el siguiente `i` libre que da `consultar.py resumen`.
- Una ruta se traza con `camino`: pega sus `puntos` en el lote; no compruebes punto a punto.

## Qué no se toca

- **Nunca `--forzar`.** Si el canon o el lore fallan, no se guarda: se dice qué medida falla y se para. Las medidas
  del canon (`canon.json`) y las reglas del lore (`lore.json`) las cambia solo la usuaria.
- **Nunca `"bloqueo": []`** salvo que el encargo lo pida: Berig (todas las regiones) tiene el relieve bloqueado.
- Ni `canon.json`, ni `lore.json`, ni `docs/`, ni el `.map` de Azgaar. Solo `editar.py` escribe el mapa.
- Las capitales y los lugares del canon no se borran ni se renombran.
- Lo que no pide el encargo no se cambia (otras regiones, rutas o lugares que ya había).

## Errores típicos y qué hacer

- *«la ruta N (ruta marítima) queda fuera de sitio»* al pasar mar a tierra: has tapado una ruta marítima. Elige otras
  celdas de costa (otro tramo) en vez de tocar la ruta.
- *«… caería en mar»*: el punto no es tierra; busca uno con `celda X Y` que dé h ≥ 20.
- Canon en rojo (área o envolvente de una región fuera de tolerancia): quita celdas que agrandan la envolvente (la
  marca de `frontera`) y vuelve a comprobar. **Si para cumplir el canon tendrías que hacer menos de lo que pide el
  encargo (por debajo de su mínimo), no guardes: dilo con las cifras** (qué pedía, qué admite el canon).
- *«celda N es mar»* al cambiar de región: solo las celdas de tierra tienen región.

## Ejemplos resueltos

**Frontera** — «pasa a la Ciénaga entre 5 y 10 celdas del Margen que lindan con ella».
`frontera Ciénaga Margen` → de «Celdas de El Margen Silencioso que lindan con Ciénaga Troncal», toma primero las
que **no** dicen «agranda» (no mueven la envolvente). Lote con 7 de ellas, canon y lore en verde → guardar:
`{"celdas": [[2981, 19, 0], [2977, 19, 0], [2976, 19, 0], [2978, 19, 0], [2979, 19, 0], [2980, 19, 0], [3070, 19, 0]]}`.

**Costa** — «pasa a tierra 8-20 celdas de mar de la costa de Vaelira, con x < 205, sin islas».
`costa Vaelira --caja 0 0 205 600` → elige celdas de mar pegadas entre sí. Lote:
`{"alturas": [[2, 25], [3, 25], [18, 25], [19, 25], [20, 25], [51, 25], [52, 25], [96, 25], [97, 25], [150, 25]]}`.
Si el informe dice que tapas la ruta marítima N, cambia de tramo de costa.

**Lugar** — «pon la ficha agujas-iman en las Llanuras, a ≤ 40 km del Campamento Serhu».
`resumen` (i libre de lugar: 616), `lugares --nombre serhu` (534.6, 185.1), `celda 542 192` (a ~10 km, tierra, región 18).
Lote: `{"lugares": [{"i": 616, "slug": "agujas-iman", "x": 542, "y": 192}]}`.

**Ruta** — «camino roads por tierra entre Ordinum y el Puesto Nabieus, extremos a < 8 km».
`lugares --nombre ordinum` y `lugares --nombre nabieus` (posiciones), `resumen` (i libre de ruta: 451),
`camino 570.9 397.8 581.4 317` → pega sus puntos. Lote:
`{"rutas": [{"i": 451, "grupo": "roads", "puntos": [[570.9, 397.8], [571.9, 390.5], ..., [581.4, 317.0]]}]}`.

**Pedido imposible** — «pasa 30 celdas de la Ciénaga a las Llanuras».
`frontera Llanuras Ciénaga` y un lote de prueba con 30: el canon sale en rojo (envolvente de Llanuras 127 → 136 km).
Quitar celdas no llega a 30: **no guardes**; responde con las cifras: «no se puede: el canon no lo admite
(Llanuras 127 → 136 km de envolvente, MAL); no he cambiado nada».
