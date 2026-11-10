# Pedido a galivelop-image-generator: imágenes para el mapa de Helek (2026-11-10)

**Para:** una sesión en `galivelop-image-generator` (GVIG), que lo genera en local en la Deck. **De:** World-Maker-Fantasy
(WMF), tarea `MAP-19` de [`roadmap-mapas.md`](roadmap-mapas.md). **Estado:** pedido; GVIG decide modelo, semillas y
retoques. La nota de cada pieza la pone Álvaro.

Este documento se basta solo: no hace falta leer WMF para generar. Las rutas de WMF son de `00c0d8b7` (rama
`claude/pedido-mapa`). El estilo parte de la hoja de Tarkor de GVIG (`docs/marcas/tarkor/hoja.md` y `peticiones.md`,
rama `portal-marca`, 2026-11-10): **lo que esta hoja no dice, lo dice aquella**.

## 0. Para qué

El mapa del mundo (Helek, y en el juego la ventana de Berig) se dibuja hoy de dos formas:

- **En el juego** (`frontend/src/components/panels/InteractiveMap.tsx`, SVG): el fondo es una imagen exportada de
  Azgaar, con las fronteras encima.
- **En el editor propio** (`map-generator/visor/index.html`, canvas): cada celda va pintada con un color plano por
  bioma o por región. Los lugares son puntos.

`MAP-13` sustituye el fondo de Azgaar por un dibujo propio: costas con trazo, iconos de relieve, texturas de bioma y
etiquetas. Ese dibujo pasa al juego **solo cuando iguale a Azgaar** y Álvaro lo apruebe. `MAP-14` añade las capas
propias del juego. Este pedido trae las **piezas sueltas** con las que el código compone ese dibujo: texturas en
mosaico, iconos recortados y ornamentos. Así el mapa se pinta desde los datos (`helek.json`) y no es una imagen
cerrada: si se mueve una costa, el dibujo la sigue.

**Qué no se pide:** una imagen entera del mapa (no seguiría las ediciones), las letras de los nombres (van en Cinzel,
desde el código) ni el acabado ilustrado completo (`MAP-15`, más adelante).

## 1. La estética

**Un mapa pintado sobre la mesa de mando de madera.** El terreno se ve desde arriba, pintado a mano, mate y de
saturación contenida. El marco, la rosa de los vientos, la cartela y las fichas de los lugares son de la materia de la
interfaz: madera oscura, hierro y oro tallado. Así el mapa casa con el juego (dentro del juego, el fondo es madera:
hoja, decisión 1) sin parecer una pieza de marca.

- **Terreno:** vista cenital, plana, pintura mate con pincelada fina, luz rasante suave desde arriba a la izquierda
  (la de la hoja), sin sombras arrojadas. Saturación por debajo de la de Azgaar: el mapa sostiene encima fronteras,
  rutas y etiquetas.
- **Relieve y árboles:** iconos de cartografía pintada, en una vista ligeramente elevada (montañas y árboles se leen
  por su silueta, como en los mapas de fantasía clásicos). Todos con la misma luz desde arriba a la izquierda.
- **Ornamentos y fichas:** el bloque común de la hoja (madera, hierro, oro con pátina, piedra), oro como mucho en un
  10 % de la pieza: «la madera sostiene, el oro remata». Cuatro puntos cardinales en todo lo redondo.
- **Tierra de Berig:** aquí sí entra la arcilla `#E0703A`, que la hoja admite «solo como tierra de Berig en los
  paisajes», en las Llanuras del Viento Rojo.
- **Lo prohibido es lo de la hoja (§2, §3 y §6):** morado y violeta, luna, disco del sol, neón, cromo, destellos,
  personajes y criaturas, letras, Vaelira y el canon reservado. Además, en el mapa: ni monstruos marinos ni barcos
  (criaturas y escenas no van) ni rejilla de coordenadas pintada.

### Paleta del terreno

