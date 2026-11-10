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
consultar.py frontera Ciénaga Margen    # celdas de A que lindan con B y de B que lindan con A (de norte a sur)
consultar.py frontera Llanuras mar      # la costa de una región
consultar.py costa Vaelira              # tierra junto al mar y mar junto a tierra (candidatas a pasar a tierra)
consultar.py celda 540 190              # la celda de ese punto y sus vecinas  (o: celda --i 1715)
consultar.py lugares --cerca 540 190 --radio 40
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
- Una ruta por tierra se dibuja con puntos cada 5-15 km, todos en tierra (compruébalos con `celda`).

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
- Canon en rojo (área o envolvente de una región fuera de tolerancia): pide menos celdas o no lo hagas, y explícalo.
- *«celda N es mar»* al cambiar de región: solo las celdas de tierra tienen región.