Parte de los colores de bioma de `map-generator/mundo/helek.json` (los de Azgaar), oscurecidos y apagados para que casen
con la madera. Son la guía de cada textura y van en su prompt:

| Bioma (`helek.json`) | Celdas | Dónde pesa | Tonos de la textura |
| --- | --- | --- | --- |
| 0 Marine (mar) | 952 | todo el borde | profundo `#1f3a52` → costero `#2f5a70` |
| 1 Hot desert | 351 | Llanuras del Viento Rojo | arena roja `#b0643a`, `#E0703A` en crestas, sombra `#6e3a22` |
| 2 Cold desert | 621 | Meseta del Orden, Ciénaga | piedra y grava `#8a8068`, `#6b6257`, `#a39a80` |
| 3 Savanna | 531 | dispersa | hierba seca `#a8a060`, `#7d7a44` |
| 4 Grassland | 432 | dispersa | pradera `#8f9e5c`, `#6f7d44` |
| 5 Tropical seasonal forest | 372 | El Margen Silencioso | copas `#5e7a34`, `#3f5a26` |
| 6 Temperate deciduous forest | 245 | Ciénaga Troncal | copas `#3f6a36`, `#2c4a28` |
| 7 Tropical rainforest | 44 | poca | copas densas `#355a26`, `#22401c` |
| 8 Temperate rainforest | 141 | Ciénaga, Cristal | musgo y copas `#3a5e3a`, `#26402a` |
| 9 Taiga | 208 | norte | coníferas `#34482a`, `#22301c` |
| 10 Tundra | 349 | Cristal Helado, Meseta | líquen y tierra helada `#7d6a4c`, `#9a8a6a` |
| 11 Glacier | 636 | Cristal Helado | hielo `#c8d8dc`, `#a8d8f0` en grietas, sombra `#7a98a8` |
| 12 Wetland | 238 | Ciénaga Troncal | agua parada y juncos `#2f4a34`, `#4a5e3a`, reflejos `#5a7a6a` |

## 2. Cómo pedirlas

- **Dos bloques comunes** (en inglés, delante de cada prompt):
  - **Terreno** (bloques M-A y M-B):

    > Hand-painted fantasy map terrain, seen from directly above. Matte painterly brushwork, fine detail, restrained
    > natural colour, soft warm light from the upper left, even exposure, calm and readable, no haze.

  - **Materia** (bloques M-C y M-D): el bloque común de `peticiones.md` §2, tal cual (madera `#332415`/`#46311d`,
    hierro `#171310`, oro `#b8862b` con pátina `#7a5a1e` y filos `#f2c45a`, piedra `#3a342d`).
- **Negativo** (para el campo `negative`, o pegado a mano en sd-cli): el de la hoja, más lo del mapa:

  > text, letters, words, numbers, labels, watermark, signature, people, face, hands, creature, sea monster, ship,
  > cartoon, flat vector, clipart, blurry, lens flare, light rays, glow haze, chrome, neon, purple, violet, pink,
  > moon, sun disc, cast shadow, grid, compass labels, cropped, tilted.

  En las texturas del bloque M-A se añade además `perspective view, horizon`.
- **Palabras vetadas** en el prompt: las de la hoja (§6), incluidas las negaciones. «no haze» es la única que se admite.
- **Mosaico:** las texturas se piden «seamless tileable» y se generan 2-3 semillas. La costura se arregla después,
  como dice `peticiones.md` §2. El código las repite como patrón: **sin motivos grandes que delaten la repetición**.
- **Recortes:** los iconos y ornamentos van sobre verde plano `#00ff00`, centrados, con un 15 % de margen libre, y se
  entregan como `-alpha.png`. Excepción: los iconos de bosque y ciénaga llevan verde, así que esos van sobre magenta
  plano `#ff00ff`, y se marca `[recorte magenta]`.
- **Perfiles:** los declarados en la hoja (§9). `textura` 1024×1024 e `icono` 512×512. Se añade uno solo:
  `cartela` 1024×512.
- **Modelo:** lo decide GVIG (columna «Modelo» como en `peticiones.md`: **K** = klein basta; **K?** = probar klein, puede
  hacer falta uno mejor; **M** = modelo mejor o retoque a mano).

## 3. Piezas

Orden: primero la **prueba de estilo** (#1-#3). Con el sí de Álvaro a esas tres, el resto en el orden de los bloques.

### Prueba de estilo

| # | Pieza | Perfil | Prompt (tras el bloque de terreno) | Notas |
| --- | --- | --- | --- | --- |
| 1 | Arena roja (desierto cálido) | `textura` | Seamless tileable texture of wind-rippled red sand dunes seen from directly above, colours #b0643a and #6e3a22 with crests catching light in #E0703A, long parallel ripples, scattered dark pebbles, edge to edge. | **K**. Fija el estilo de todo el terreno. |
| 2 | Hielo (glaciar) | `textura` | Seamless tileable texture of a glacier surface seen from directly above, pale ice #c8d8dc with blue crevasses #a8d8f0 and cool shadows #7a98a8, wind-packed snow streaks, edge to edge. | **K**. El azul del hielo, sin brillo: nada brilla por sí mismo. |
| 3 | Montaña (icono) | `icono` | A single rocky mountain peak as a painted map icon, seen slightly from above, dark stone #6b6257 and #3a342d with a lit left face, thin snow on the summit, centred on a perfectly flat bright green background, 15 percent empty margin on every side. | **K?** `[recorte]`. Fija el estilo de los iconos. 6-8 semillas. |

### Bloque M-A — texturas de bioma (`MAP-13`)

Una por bioma, más dos del mar. El código rellena cada celda con la textura de su bioma y funde los bordes.

| # | Pieza | Perfil | Prompt (tras el bloque de terreno) | Notas |
| --- | --- | --- | --- | --- |
| 4 | Mar profundo | `textura` | Seamless tileable texture of deep open sea seen from directly above, dark blue #1f3a52 with faint long swell lines in #2f5a70, calm, edge to edge. | **K**. La parte del mapa con más superficie: muy calma. |
| 5 | Mar costero | `textura` | Seamless tileable texture of shallow coastal water seen from directly above, blue green #2f5a70 with lighter sandy shallows #5a7a7a and fine wave lines, edge to edge. | **K**. Se funde con el #4 según la distancia a la costa. |
| 6 | Pedregal (desierto frío) | `textura` | Seamless tileable texture of a dry stony plateau seen from directly above, grey brown gravel #8a8068 and #6b6257 with flat cracked rock plates #a39a80, sparse dry tufts, edge to edge. | **K**. La Meseta del Orden. |
| 7 | Sabana | `textura` | Seamless tileable texture of dry savanna grass seen from directly above, straw #a8a060 and olive #7d7a44, scattered small round shrubs, edge to edge. | **K**. |
| 8 | Pradera | `textura` | Seamless tileable texture of open grassland seen from directly above, green #8f9e5c and #6f7d44, soft wind-combed patches, edge to edge. | **K**. |
| 9 | Bosque tropical estacional | `textura` | Seamless tileable texture of a dense forest canopy seen from directly above, rounded tree crowns in #5e7a34 and #3f5a26 with a few yellowing crowns, edge to edge. | **K**. El Margen Silencioso. |
| 10 | Bosque caducifolio | `textura` | Seamless tileable texture of a broadleaf forest canopy seen from directly above, crowns in #3f6a36 and #2c4a28, small clearings, edge to edge. | **K**. |
| 11 | Selva | `textura` | Seamless tileable texture of a very dense jungle canopy seen from directly above, tightly packed crowns in #355a26 and #22401c, edge to edge. | **K**. Pocas celdas: si sale igual que el #10 más oscuro, vale. |
| 12 | Bosque lluvioso templado | `textura` | Seamless tileable texture of a mossy rainforest canopy seen from directly above, crowns in #3a5e3a and #26402a with damp dark gaps, edge to edge. | **K**. |
| 13 | Taiga | `textura` | Seamless tileable texture of a conifer forest seen from directly above, pointed crowns in #34482a and #22301c, patches of thin snow, edge to edge. | **K**. |
| 14 | Tundra | `textura` | Seamless tileable texture of tundra seen from directly above, lichen and frozen earth #7d6a4c and #9a8a6a, frost cracks in a polygon pattern, small meltwater pools, edge to edge. | **K**. Cristal Helado y la Meseta. |
| 15 | Ciénaga | `textura` | Seamless tileable texture of a wetland seen from directly above, still dark water #2f4a34 between reed beds #4a5e3a, fallen trunks, muted reflections #5a7a6a, edge to edge. | **K**. Ciénaga Troncal: troncos caídos sí, raíces gigantes no (canon sin fijar). |

### Bloque M-B — iconos de relieve y vegetación (`MAP-13`)

Se reparten por las celdas según la altura (`h`) y el bioma, en lugar de los iconos de Azgaar. **Tres variantes de
cada uno** (tres semillas que salgan bien), para que no se repitan iguales. Todos con el bloque de terreno y el final
común: *«centred on a perfectly flat bright green background, 15 percent empty margin on every side»* (o magenta, donde
se indica).

| # | Pieza | Perfil | Prompt | Notas |
| --- | --- | --- | --- | --- |
| 16 | Cordillera (grupo de 3 picos) | `icono` | A small range of three rocky peaks as a painted map icon, seen slightly from above, dark stone #6b6257 and #3a342d, lit left faces, snow on the tallest. | **K?** `[recorte]`. Para las celdas más altas. |
| 17 | Colina | `icono` | A low rounded grassy hill as a painted map icon, seen slightly from above, olive #6f7d44 with a lit left side and a soft shaded right side. | **K** `[recorte magenta]`. |
| 18 | Colina pedregosa | `icono` | A low rocky hill as a painted map icon, seen slightly from above, grey brown stone #8a8068 and #6b6257, lit left side. | **K** `[recorte]`. Meseta y desiertos fríos. |
| 19 | Duna | `icono` | A single crescent red sand dune as a painted map icon, seen slightly from above, #b0643a with a lit crest in #E0703A and a shaded hollow #6e3a22. | **K** `[recorte]`. Llanuras. |
| 20 | Pico helado | `icono` | A sharp ice-covered peak as a painted map icon, seen slightly from above, pale ice #c8d8dc with blue shadows #7a98a8 and dark rock showing at the base. | **K?** `[recorte]`. Cristal Helado. |
| 21 | Árbol caducifolio (grupo) | `icono` | A small cluster of three broadleaf trees as a painted map icon, seen slightly from above, crowns #3f6a36 and #2c4a28, lit from the upper left. | **K** `[recorte magenta]`. |
| 22 | Conífera (grupo) | `icono` | A small cluster of three pointed conifers as a painted map icon, seen slightly from above, #34482a and #22301c, a touch of snow. | **K** `[recorte magenta]`. |
| 23 | Árbol tropical (grupo) | `icono` | A small cluster of tall trees with wide flat crowns as a painted map icon, seen slightly from above, #5e7a34 and #3f5a26. | **K** `[recorte magenta]`. El Margen. |
| 24 | Juncos | `icono` | A small clump of reeds standing in dark still water as a painted map icon, seen slightly from above, reeds #4a5e3a, water #2f4a34. | **K** `[recorte magenta]`. Ciénaga. |
| 25 | Roca suelta | `icono` | A small group of weathered standing rocks as a painted map icon, seen slightly from above, dark stone #3a342d, lit left faces. | **K** `[recorte]`. Para salpicar desiertos y tundra. |

### Bloque M-C — fichas de lugares (`MAP-13`)

Hoy los lugares son puntos. Pasan a ser **fichas talladas**: un disco pequeño de hierro con aro de oro y un relieve
que dice qué es. Los tipos salen de los lugares de la enciclopedia del juego (`map-generator/enciclopedia.py`:
asentamiento ×10, hito ×7, interior ×6, costa ×4, ruinas ×3…). Todas con el bloque de materia y el final común de
recorte en verde. Se ven a 24-40 px: **silueta clara antes que detalle**.

| # | Pieza | Perfil | Prompt (tras el bloque de materia) | Notas |
| --- | --- | --- | --- | --- |
| 26 | Ficha base | `icono` | A small round map token seen straight on, a disc of dark forged iron with a thin ring of old carved gold and four tiny gold points at top, bottom, left and right, the centre empty and slightly recessed. | **K** `[recorte]`. La base de todas: las demás, img2img desde esta (0,35-0,45). |
| 27 | Capital | `icono` | The same round iron map token with a gold ring, in its centre a raised relief of a fortified keep with three towers in old gold. | **K?** `[recorte]`. Algo mayor en el código. |
| 28 | Asentamiento | `icono` | The same round iron map token, in its centre a raised relief of a small wooden palisade with two roofs, in old gold. | **K** `[recorte]`. |
| 29 | Puerto | `icono` | The same round iron map token, in its centre a raised relief of a wooden pier and a mooring post, in old gold. | **K** `[recorte]`. Lugares de tipo costa. |
| 30 | Ruinas | `icono` | The same round iron map token, in its centre a raised relief of two broken stone pillars, in dark stone and old gold. | **K** `[recorte]`. |
| 31 | Hito | `icono` | The same round iron map token, in its centre a raised relief of a tall standing stone obelisk, in dark stone with a gold edge. | **K** `[recorte]`. |
| 32 | Refugio | `icono` | The same round iron map token, in its centre a raised relief of a low stone hut with a smoke line, in old gold. | **K** `[recorte]`. |
| 33 | Puesto de control | `icono` | The same round iron map token, in its centre a raised relief of a wooden watchtower with a barrier, in old gold. | **K** `[recorte]`. |
| 34 | Mirador | `icono` | The same round iron map token, in its centre a raised relief of a rocky crag with a small platform on top, in old gold. | **K** `[recorte]`. |
| 35 | Punto de agua | `icono` | The same round iron map token, in its centre a raised relief of a stone well with a blue crystal gem #4aa8d8 as the water. | **K** `[recorte]`. La gema es el único cristal de las fichas. |
| 36 | Cantera | `icono` | The same round iron map token, in its centre a raised relief of stacked cut stone blocks and a pick, in old gold. | **K** `[recorte]`. |
| 37 | Cruce y paso | `icono` | The same round iron map token, in its centre a raised relief of two crossing paths, in old gold. | **K** `[recorte]`. Cruces, cañones y pasos. |
| 38 | Pasto y caza | `icono` | The same round iron map token, in its centre a raised relief of a curved horn and grass blades, in old gold. | **K** `[recorte]`. Pasto estacional, pradera, coto de caza. |

### Bloque M-D — cartografía y marco (`MAP-13`)

| # | Pieza | Perfil | Prompt (tras el bloque de materia) | Notas |
| --- | --- | --- | --- | --- |
| 39 | Rosa de los vientos | `icono` | A compass rose seen straight on, a four-pointed star in old carved gold with its long points at top, bottom, left and right and four shorter points between them, a small ring of dark forged iron at the centre, crisp bevels. | **K?** `[recorte]`. Eco de la estrella y los cuatro puntos del emblema. Las letras N/S/E/O, en código. |
| 40 | Cartela | `cartela` 1024×512 | An empty ornamental cartouche seen straight on, a wide rounded plaque of dark wood planks framed by forged iron with gold corner fittings and four rivets, the centre plain and calm for a title. | **K** `[recorte]`. El nombre de la región va encima, en Cinzel. |
| 41 | Barra de escala | `banda` 1024×256 | A horizontal map scale bar seen straight on, a long thin strip of dark forged iron divided into five equal segments by small gold studs, gold end caps. | **K** `[recorte]`. Los números, en código. |
| 42 | Marco del mapa (lado) | `banda` 1024×256 | Seamless horizontally tileable border strip seen straight on, dark wood plank with a forged iron edge and a thin bevelled gold line along the inner side, matte. | **K**. Mosaico horizontal; el código lo gira para los cuatro lados. |
| 43 | Marco del mapa (esquina) | `icono` | A square corner fitting seen straight on, forged iron with a small four-pointed gold star at its centre and gold bevelled edges, made to join two wood border strips at a right angle. | **K** `[recorte]`. |
| 44 | Trazo de costa | `textura` | Seamless tileable texture of fine concentric wave lines on dark blue water #1f3a52, lines in #5a7a7a, evenly spaced, seen from directly above, edge to edge. | **K**. El código lo usa como relleno de una franja junto a la costa (el «contorno de olas» de los mapas clásicos). Va con el bloque de terreno, no el de materia. |

### Bloque M-E — capas del juego (`MAP-14`)

Capas que se superponen al terreno con transparencia. El código las pinta con opacidad baja: **mucho contraste
dentro de la textura y poco color**.

| # | Pieza | Perfil | Prompt | Notas |
| --- | --- | --- | --- | --- |
| 45 | Tormenta magnética | `textura` | (bloque de terreno) Seamless tileable texture of swirling dust storm bands seen from directly above, rust #8a4a2a and iron grey #52626f streaks curving around small dark cores, edge to edge. | **K?** Llanuras del Viento Rojo. Sin rayos ni brillo (y nada morado: la luz morada es canon reservado). |
| 46 | Zona de peligro | `textura` | (bloque de terreno) Seamless tileable texture of dark scorched ground with cracked dry earth, #3a2a1e and #6e3a22, irregular patches, edge to edge. | **K**. Se pinta al 30-40 % sobre el bioma. |
| 47 | Niebla de lo no explorado | `textura` | (bloque de terreno) Seamless tileable texture of soft drifting low cloud seen from directly above, warm grey #8a8068 and #a39a80, gentle billows, edge to edge. | **K**. Para lo que el jugador aún no conoce, si se usa. |
| 48 | Estandarte de clan (genérico) | `icono` | (bloque de materia) A small vertical banner on a short iron pole seen straight on, plain dark cloth #46311d with a gold fringe at the bottom edge, the cloth face empty. | **K** `[recorte]`. El símbolo de cada clan lo pone el código (o un pedido aparte, cuando el canon lo fije). |

## 4. Entrega

- En GVIG: `examples/tarkor/entrega/mapa/`, con el número y el nombre: `m01-arena-roja.png`, `m03-montana-a-alpha.png`,
  `m03-montana-b-alpha.png`… Las variantes, con `-a`, `-b` y `-c`.
- De ahí, WMF las copia a `map-generator/visor/piezas/` (el editor) y, cuando `MAP-13` pase al juego, a
  `frontend/src/assets/mapa/`. Las copia una sesión de WMF; GVIG no toca WMF.
- Una hoja de contactos por bloque (`gimg sheet`) para que Álvaro las puntúe.

## 5. Aceptación

- **La nota la pone Álvaro** (de 1 a 10 por pieza). El agente no da piezas por buenas.
- La prueba de estilo (#1-#3) se valora **dentro del mapa**, no suelta: WMF compone un trozo de las Llanuras con
  ellas en el editor, al lado de la misma vista de Azgaar.
- Una textura vale si, repetida 4×4, no se ve la costura ni un motivo que se repita. Un icono vale si se lee a 24 px en
  gris.
- Todo lo de este pedido queda en local (Deck), sin servicios de pago.
