# r20: dos elementos por tipo (flora, lugar, objeto, raza), medidos en su banner (`IMG-22`)

Ocho prompts `prompts/r20-<slug>.txt` (303-347 palabras), escritos por cuatro subagentes (`sonnet`, uno por tipo) solo con
[`pautas.md`](../pautas.md) v4, la [plantilla](../plantilla-prompt.md), [`r18-forma.md`](r18-forma.md) como ejemplo del
método y el banner de cada elemento (F10, F10b: rejilla de 100 px con `ffmpeg drawgrid`, recortes aclarados, medias de
color), sin generar. Borrador txt2img a 640x256, 8 pasos, sin boceto, con el encuadre de cada tipo
([plan](../plan-fotorreal.md#img-22--pautas-con-flora-lugar-objeto-y-raza-a--m)): la planta en su paisaje a 50 mm, el lugar
por capas a 24 mm, el objeto como bodegón (lente propuesta 50 mm, `mundo.json` no tiene `porTipo.item`), la raza como
figura entera a 85 mm. `r20-tipos.tsv` lleva las ocho filas; las semillas (3 y, si cabe, 7, R1) las pone quien lanza.
Las pautas propuestas (`FL*`, `L*`, `O*`, `R-Z*`) están en 🔬 hasta el veredicto de la ronda en
[`resultados.md`](resultados.md); las que acierten pasan a su sección de `pautas.md`.

**Hallazgo al medir:** `pastos-de-la-deriva-dia-primavera-banner.png` y `…-dia-verano-banner.png` son el mismo archivo
(md5 idéntico): las condiciones `estacion:` de la ficha no tienen referencia propia.

## Flora

Prompts `prompts/r20-cardo-brujula.txt` (342 palabras) y `prompts/r20-salvia-del-polvo.txt` (341), escritos solo con
[`pautas.md`](../pautas.md) v4 (§1 estructura; F1, F2, F3, F6, F7, F8, F9, F10, F10b, F10c), la
[plantilla](../plantilla-prompt.md) y la medida de cada banner (1983x793, rejilla de 100 px con `ffmpeg drawgrid`,
recortes aclarados con `crop,eq`, medias de color con `crop,scale=1:1`). Medidas a ojo sobre la rejilla (error ~10-15 px).
Sin generar. Cierran con la línea fija `Style/Mood` de `estilos.fotorreal` y el acabado de flora (50 mm).

### Encuadre del tipo

**La planta en su paisaje a 50 mm, no macro; escena completa, no sujeto sobre liso** (decisión del
[plan](../plan-fotorreal.md), `IMG-22`; guía visual §7: flora = especie en su suelo; el acabado `porTipo.flora` de
`mundo.json` pide 50 mm). Lo confirman los dos banners: ninguno es un sujeto aislado, son una escena a 3 capas (suelo,
media distancia, horizonte o pared) con el sujeto ocupando una fracción grande pero **repartida**. Consecuencias
sobre §1 de `pautas.md`:

- El orden 1-8 se mantiene, pero **«pose» pasa a ser «cómo crece»** (erguida y rígida / reptante) y **«compañía» son
  las otras plantas de la misma especie** (cuántas, en qué diagonal).
- **No hay fondo liso (P3, P4, P6 no aplican)**: el borrador sale en una sola pasada con el paisaje; el sujeto no se
  recorta ni se monta.
- El encuadre dice **dónde cae el horizonte y qué ocupa cada capa en fracciones de la imagen** (F10 aplicado al paisaje,
  como en el prompt de lugar de `r20-pastos-de-la-deriva.txt`), porque el modelo coloca bien «a third», «a seventh».

### cardo-brujula

Referencia `backend/uploads/images/flora/cardo-brujula-banner.png`; canon: `worldCatalog.ts` 6941/11473 y *Las Agujas Imán*.
Punto de partida, la ficha antigua (macro de 100 mm, «faint violet tint», «like an artichoke forged from metal»).

#### Medidas en el banner (píxeles)

| Qué | Píxeles | Relación |
|---|---|---|
| Horizonte (borde de la llanura) | y≈500 de 793 | **0,63 desde arriba = ~1/3 desde abajo** |
| Planta más cercana (suelo y≈690 a punta del filamento y≈62) | ~630 | **0,79 del alto de la imagen**; ancho ~300 = **0,15** |
| Planta cercana: capullo (con espinas) | 225 de ancho x 220 de alto (x 1365-1590, y 120-340) | ancho ≈ **2 x el del tallo** (tallo ~110 bajo el capullo) |
| Planta cercana: tallo (y 340-690) | ~350 de alto, ensanchado en raíces curvas de ~200 en la base | **capullo/tallo ≈ 0,63** (capullo 2/3 del tallo); capullo = 0,39 del alto base-capullo |
| Filamento sobre el capullo | sube ~60 y se curva ~160-250 de lado | ~1 x el ancho del capullo; **fino, desnudo, acaba en una ramita bífida**; en todas las plantas se dobla hacia la **izquierda** |
| Otras 6 plantas (alto base→capullo, relativo a la cercana = 1) | 1665: 0,42; 630: 0,53; 1235: 0,25; 435: 0,27; 1055: 0,18; 325: 0,07 | **7 plantas** en una diagonal que baja de la cercana (derecha) a la lejana (izquierda), siguiendo el pie del acantilado; separadas ~150-300 px |
| Acantilado | de x≈1000 arriba a x≈700 abajo (borde inclinado) | **~35 % de la imagen**, toda la mitad derecha, de arriba a abajo; arenisca en capas |
| Cielo | x 0-1000, y 0-500 | ~25 %, liso, sin nubes |
| Mesetas del horizonte | cimas y≈420-450, hasta ~80 px sobre la llanura | **~1/8 del alto**; la grande a x≈70-190, otras 4-5 más pequeñas y en bruma |
| Suelo | y 690-793 roca roja agrietada (13 %), grava y matas hasta y≈500 | ~40 % en total |
| Rosetas de hoja ancha y lanosa | 250 de ancho x 100-180 de alto | **~1/6 del alto de la planta cercana**; tres grupos (x 650-880, 1220-1450, 1700-1980) |

#### Colores por material (F10b)

Dominante: ámbar-naranja del atardecer (cielo `#ca9562`, llanura `#a76844`). Medias de recorte, que **sí** discriminan
aquí (luminancia ~70/255): capullo `#45413e`, cresta de espinas `#5d5044`, tallo `#453830`; acantilado en sombra
`#3a1b14`, grava `#6c3a26`, rosetas `#4c3e2a`, hierba `#6f4b30`, mesetas `#985c3f`. Descontada la dominante cálida:

- capullo y tallo: **gris carbón neutro** (R≈G≈B, apenas cálido; **no hay violeta**), con **destellos plata muy claros** en el borde de las escamas y en las espinas; el tallo, con **vetas óseas pálidas**;
- acantilado **rojo óxido profundo**, grava **rojo ladrillo**, llanura **naranja terracota**, mesetas **rosa melocotón pálido** por la bruma;
- rosetas **verde plata**; hierba **dorado paja**; maleza **verde oliva grisáceo**.

#### Qué dice el prompt y por qué

| Decisión | Pauta |
|---|---|
| Orden: encuadre con horizonte a 1/3, suelo, fila diagonal de plantas, rasgos, entorno por capas, luz | §1; F10 aplicado al paisaje |
| «the largest ... three quarters of the image tall and a seventh of its width» y «the others shrinking toward the far left until the last is a tiny speck» (sin decir cuántas) | F1 (medida del propio sujeto) + F9 (la cuenta de 7 no se pide: «a diagonal row») |
| Capullo: «two thirds as tall as the stem ... twice as wide as that stem» | F1: la relación capullo/tallo medida, no «large bud» |
| Ancla vegetal única, «a globe artichoke bud, only built of dark charcoal-grey, glossy, blade-like scales that each end in a sharp spike» | F6 (una vez, con su diferencia); sólo para la silueta del capullo, sin «forged from metal» (F8: un material no se compara con un objeto) |
| Color por material: «charcoal-grey» + «bright silver glints», tallo con «pale bone-coloured sinews» | F3, F10b (sin violeta, que el canon pedía y el banner no tiene) |
| Filamento: «single thin, bare, dark wiry ... arches left about as far as the bud is wide ... fine forked twig» | F1, F2 (dice dónde empieza y acaba); la dirección izquierda es la del banner (P8 dice que la dirección no se controla: 🔬) |
| Tallo «twisted like a wrung rope, flaring into curved roots» (forma, no «rigid» del canon) | F7b: se describe la forma del banner, no la del lore |
| Cada capa con su fracción y color (acantilado «right half ... edge sloping down toward the left»; mesetas «an eighth»; cielo «smooth deep amber») | F10, F3 |
| Luz: sol bajo ámbar desde la derecha, rim en espinas y bordes (el capullo está iluminado por la derecha), sombras a la izquierda | P5 (dirección nombrada); lo visual manda |
| Sin «macro», sin «artichoke forged», sin «violet» | F8, §5 |

#### Contradicciones con el canon (se sigue el banner, §5)

- Flor **gris con matiz violáceo** (canon, decisión de la usuaria 2026-10-25): en el banner es carbón neutro con destellos plata; el violeta no se ve.
- **Tallo rígido** (canon): en el banner es retorcido y curvo, con raíces que ensanchan; el rígido es el conjunto, no el tallo.
- **Campo de rocas negras imantadas, a sotavento** (canon, `agujas-iman`): el banner pone un acantilado rojo y una llanura con mesetas; ya estaba en la ficha como propuesta de lore.
- Altura **~2 m** (ficha): con las rosetas (~30-40 cm) como escala, la planta cercana sale de ~1,8-2 m; coincide.
- «Bud como una cabeza humana»: el capullo sale de ~0,4 m, algo mayor; no se pide en el prompt (se pide la proporción con el tallo).

### salvia-del-polvo

Referencia `backend/uploads/images/flora/salvia-del-polvo-banner.png`; canon: *Mata baja de hojas grises y aroma amargo;
crece en hondonadas y zonas de sombra* (`llanuras-del-viento-rojo.md` l.140), el catálogo la pone en la Hondonada del Eco
(`worldCatalog.ts` 11296, «crece pegada al suelo en hondonadas y rincones de sombra»); el manojo, «hojas grises secas».
No hay ficha.

#### Medidas en el banner (píxeles)

| Qué | Píxeles | Relación |
|---|---|---|
| Punto de fuga del suelo | y≈370 de 793 | **0,47 desde arriba**; cámara a ras del suelo, gran angular (el banner es de unos 24 mm, no 50) |
| Hueco de cielo entre las paredes | x 605-890 arriba (285), x 680-830 en y 280 | **~1/7 del ancho** arriba; ~4 % del área; nubes blandas, gris perla |
| Pared izquierda | x 0-600 arriba, baja hasta y≈330 | **~1/3 del ancho** arriba |
| Pared derecha | x 890-1983 arriba, hasta y≈350 | **más de la mitad del ancho** (55 %), con la planta subiendo |
| Suelo (arcilla agrietada en placas) | y 400-793 | **~1/3 inferior** es primer plano; las piedras sueltas más grandes ~60-100 px |
| Masa de la planta | x 800-1983, de y≈290 (a media pared) a y≈700 | **~3/5 del ancho** (60 %), **~1/2 del alto** (410 px de 793) |
| Hojas más grandes | ~150 de largo x ~65 de ancho (x 1375-1460, y 625-775) | **2,3-2,5 de largo/ancho**; **~2 x** el ancho de la piedra grande (~70) |
| Tallos | finos, 5-10 px, **largos y reptantes**, pálidos | trepan la pared derecha en hebras (x 1250-1750) **hasta y=0**; cruzan el suelo a la izquierda (x 400-830, y 560-690) con 2-3 grupos pequeños de hojas |
| Distancia | la masa se vuelve alfombra oscura de hojas diminutas hacia el punto de fuga | sí |

#### Colores por material (F10b)

Escena muy oscura (luminancia ~20/255): hoja `#161515`-`#333435`, suelo `#23110d`, pared `#291611`; no discriminan, igual
que r18. Se aclaró el recorte (`eq=brightness=0.12:gamma=1.5`) y se decidió a ojo, como en r18; la dominante es la sombra
fría (no ámbar), el cielo es perla (`#d8d3d1`, gris casi neutro):

- hojas **azul-gris pizarra** con brillo frío y **manchas pardo-óxido** repartidas (no «grises secas» ni «verde grisáceo»);
- tallos **gris ceniza pálido**; suelo **rojo ladrillo oscuro**, piedras **pardo óxido**; paredes **rojo óxido profundo**
  en vertical fracturado; hierba seca de los bordes **pajiza**; cielo **gris perla** con luz crema; fondo lejano **rosa óxido** en bruma.

#### Qué dice el prompt y por qué

| Decisión | Pauta |
|---|---|
| Encuadre a ras de suelo mirando por el fondo de un cañón; punto de fuga bajo la mitad | §1; F10 en el paisaje |
| Planta con medida: «three fifths of the image wide and half its height»; hojas «two and a half times as long as wide», «twice as long as the largest stone is wide» | F1 (medida propia y de la escena, sin adjetivos) |
| «one creeping plant», sin ancla | F6b/F6c: ninguna planta común tiene hoja lanceolada moteada en enredadera; el ancla traería otra silueta |
| Forma de la hoja con palabras de forma y material («lance-shaped, pointed tip, slate blue-grey with a cool sheen, scattered rust-brown blotches») | F3, F7, F8 |
| Hebras: «climbing the wall in thin strands almost to the top of the frame»; «A few single stems ... wander across the left foreground» | F2 (dice dónde empieza y acaba lo continuo) |
| Paredes con fracciones de ancho (1/3, más de la mitad) y rendija de cielo 1/7 | F10 |
| Luz: «soft overcast light falls from the slot ... deep shade» (el banner es de luz difusa, sombría) | P5; §5 (lo visual manda sobre la línea Style) |
| Sin «dust», «mata», «low shrub» | F7b: «low mass» describe la forma del banner, no la del lore |

#### Contradicciones con el canon (se sigue el banner)

- **«Mata baja de hojas grises»**: el banner es una **enredadera reptante y trepadora** (tallos de varios metros sobre el suelo y la pared) con hojas **azul-gris con manchas óxido**, no una mata.
- «Hojas grises secas» (manojo): las del banner son **frescas, lanceoladas y moteadas**.
- **Hondonada «pegada al suelo»**: la escena es un cañón profundo de paredes que superan varias veces la altura de la masa de plantas, más que una hondonada; el banner trepa por la pared, el canon dice pegada al suelo.
- Aroma amargo, uso medicinal: no visuales, no se piden.

### Dificultades nuevas (lo que la guía no dijo cómo hacer para flora)

1. **La plantilla de §1 está hecha para un sujeto; en flora el sujeto es plural y repartido.** El cardo son 7 plantas en
   diagonal con 4 tamaños y la salvia, una masa sin contorno. No hay «alto/ancho del cuerpo»; se probó el alto de la
   mayor frente a la imagen, el ancho de la masa y la relación entre partes (capullo/tallo, hoja/piedra). No se sabe cuál
   fija el modelo mejor (F10 sólo habla de animales).
2. **Medidas contra qué.** Sin el cuerpo entero como denominador, las medidas son contra la imagen («un séptimo del
   ancho») o contra un objeto de escala (la piedra, la roseta). La guía no dice cuál es más fiable ni cuál usar para
   decir el tamaño de una hoja; se usó la piedra más grande (visible en las dos).
3. **Sin ancla de silueta para planta.** F6/F6b piden un animal real; aquí no hay animal. Se usó un ancla vegetal
   (alcachofa) sólo para el capullo del cardo; la salvia no lleva. Falta una regla de si el ancla vegetal vale y si la
   alcachofa traerá su verde (F6b: «el ancla gana a su diferencia»).
4. **Dos materiales en una pieza (F3 sin cubrirlo).** El capullo gris con destellos plata y el tallo con vetas óseas son
   dos materiales dentro de una parte; la guía ya lo apunta (§6, «Dos materiales en una pieza»).
5. **El color del paisaje manda sobre el del sujeto, y F10b no distingue en escena oscura.** El cardo está a luz ámbar
   (la media se calienta); la salvia está en sombra (todo ~20/255, la media no separa azul de gris). Se aclaró y se
   decidió a ojo (como r18). La línea fija `Style` pide «soft golden-hour rim light, warm atmospheric haze», que
   contradice el banner de la salvia (nublado, sombrío): no se tocó la línea (es fija), el prompt trae la luz
   nublada; habrá que ver cuál gana.
6. **Contar plantas.** F9 dice no pedir cuentas; el cardo son 7 y se pidió «a diagonal row» con la mayor y la última
   (tamaños), no el número. No se sabe si el modelo distingue «una fila» de «dos o tres».
7. **La dirección del filamento (todos a la izquierda) frente a P8** (la dirección no se controla). Se pide «arches left»;
   si sale a la derecha, no es error de la pauta, es P8.
8. **Un 50 mm que el banner no es.** La salvia es un gran angular a ras de suelo (24 mm); el acabado de flora pide 50 mm
   y la ficha y el plan, «planta en su paisaje». Se mantuvo el acabado fijo y se pidió el encuadre en palabras («very
   low camera angle ... along the floor of a deep, narrow canyon»); falta saber si el modelo hace caso al encuadre
   escrito frente al 50 mm.
9. **El cañón ocupa casi toda la imagen y el sujeto es el 10-15 % del contorno.** En la salvia, ¿se pide la planta
   primero (F1, §1) o el paisaje primero? Se puso el encuadre y el suelo antes que la planta (lo que la ve el espectador
   primero) y la planta, tercera frase; no se sabe si el modelo le da peso a la planta con tantas capas delante.

### Pautas propuestas para la sección de flora de `pautas.md`

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| FL1 | **La planta se pide en su paisaje, no aislada, con cada capa en fracciones de la imagen** («horizon about a third of the way up», «cliff fills the right half», «sky slot a seventh wide»); sin fondo liso, sin montaje. | 🔬 | r20: cardo y salvia |
| FL2 | **La proporción se da entre las partes de la planta** (capullo/tallo 2/3, ancho capullo = 2 x tallo; hoja 2,5 x larga que ancha) **y contra un objeto de escala de la propia escena** (la piedra), no con adjetivos («large bud»). | 🔬 | r20: cardo y salvia |
| FL3 | **El tamaño del sujeto se dice como fracción de la imagen y la fila de ejemplares por tamaños**, no por número («a diagonal row ... the largest three quarters of the image tall, the last a tiny speck»), por F9. | 🔬 | r20: cardo |
| FL4 | **Ancla vegetal sólo para el capullo/la flor, una vez y con su diferencia** (alcachofa «only built of charcoal-grey ... scales»); la planta entera sin ancla. | 🔬 | r20: cardo (la salvia no la lleva) |
| FL5 | **Una planta que no tiene silueta común (enredadera moteada) se describe por forma de hoja, tallo y recorrido, sin ancla** («lance-shaped, 2,5 x as long as wide, climbing the wall in thin strands»). | 🔬 | r20: salvia |
| FL6 | **El color de la hoja y de la flor se mide en el banner descontando la luz de la escena** (ámbar en el cardo, sombra fría en la salvia); en escena oscura se aclara el recorte y se decide a ojo (F10b, r18). | 🔬 | r20: ambos |
| FL7 | **Cuando el banner contradice el texto del canon (violeta, mata baja, tallo rígido), se pide la forma del banner** y la contradicción va a la lista de lore (§5). | 🔬 | r20: ambos |
| FL8 | **La luz del prompt (nublada, sombría) y la línea fija `Style` (golden-hour) pueden chocar**: medir cuál gana en la salvia antes de tocar la línea. | 🔬 | r20: salvia |

## Lugar

Prompts `prompts/r20-pastos-de-la-deriva.txt` (330 palabras) y `prompts/r20-cataratas-madre-fango.txt` (329), escritos con
[`pautas.md`](../pautas.md) v4, la [plantilla](../plantilla-prompt.md) y r18 como modelo de medida. Banners de 1983x793
(2,5:1, la misma relación que el borrador de 640x256), medidos con rejilla de 100 px (`ffmpeg drawgrid`) a ojo (error de
10-15 px) y medias de color de recortes (`crop,scale=1:1`). Sin generar. **Aviso:** `pastos-de-la-deriva-dia-primavera-banner.png`
y `…-dia-verano-banner.png` son **el mismo archivo** (md5 `ac0101a8…`), así que no se pudo separar lo fijo de lo
estacional; el prompt describe esa imagen única.

### Encuadre del tipo

Lugar por capas, gran angular 24 mm, cámara baja: primer plano con textura → media distancia → horizonte
(§1 punto 6 de `pautas.md`; `plan-fotorreal.md` IMG-22; `encuadres.fotorreal` y acabado `location` de `mundo.json`). Por qué:
el modelo coloca bien lo que se le dice «de abajo arriba» y los dos banners están compuestos así (primer plano oscuro y
con textura, plano medio, horizonte brumoso). El prompt abre con el encuadre y **la altura del horizonte en fracción**
(F10), da a cada capa su fracción del alto y cierra con la luz y la línea `Style/Mood`. No hay sujeto ni ancla
(el lugar es el sujeto); no hay pose ni compañía.

### pastos-de-la-deriva

| Qué | Píxeles | Relación |
|---|---|---|
| Horizonte (cambio cielo/llanura, y≈185) | 185 de 793 | **0,23 de la altura** desde arriba |
| Cielo | y 0-185 | 23 % |
| Llanura lejana, hasta ~y 300 | 115 | 15 % |
| Plano medio (hierba y arbustos, y 300-560) | 260 | 33 % |
| Primer plano (tierra, grava, rocas, y 560-793) | 233 | 29 % |
| Meseta de arenisca (x 1240-1983, y 103-205) | 743 de ancho x 100 de alto | **37 % del ancho, 0,13 de la altura**, solo a la derecha; dos mesetas sueltas (x 820-890 y 960-1060, ~50 px de alto) |
| Roca grande, abajo a la derecha (x 1535-1810, y 600-770) | 275 x 170 | **0,14 del ancho**; otras tres rocas a la izquierda (x 185-695), 0,06-0,08 |
| Arbustos secos oscuros (x 250-460, y 390-545; x 0-220) | ~210 de ancho | **0,1 del ancho**, los dos mayores a la izquierda |
| Senda de tierra | de (1250, 790) a (1600, 340) | curva de abajo al centro-derecha hacia arriba a la derecha |
| Luz | cielo más claro y amarillo a la izquierda (x 0-800, y 100-185), oscuro rosado a la derecha | **sol bajo fuera de cuadro a la izquierda**, contraluz de polvo; sombras largas a la derecha |

Tercios horizontales: izquierda, arbustos grandes y rocas y cielo más brillante; centro, hierba con polvo y el vacío
hasta el horizonte; derecha, senda, roca grande y meseta.

**Colores por material (F10b).** Las medias salen todas naranjas por el ocaso (cielo `#e79f58`/`#fecb5e`, suelo
`#7b3111`, hierba `#bf6b1d`, `#9c5112`); se descontó la dominante mirando recortes aclarados:
suelo = **rojo ladrillo oscuro** (arcilla y grava); roca = **óxido pardo oscuro, picada** (`#521203` en sombra);
hierba = **verde oliva con puntas de paja dorada** (en el banner la hierba **no es amarilla pura**: la base es verde
oliva y la punta, dorada; las medias `#904f0e`/`#7e3e09` la dan marrón por la luz); arbustos = **gris pardo, sin hojas y
espinosos** (`#5d2f12` con la dominante); meseta = **rojo óxido** con caras pálidas por la bruma; cielo = **ámbar y oro
miel**, rosa pardo oscuro a la derecha (`#9d6b4e`).

**Qué dice el prompt y por qué.** (1) «Horizon about a quarter of the way down» (F10: la fracción medida, no «low
horizon»). (2) Tres capas con su fracción y contenido; las capas se nombran como «foreground / middle distance /
horizon» (§1.6). (3) Rocas y arbustos con tamaño **relativo al ancho de la imagen** («one seventh», «a tenth»), como F1
con medidas del propio cuerpo; la bruma de la meseta, «paler and paler layers», para la perspectiva aérea. (4) Hierba
por material (F3): «olive-green… straw-gold seed heads». (5) Luz: la dirección y la posición del sol fuera de cuadro
(P5 adaptada) para que no pinte un disco; «dust streamers» tal cual en el banner. (6) Sin nombre propio ni ancla (F6/F6c:
una ancla tipo «outback» traería canguros y eucaliptos).

**Contradice el canon / la ficha.** (a) La ficha de verano dice arcilla agrietada y hierba reseca; el banner tiene
hierba oliva verdosa y suelo sin grietas. (b) El texto regional habla de picos volcánicos lejanos; el banner, de
mesetas rojas de arenisca (ya apuntado en la ficha). (c) El `prompt.sujeto` de la ficha lleva «faint dirt trail winds from
beneath them [las rocas]»: en el banner la senda sale del suelo, no de las rocas. Se sigue el banner (§5).

### cataratas-madre-fango

| Qué | Píxeles | Relación |
|---|---|---|
| Labio de la caída (y≈195) | 195 de 793 | **0,25 de la altura** desde arriba; no hay horizonte propio: el cielo es un parche de 150 x 30 arriba al centro (x 1050-1200) |
| Selva lejana y neblina | y 0-115 | 14 % |
| Río alto, liso | y 115-195 | 10 % |
| Roca y caída (y 195-560) | 365 | **46 %**: la caída mide casi la mitad de la altura |
| Poza con espuma (y 560-793) | 233 | 29 % |
| Ancho de la caída en el labio (x 745-1340) | 595 | **0,30 del ancho** |
| Nube de espuma en la base (x 520-1700) | ~1180 | **0,60 del ancho** |
| Muros de roca (izq. x 430-880; der. x 1280-1700) | ~450 y ~420 | ~0,22 del ancho cada uno, ~285 de alto (0,36 de la altura) |
| Peces saltando (x 960-1280, y 480-630) | cuatro, ~55 px | 0,03 del ancho |
| Red en poste (x 0-230, y 410-700) | | borde izquierdo |
| Roca musgosa de primer plano (x 330-770, y 610-793) | 440 de ancho | abajo a la izquierda |
| Luz | cielo crema arriba al centro (`#f5e9d7`), neblina crema (`#d5bf9f`) | **contraluz** desde detrás y arriba de la caída; muros y orillas en sombra |

Tercios: izquierda, follaje en sombra, muro de roca y red; centro, la caída, la espuma y los peces; derecha, muro,
follaje grande y roca musgosa.

**Colores por material (F10b).** Agua de la caída `#b88e63`, espuma `#c1a286`, poza `#956d4e`, río `#d2ad81`; la luz
es cálida pero el agua ya es marrón de por sí: **caramelo lechoso / café con leche** en la caída, **espuma crema**,
**marrón barroso** en la poza. Roca `#332913`/`#262414` = **pardo umbra casi negro, en columnas verticales**.
Follaje `#2e320a`/`#2b2a12` en sombra, verde brillante con luz de frente: **verde musgo profundo con hojas verde amarillento
donde les da el sol**. Cielo y bruma, **crema**.

**Qué dice el prompt y por qué.** (1) «Foot of a great waterfall» y las tres capas con fracciones (poza = tercio
inferior; caída = centro). (2) Anchos y alto de la caída en fracción del cuadro (F10, F1). (3) La forma del labio («straight-edged,
shallow notch in the middle», flancos con hilos blancos) y los muros («about a quarter of the image wide») dan la
simetría de herradura sin decir «horseshoe». (4) Color por material (F3): «milky coffee-brown», «cream-white foam»,
«dark umber columnar rock». (5) Luz a contraluz (P5): la dirección y qué queda en sombra. (6) Peces, red y hojas del
primer plano, como en el banner (huella humana mínima; el canon pide los Borboles que remontan en primavera). Sin «pantano» ni
raíces: el banner no las tiene.

**Contradice el canon.** El texto regional sitúa la caída en la Ciénaga («nivel más bajo del pantano»); el banner es
una cascada de selva de muros columnares de 0,36 de la altura, sin troncos enredados ni aguas quietas. No aparecen las
Raíces Madre. Se sigue el banner; a revisar en el lore.

### Dificultades nuevas (lo que la guía no dijo cómo hacer para un lugar)

1. **No hay sujeto, ancla ni pose**: §1 (puntos 2-5) y F6-F9 no aplican; el orden por capas del punto 6 es lo único que
   queda. Falta decir qué ocupa el lugar del ancla (¿un paisaje real?) y si traería lo mismo que en fauna (animales, flora de
   más, F6c).
2. **El horizonte y las capas se miden en fracciones del alto, no en razones del cuerpo**: F10 habla de
   largo/alto del animal. Aquí se usaron «un cuarto desde arriba», «un séptimo del ancho», «casi la mitad del alto»;
   no se sabe si el modelo distingue «a quarter» de «a third» ni si respeta una fracción de ancho.
3. **Un lugar sin horizonte** (catarata): la cámara mira a una pared de agua; el «horizonte» es el labio y el cielo, un
   parche. §1 punto 6 («suelo → media distancia → horizonte») no cubre la verticalidad: se pidieron capas con la caída
   como plano medio y el río alto como lejano.
4. **Escala de elementos sin un sujeto de referencia**: el tamaño se dio contra el ancho de la imagen; los peces
   (0,03) y la roca (0,14) dependen de que el modelo entienda esa referencia.
5. **F10b con luz de ocaso en todo el banner**: las medias son todas naranjas; el material (hierba verde oliva) solo se
   ve aclarando y mirando. Hace falta una regla para lugares: descontar la dominante contra el color del cielo.
6. **Los dos banners de Pastos son el mismo archivo** (primavera = verano), así que lo estacional de la ficha no se
   puede separar de lo fijo ni comprobar; las condiciones de `estacion:` de la ficha quedan sin referencia propia.
7. **Contradicción con el canon en lo visual** (mesetas frente a volcanes, selva con muros frente a pantano llano):
   §5 dice seguir el banner, pero no cómo evitar que el `paisaje` de la región de `mundo.json` (B5 por defecto) lo
   vuelva a meter si se usa la plantilla automática.
8. **Cuenta de elementos repetidos** (arbustos, rocas, peces, hilos de agua): F9 dice «a row of» sin número; aquí se
   dio un número a los peces (cuatro) y no a las rocas; si sale el número, F9 se afloja para 3-4.

### Pautas propuestas para la sección de lugar de `pautas.md`

- **L1 · 🔬** La altura del horizonte (o del labio) y el reparto de capas se dicen en fracción del alto, y los elementos grandes en fracción del ancho; el prompt abre con ellas.
- **L2 · 🔬** Tres capas nombradas (foreground, middle distance, horizon/far layer), cada una con su material y su fracción; en un lugar vertical, la caída es el plano medio y el río alto la capa lejana.
- **L3 · 🔬** La luz se dice por **dirección y posición de la fuente** (fuera de cuadro a la izquierda, contraluz detrás de la caída), para que el modelo no pinte un disco y los sombreados coincidan.
- **L4 · 🔬** El color por material se mide aclarando el banner y descontando la dominante del cielo; la hierba y el agua tienen su color propio aunque la luz los tiña (F10b para lugares).
- **L5 · 🔬** Sin ancla de lugar: nombrar un paisaje real arrastra su fauna y su flora (F6c); se describe por capas y materiales.
- **L6 · 🔬** La referencia manda sobre el `paisaje` de la región y el canon (§5): el prompt de lugar lleva el entorno propio, no el B5 por defecto.
- **L7 · 🔬** Huella humana mínima solo si el banner la tiene (red, poste, senda), una frase y en su sitio (borde, capa).

## Objeto

Prompts `prompts/r20-cuchillo-hielo-silice.txt` (329 palabras) y `prompts/r20-odre-agua.txt` (303), escritos con
[`pautas.md`](../pautas.md) v4, la [plantilla](../plantilla-prompt.md) y [`r18-forma.md`](r18-forma.md) como método. Banners
`item/cuchillo-hielo-silice-banner.png` y `item/odre-agua-banner.png` (1983x793 los dos), medidos con rejilla de 100 px sobre
un recorte ampliado (`ffmpeg crop,scale,drawgrid`), a ojo (error ~10-15 px) y con medias de color de recortes (`crop,scale=1:1`).
Sin generar. Borrador 640x256, txt2img, 8 pasos, sin boceto. Grep de negaciones y vetadas: vacío en los dos.

### Encuadre del tipo y lente

- **Bodegón**: el objeto entero, grande, sobre una superficie del mundo (tablón, barro), con el fondo desenfocado que dice de dónde es y
  luz dirigida. Los dos banners lo hacen: el objeto apoyado en primer plano, cámara baja y de tres cuartos, el fondo a una profundidad
  lejana pero reconocible (tienda y llanura nevada; estanque y mesetas rojas).
- **Lente propuesta: 50 mm** (`Shot on a full-frame camera with a 50mm lens.`) para el acabado de `porTipo.item`. Por qué: los dos banners
  piden lentes distintas (el cuchillo parece de 50-85 mm, con la mesa comprimida; el odre, de 24-35 mm, con el suelo en primer plano y las
  mesetas pequeñas al fondo); 50 mm es el término medio, deja leer el fondo (que es parte de la receta) y coincide con flora (50 mm), de modo
  que el tipo no abre un tercer valor. Un 85/100 mm macro aplastaría el fondo que el bodegón necesita y a 640 px el objeto ya es grande.
  🔬 se compara 50 frente a 85 mm en la ronda (O6).
- **Fracción del encuadre.** En los banners el objeto es pequeño: cuchillo 36 % del ancho y ~16 % del alto; odre 32 % del ancho y 39 % del
  alto. El plan manda «grande en el encuadre» y a 640 px (F4) un 36 % son 230 px, poco para fracturas y glifos: el prompt sube a «about half
  its width» (cuchillo) y «two fifths» (odre). Se apunta como desviación consciente de la referencia, a juzgar en la ronda (O2).
- **Línea de estilo.** Se usa la fija de `mundo.json` (`Style: … soft golden-hour rim light, warm atmospheric haze …`) tal cual. Para el
  odre (atardecer) encaja; para el cuchillo (luz fría de día nublado) empuja a cálido: ver dificultad 4.

### cuchillo-hielo-silice

#### Medidas en el banner (píxeles)

| Qué | Píxeles | Relación |
|---|---|---|
| Hoja, de la punta (x≈620) a la unión con el mango (x≈1105) | ~485 | **~2,05 de la longitud del mango** (canon: 18 cm / 10 cm = 1,8) |
| Mango (x 1105 a 1342) | ~237 | 1 |
| Todo el cuchillo | ~720 de 1983 (**36 % del ancho**), ~130 de 793 (**16 % del alto**) | 5,5 de largo/alto |
| Ancho máximo de la hoja (hacia x≈1000, a 2/3 de la punta al mango) | ~90 | **~0,19 del largo de la hoja (1 de cada 5,4)** |
| Ancho de la hoja a 1/4 de la punta (x≈740) / a 10 % | ~55 / ~15 | forma de triángulo largo, algo ahuecado; punta de aguja; el lado de arriba sube recto a la unión, el de abajo es casi llano |
| Grosor del mango | ~55 | **0,6 del ancho de la hoja**; largo/grosor del mango ≈ 4,3 |
| Mango | cilindro recto, tres vueltas de cuerda en cada extremo, remate redondeado, **4-5 glifos negros angulares** a lo largo | |
| Orientación | casi horizontal, punta a la izquierda (y≈612), mango a la derecha (y≈515): sube ~8° | |
| Superficie | tablón de banco oscuro, agrietado, manchado de negro; fondo: hueco de tienda con llanura nevada y montañas blancas (arriba al centro), cajas con hielo (izq.), saco de arpillera con más cuchillos y herramientas de hierro (der.) | |
| Luz | difusa, fría, de cielo cubierto, entra por el hueco del fondo; sombras muy suaves; los reflejos de la hoja son blancos | |

#### Colores por material (F3, F10b)

La luz es fría y apagada (cielo `#d2dae5`, nieve `#8d9ebc`), así que las medias no llevan dominante cálida que restar; lo que baja es la luminancia.

- Hoja: media `#656f83`-`#788396` (gris azulado), **incolora y translúcida**, con venas de fractura blancas; el hielo de las cajas, en cambio, es
  azul franco (`#4c687d`). **El canon dice «blanco azulado» y la hoja del banner es casi transparente con un tinte gris azulado.**
- Mango: hueso **crema desgastado** (la media sale `#504741` por los glifos y las sombras; a ojo, crema pálido), glifos **negro**, cuerda **canela**.
- Mesa: gris pardo oscuro `#3a3536` (casi sin saturar), grietas y manchas negras. Telas: rojo sangre oscuro `#251314`.

#### Qué dice el prompt y por qué

- Encuadre: «low three-quarter angle just above the table surface», objeto «about half its width» (arriba) y «almost horizontal, tilted slightly upward to the right» con punta a la izquierda (P8: la dirección puede no obedecerse; si sale al revés se voltea).
- Proporción con medidas del propio objeto (F1): hoja «a little over twice as long as the handle», «one fifth as wide as it is long», «widest two thirds of the way toward the handle», mango «four times as long as it is thick and two thirds as thick as the blade is wide».
- F8: el hielo sílice no se compara con vidrio ni con hielo; se dice «translucent, colourless mineral… rippled, hand-chipped surface… web of fine fracture lines». El ancla es solo «a hand-carved hunting knife» (F6, una vez, sin diferencia). Ni «sword» ni «icicle».
- F3: un color por material (hoja, hueso, cuerda, tablón, tela). F2: «bound at each end with three wraps» dice dónde acaba el rasgo; sin número de glifos (F9: «angular black glyphs»).
- Entorno por capas: tablón (suelo) → cajas y saco desenfocados → hueco con llanura nevada. De los banners solo se pide lo que dice de dónde es.
- Luz de la referencia (P5): fría, desde atrás a la izquierda por el hueco, con «rim-lighting the fractures of the blade».
- Sin cráneos ni huesos de razas sintientes: el hueso es de caja de huesos de caza, y el mango, «weathered bone-cream»; el prompt no dice de qué hueso.

#### Qué contradice al canon

1. Hoja: «blanco azulado translúcido» (canon) frente a incolora con tinte gris azulado y fracturas blancas (banner); manda el banner.
2. Proporción 18/10 = 1,8 (canon) frente a ~2,05 (banner).
3. El banner no es un objeto solo: lleva otros cuatro o cinco cuchillos en un saco, herramientas, cajas y una tienda. El prompt aísla uno y deja el resto como fondo.
4. «Empuñadura de hueso con marcas rúnicas»: coincide (glifos negros angulares, cuerda), sin contradicción.

### odre-agua

#### Medidas en el banner (píxeles)

| Qué | Píxeles | Relación |
|---|---|---|
| Odre entero, del tapón (x≈576) al borde derecho (x≈1211) | ~635 de 1983 (**32 % del ancho**) | 1 |
| Cuerpo (de x≈635 a 1211) | ~576 de largo por ~306 de alto (y 371-677; **39 % del alto**) | **~1,9 de largo/ancho**: bolsa plana en almohada |
| Cuello (hasta donde el cuerpo ya es ancho) | ~150 de largo = **0,24 del largo total** | el cuerpo se estrecha en curva hacia arriba a la izquierda |
| Tapón | ~87 de largo por ~96 de alto = **0,31 del ancho del cuerpo** | oscuro, acanalado, casi negro |
| Costura | cordón de cuero crema en punto cruzado grueso, de unos 20-35 de grosor, **por todo el borde** (más visible en el lado de abajo) | relieve marcado |
| Correa | ~20 de ancho, plana; sale del cuello, baja y rodea el borde de abajo hasta x≈1230 | **largo ≈ el del cuerpo (~660)**; queda en un lazo suelto en el barro |
| Posición del centro | x≈890 (45 %), y≈520 (66 %) | un poco a la izquierda del centro, en el tercio de abajo |
| Orientación | cuello arriba a la izquierda (y≈450), cuerpo girado ~10° hacia abajo a la derecha; tumbado de lado | |
| Superficie | arcilla roja mojada con huellas profundas; matas de hierba seca dorada | |
| Detrás | estanque que refleja el sol bajo a la izquierda; horizonte a ~25 % desde arriba; mesetas de arenisca roja a la derecha; cielo dorado y naranja | |
| Luz | sol bajo, **desde atrás a la izquierda**, naranja; rasante sobre el cuero y el barro mojado | |

#### Colores por material (F3, F10b)

La luz es naranja (cielo `#f6bd6b`, agua `#daa06d`), y tiñe todo de cálido.

- Cuero del cuerpo: medias `#6c442c` (general), `#7e583d` (zona más iluminada), `#492c1a` (sombra). Descontada la dominante naranja: **marrón tostado oscuro a chocolate**, con manchas aceitosas más oscuras; **superficie lisa, algo arrugada**.
- Costura: crema **marfil sucio** (más claro que el cuero, el único tono pálido del objeto).
- Tapón `#28130a` y correa `#341e0f`: **marrón casi negro**, correa con un tramo pálido (hebilla o remache) cerca de x≈870-920, y≈730.
- Barro: `#522a1a`-`#35150c` en sombra; a la luz, **rojo óxido**. Mesetas: rojo ladrillo; hierba: oro seco.

#### Qué dice el prompt y por qué

- F1: «a little under twice as long as it is wide» (1,9), cuello «about a quarter of the total length», tapón «about a third as wide as the body», correa «as long as the body». Todo con medidas del propio objeto.
- F8: el cuero se describe con forma y textura («single sheet of cured hide… smooth, slightly wrinkled surface… raised seam… coarse cross-stitch»); el ancla es «a worn leather waterskin» y «pillow-shaped pouch» es forma, no ancla.
- F3: un color por material (cuero tostado a chocolate, costura crema, tapón y correa marrón oscuro, barro rojo-pardo).
- Pose: «lying on its side», cuello arriba a la izquierda y correa en lazo en el barro (el rasgo que más marca la silueta y que es fácil que falte, F4).
- Entorno por capas: arcilla mojada con huellas → estanque con sol bajo → llanura y acantilados rojos; la luz «from behind and to the left», como el banner (P5).
- No pide el agua dentro: el banner es un odre vacío («vacío hasta que se llena», canon) y el prompt no dice «full».

#### Qué contradice al canon

1. Canon: «odre de cuero curtido cosido a mano, correa larga»; coincide. Canon dice «2 litros, correa de 70 cm»: el banner no permite medir cm; la correa mide lo que el cuerpo (~1:1), sin contradicción.
2. «Estepa» (canon) frente a arcilla roja y mesetas junto a un estanque (banner): el banner es Llanuras; manda el banner.
3. El tapón del banner es un cilindro acanalado, no un tapón de madera lisa (no hay dato en el canon).

### Dificultades nuevas (lo que la guía no dijo cómo hacer para un objeto)

1. **Qué fracción del encuadre se pide.** Los banners dejan el objeto en un 32-36 % del ancho y el plan dice «grande»; la guía no dice si se imita la fracción medida (F10) o se pide más porque a 640 px un 36 % no deja ver los rasgos (F4). Se pidió ~50 % y ~40 %; falta saber si el modelo sigue una fracción por prompt.
2. **Un banner que no es un objeto solo.** El cuchillo comparte la imagen con otros cuatro o cinco y con un taller; la guía mide un sujeto. Se eligió un solo cuchillo y el taller como fondo, pero el criterio «se lee como la referencia» no dice si pesa más el cuchillo o el ambiente.
3. **Un material sin objeto de comparación y translúcido.** F8 prohíbe compararlo con vidrio o hielo, y «translucent, colourless mineral» puede salir como un cristal sin forma o como vidrio pulido de cuchillo moderno. La guía no dice cómo describir la transparencia (que se vea el tablón a través) sin nombrar un material real.
4. **La línea fija `Style: … golden-hour rim light, warm atmospheric haze` frente a una luz fría.** En el cuchillo (cielo cubierto, nieve) empuja a naranja y tapa el azul del hielo; la guía trata la línea como fija. Falta saber si la luz del cuerpo del prompt gana a la de la línea o si hay una línea por momento/clima.
5. **Un objeto largo y fino en un lienzo de 2,5:1.** El cuchillo cabe, el odre ocupa más alto; pero la dirección no se obedece (P8) y no hay plan corporal de boceto para objetos (F5/`IMG-24` son de criaturas). Si sale al revés o vertical, se voltea; si sale en otra pose, falta plantilla.
6. **El texto y los símbolos.** Los glifos del mango y las runas que el modelo suele rellenar con letras; F9 dice «sin número», y la línea fija pide «completely textless», que choca con «glyphs». Se pidió «angular black glyphs» sin letras ni número.
7. **Qué se mide del fondo.** El banner del odre tiene un fondo de paisaje entero (estanque, mesetas) y el del cuchillo, un interior; el encuadre de tipo dice «fondo poco profundo», pero ninguno lo es. Se pidió desenfocado pero reconocible.

### Pautas propuestas para la sección de objeto de `pautas.md`

| # | Pauta | Estado |
|---|---|---|
| O1 | **El objeto entero, en bodegón**: apoyado en una superficie del mundo descrita (tablón, arcilla mojada) y con el fondo desenfocado en capas que dice de dónde es; cámara baja a tres cuartos. | 🔬 |
| O2 | **La fracción del encuadre se pide más grande que en el banner**: ~50 % del ancho el objeto largo, ~40 % el compacto (los banners miden 32-36 %), porque a 640 px los rasgos pequeños (F4) no se leen. Comprobar si el modelo sigue la fracción. | 🔬 |
| O3 | **Las proporciones del objeto se miden en la referencia con la unidad del propio objeto** (hoja frente a mango, cuerpo frente a cuello, tapón frente a cuerpo, correa frente a cuerpo); el canon da una cifra (18/10) que el banner contradice (~2,05). | 🔬 |
| O4 | **Un material emblemático se describe por forma y textura, no por objeto ni material real** (F8): «translucent, colourless mineral, rippled, hand-chipped, web of fine fracture lines», «cured hide, smooth, slightly wrinkled, raised seam». | 🔬 |
| O5 | **Color por material, descontando la luz (F3, F10b)**, con la luz del banner distinta por objeto: fría y apagada (cuchillo) o naranja rasante (odre). | 🔬 |
| O6 | **Lente `item`: 50 mm**, el término medio de los dos banners; comparar con 85 mm. | 🔬 |
| O7 | **La luz del cuerpo del prompt debe nombrar clima y dirección** (fría, desde atrás a la izquierda; sol bajo cálido) para ganar a la línea fija `Style` cuando el banner no es dorado. | 🔬 |
| O8 | **Un banner con muchos objetos se reduce a uno**; los demás pasan a fondo desenfocado en una frase. | 🔬 |

## Raza

Prompts `prompts/r20-orcos-llanuras-macho.txt` (343 palabras) y `prompts/r20-faerus-margen-hembra.txt` (347), escritos
con [`pautas.md`](../pautas.md) v4, la [plantilla](../plantilla-prompt.md) y el método de [`r18-forma.md`](r18-forma.md).
Banners `orcos-llanuras-macho-banner.png` y `faerus-margen-hembra-banner.png` (1983x793), medidos con rejilla de 100 px
(`ffmpeg crop,eq,drawgrid`), a ojo sobre la rejilla (error ~10-15 px) y con medias de color de recortes (`scale=1:1`).
Sin generar. Acabado de `npc` (85 mm). Lienzo del borrador 640x256, txt2img, 8 pasos; semillas 3 y 7 (R1) las pone
quien lance la tanda.

### Encuadre del tipo: la figura entera en 2,5:1

Lo medido en los dos banners (GPT resolvió igual los dos): la figura va en el **tercio izquierdo**, de pies a cabeza
**casi a toda la altura** del encuadre, **de tres cuartos mirando hacia dentro** (a la derecha), y el entorno se abre a
su derecha por capas (suelo bajo los pies, media distancia con el lugar habitado, horizonte). Lo que hace que una
figura vertical quepa en un panorama es la **postura baja**: ninguna está de pie recta, las dos están flexionadas
(agachado, encorvada), así que el ancho de la figura con su arma o su capa es ~1,1 veces su alto.

| Medida | Orco | Faerus |
|---|---|---|
| Alto de la figura / alto de imagen | 770 / 793 = **0,97** (pelo a pie) | 700 / 793 = **0,88** (cresta a garra) |
| Ancho de la figura / ancho de imagen | 865 / 1983 = **0,44** con capa y hacha; 0,33 el cuerpo | 570 / 1983 = **0,29** con los cuchillos |
| Ancho / alto de la figura | 865 / 770 = **1,12** | 570 / 700 = **0,81** |
| Centro de la figura (x) | ~0,30 del ancho | ~0,32 del ancho |
| Horizonte (y) | ~335 / 793 = **0,42**, a la altura del pecho | tapado por troncos; la aldea cuelga a 0,15-0,35 |
| Cámara | a la altura del pecho, ligero contrapicado | a la altura del pecho |
| A 640x256 | figura de ~248 px de alto, ~110 px de cuerpo | ~225 px de alto, ~90 px de cuerpo |

Decisión (P7, F4): el prompt pide «full-length», «taken at chest height», «filling the whole height of the frame on the
left side» y la vista de tres cuartos (F10c: la del banner, no la de la tabla de pose). El borrador a 256 px de alto
deja la cabeza en ~50 px: se juzgan proporción, silueta y color, no la cara (F4). La dirección (derecha) no se controla
por prompt (P8): si sale al revés, se voltea al comparar.

### orcos-llanuras-macho

**Medidas en el banner** (altura de cabeza con pelo = 170 px; sin pelo, cara 140):

| Qué | Píxeles | Relación |
|---|---|---|
| Altura total (pelo y≈15, pie trasero y≈785) | 770 | **4,5 cabezas** agachado (5,5 contando solo la cara) |
| Ancho de hombros (x 440-840) | ~400 | **2,9 cabezas** de ancho: macizo, no estilizado |
| Torso (cuello y≈150, cinto y≈420) | ~270 | 1,6 cabezas |
| Brazo (hombro y≈130 a puño y≈470) | ~340 | **2 cabezas**; antebrazo ~130 de grueso, puño ≈ la cabeza |
| Pierna (cadera y≈420 a suelo) | ~365 | 2,1 cabezas; muslo ~150 de grueso (0,9 cabeza) |
| Hacha (mango y hoja) | mango ~690 | **0,9 de la altura** de la figura; hoja doble en media luna, ~240 de alto |
| Vista y pose | | tres cuartos a la derecha, rodillas flexionadas, pie trasero en el suelo bajo y delantero en un escalón de roca, las dos manos cruzando el hacha |
| Cabeza | | cuadrada, mandíbula inferior saliente con dos colmillos cortos hacia arriba, orejas puntiagudas hacia atrás, barba negra trenzada, pelo negro largo suelto, dos trenzas con cuentas al pecho |
| Lleva | | capa de plumas pardo-negras del hombro a la pantorrilla, falda de tiras de cuero con flecos rojo oscuro, cinto ancho, vendas de cuerda y cuero en muñecas y espinillas, pies descalzos y anchos |

**Colores por material** (F10b; la media del recorte lleva la dominante naranja del sol y la sombra propia: piel en
sombra media `#54382a`-`#6a452f`, cara y colmillo claros `#a4876e`; descontada, a ojo sobre la imagen aclarada):

- piel **arcilla tostada (beige arenoso a la luz, marrón más hondo en sombra)** con vetas y grietas **rojo pardo oscuro**
  (pecho y brazos); pelo y barba **negro** (`#1a130d`-`#38322d`); colmillos **marfil** (`#a4876e` lit);
- capa **pardo negruzco** (`#4a3328`), falda **cuero oscuro con flecos rojo burdeos** (`#24120c`), cinta de la hacha
  **carmesí** (`#4f281e` en sombra); acero **gris oscuro picado** (`#493f38`), mango de madera `#34271f`;
- suelo y paredes **rojo óxido** (`#6c3b22` pared, `#3d2719` roca en sombra), cielo **gris pálido cálido** (`#bbb1a7`),
  mesas lejanas **rosa arcilla velado** (`#998274`), tiendas **rojo burdeos** (`#71503d` con bruma).

**Ancla: ninguna animal; el tipo de criatura «orc» con color y medidas dichos** (F6, F6c). Un animal no da esta silueta
(es un bípedo musculoso); lo que se compara es el tipo de criatura por defecto del modelo:

| Candidato | Trae | Choca con el banner | Veredicto |
|---|---|---|---|
| orc | colmillos inferiores, orejas puntiagudas, corpulencia, descalzo, hacha | piel **verde** por defecto; armadura negra de pinchos | **sí**, con piel, ropa y medidas dichas |
| ogre | cabeza pequeña, barriga, brazos largos | panza (el banner es de músculo y cintura marcada) | no |
| troll | piel verde-musgo o gris, nariz grande | color, rostro | no |
| bárbaro (persona) | pelo largo, capa, hacha | es una **persona disfrazada**: sin colmillos ni quijada saliente; en el mundo no hay humanos | no |

**Qué dice el prompt y por qué.** Encuadre y vista como arriba (P1/F10c). «four and a half heads tall as he crouches»,
«shoulders nearly three heads wide», «arms about two heads long», «fists as big as his head» (F1: medidas del propio
cuerpo, no «huge, muscular»). Cabeza con rasgos de forma, de arriba abajo (§1.3): quijada, colmillos, orejas, barba, pelo.
Piel por material y en dos tonos (F3, F10b), con las vetas dichas como «dark red-brown streaks» (la palabra vetada
«scar» no sale). Capa, falda y vendas con forma y material, sin compararlos con otro objeto (F8). El hacha «nearly as long
as he is tall» (F1, medido 0,9). Entorno por capas: roca bajo los pies, valle de tiendas rojas con humo, mesas rojas,
horizonte a la altura del pecho. Luz con dirección: sol alto a la derecha, contraluz dorado en los hombros (P5).

**Contradice al canon** (§5: manda el banner): (1) `rasgoFisico`/`description` dicen «músculo largo y estilizado, menos
grasa… para disipar calor»; el banner es **macizo y ancho** (hombros 2,9 cabezas, muslo de 0,9 cabeza), no estilizado:
se sigue el banner. (2) «piel beige y arcilla»: el banner es arcilla tostada con vetas rojo pardo, más oscura que beige:
se pide arcilla tostada, beige donde da la luz. (3) El canon no dice pelo, barba ni plumas; el banner sí, y van. (4) Lleva
un hacha de acero y calzado de vendas: el canon no los contradice.

### faerus-margen-hembra

**Medidas en el banner** (altura de cabeza con cresta = 225 px; solo cara, ~150):

| Qué | Píxeles | Relación |
|---|---|---|
| Altura total (cresta y≈75, garras y≈770) | 700 | **3,1 cabezas con la cresta** (4,6 sin ella); encorvada ~45° |
| Ancho de hombros (x 450-810) | ~360 | **2,4 cabezas** de la cara; hombros caídos y macizos |
| Brazo (hombro y≈320 a garra y≈590) | ~270 | llega **a la rodilla** (rodilla y≈590); manos grandes con garras |
| Pierna (cadera y≈430 a pie y≈765) | ~335 | muslo ~170 + pierna ~175; rodillas flexionadas, **pies anchos con garras largas** |
| Cuchillos (hoja) | ~130-170 | ~0,7 de la cabeza con cresta; hoja recta algo curva, punta abajo, uno en cada mano |
| Cabeza (x 700-870 de imagen, y 170-300) | ~170 de ancho x 130 de alto | **ancha y de cara plana**; hocico ~75 de largo = **corto, ~el ancho entre los ojos**; nariz plana oscura, orejas pequeñas y altas, colmillos largos a la vista |
| Ojo | | **violeta brillante**, bajo ceja pesada |
| Cresta | | de hojas finas solapadas como tejas, del cráneo a la nuca, hombros y dorso de los brazos |
| Vista y pose | | tres cuartos a la derecha, bípeda encorvada, brazos colgando, gruñido con los colmillos a la vista |
| Lleva | | cuerdas trenzadas en antebrazos y espinillas; sin tela |

**Colores por material.** Luminancia ~10-45/255 (pelaje `#151109`, hoja `#2b291e`, suelo `#12100a`): como en r18, la media
no distingue verde de ocre; se tomaron la proporción R:G:B (siempre ~2:1,7:1, dominante cálido-oliva) y la imagen aclarada:

- pelaje **pardo ocre oliva, color de corteza y musgo mojado**; cresta de hojas **verde oliva con borde ocre**;
- ojos **violeta** (`#0f0c05` sin valor: se ve en la imagen aclarada); colmillos **marfil**; garras **pardo oscuro**;
- hojas del cuchillo **gris acero pálido** (`#24221a` en sombra); cuerdas **pardo fibra**;
- suelo **musgo verde muy oscuro** (`#12100a`), troncos **negro pardo con musgo**, setas **azul verdoso pálido luminoso**
  (`#233222`-`#24301f`, solo en los extremos), ventanas **ámbar** (`#1e1d15` en las cabañas lejanas).

**Ancla: oso, solo para la postura** («like a bear rearing up»); la cara y el cuerpo se dicen con medidas (F7, F6c):

| Candidato | Trae | Choca con el banner | Veredicto |
|---|---|---|---|
| gorila / simio | bípeda de nudillos, brazos largos | **un simio** (lo que salía en Hulki); sin hocico | no |
| hiena | hombros altos, lomo caído | hocico de perro, orejas grandes redondas, manchas | no |
| león | cara plana y corta, melena, hombros | color arena, cola con borla, cuerpo horizontal | no |
| glotón | cara corta ancha, orejas pequeñas, pelaje oscuro | cuerpo largo bajo, cuadrúpedo, cola | no |
| **oso** | hombros altos, brazos largos con garras, torso hondo, pelaje denso, **se alza sobre dos patas** | hocico largo, orejas redondas, cola corta | **sí**, para la postura; el hocico va con medida y las orejas dichas |

La cara **no se compara con un felino** (F7: el ancla de una parte contagia al cuerpo): se dice con medidas (hocico del
ancho entre los ojos, nariz plana, orejas pequeñas y altas). Si sale un oso a cuatro patas, es el ancla y la segunda
semilla va sin ella (R2). Riesgo conocido de Hulki: el simio de melena y barba sale por «browser, long muzzle»; aquí se
pide hocico corto y cresta de hojas, no melena.

**Qué dice el prompt y por qué.** Encuadre y vista como arriba. «three heads tall counting her crest», hombros «two and
a half heads wide», brazos «down to her knees» (F1, F10); «torso tilted forward at forty-five degrees» fija la postura
encorvada (P1, F10c). Cabeza de arriba abajo con medidas (F1), ojos violeta y colmillos «clearly»: a 256 px miden ~50 px de
cabeza, F4. Pelaje y cresta por material y color (F3, F8: hojas con forma, «thin overlapping leaf-shaped blades… like roof
shingles», y que crecen de la piel, F8 🔬). «Bare of cloth» (canon: sin túnica ni sandalias) y cuerda trenzada en las
extremidades. Cuchillos de acero pálido en las dos manos con la punta abajo. Entorno por capas: musgo y setas luminosas en
los bordes, troncos negros, aldea de plataformas con puentes y ventanas ámbar. Luz: verde tenue bajo el dosel cerrado y haces
finos desde arriba a la izquierda (P5).

**Contradice al canon** (el banner manda): (1) Hulki y el canon dicen «ojos oscuros y fríos»; el banner pinta **ojos
violeta brillante**. (2) `berigLore.ts` l.243 dice «postura de 2 a 4 patas»; el banner es bípeda encorvada. (3) El canon no da armas ni
cuerdas; el banner lleva dos cuchillos de acero y cuerdas trenzadas. (4) La guía (§3) dice «sin niebla, luz tenue y verde»;
el banner es casi negro, con ámbar de las ventanas y verde-azul de las setas luminosas. (5) La **aldea** es de plataformas
con puentes de cuerda: encaja con el «asiento de varas atadas» de Hulki, pero el canon no la describe.

### Dificultades nuevas (lo que la guía no dijo cómo hacer para una raza)

1. **Cómo cabe una figura alta en 2,5:1.** P7 habla de formas altas en un lienzo más alto para un sujeto sobre fondo liso;
   aquí el sujeto va con su entorno en el mismo borrador. GPT lo resuelve con la figura al tercio izquierdo, a toda la
   altura, agachada y con un arma que ensancha la silueta; la guía no dice cómo pedirlo (posición, altura, pose baja).
2. **El tipo de criatura como ancla.** F6/F6b hablan de un animal real. Una raza humanoide (orco) no tiene animal; el
   ancla es «orc», y el modelo trae su color verde y su armadura por defecto. Falta la regla: cuando el ancla es una
   criatura, el color y la ropa **van dichos** (F10b) y la tabla «trae / choca» se hace con criaturas y con el
   «persona disfrazada» como candidato descartado.
3. **Una persona disfrazada.** En un mundo sin humanos, un humanoide musculoso con barba y pelo largo se lee como un bárbaro.
   Lo que lo evita son los rasgos que un humano no tiene (colmillos inferiores, quijada saliente, orejas, proporción de 2,9
   cabezas de hombros); la guía no dice cuántos hacen falta.
4. **El simio.** Un faerus de 2-4 patas con brazos hasta la rodilla es un gorila para el modelo (Hulki). Se evita con ancla
   de oso para la postura y cara con medidas; no se sabe si el «oso» acaba en un oso de cuatro patas.
5. **Medir la cabeza como unidad con pelo, crestas y melenas.** F1 mide en «cabezas»; con pelo largo o cresta de hojas la
   cabeza cambia ~30 % según se cuente (orco 4,5 o 5,5; faerus 3,1 o 4,6). Hay que fijar la unidad.
6. **Una luminancia baja con un banner casi negro (faerus, ~15/255).** Como en r18, la media no discrimina; el color se
   dio a ojo sobre la imagen aclarada, con el ámbar y las setas como únicos puntos de color fiables.
7. **Medir la mano y el arma como parte de la figura.** El hacha del orco mide 0,9 de la altura y define la silueta; las
   pautas no dicen si el arma va en el prompt como rasgo (F1, tamaño) o como compañía (§1.5).
8. **El rasgo pequeño en el borrador (F4).** A 256 px de alto la cara mide ~50 px: ojos violeta, colmillos y cuentas de las
   trenzas no se pueden juzgar; las cuentas del orco se quitaron del prompt por eso.

### Pautas propuestas para la sección de raza de pautas.md

| # | Pauta | Estado |
|---|---|---|
| R-Z1 | **La figura entera ocupa el tercio izquierdo y casi toda la altura** (0,9-0,97 del alto, 0,3-0,45 del ancho); el entorno se abre a la derecha por capas. Se dice «full-length… filling the whole height of the frame on the left side». | 🔬 |
| R-Z2 | **La postura baja (agachado, encorvada) hace que quepa en 2,5:1**: ancho/alto de la figura 0,8-1,1 en vez de ~0,3 de una figura recta. Se dice la flexión («crouched», «torso tilted forward at forty-five degrees»). | 🔬 |
| R-Z3 | **La cámara va a la altura del pecho** y el horizonte a ~0,4 del alto (orco); se dice «taken at chest height». | 🔬 |
| R-Z4 | **Las proporciones de una raza se miden en cabezas** (alto, ancho de hombros, largo de brazo y pierna), con la unidad fijada (con pelo o cresta) y el prompt dice la unidad. | 🔬 |
| R-Z5 | **Una raza humanoide sin animal usa el tipo de criatura («orc») como ancla, con color, ropa y medidas dichos**: el modelo trae su verde y su armadura por defecto. | 🔬 |
| R-Z6 | **La persona disfrazada se evita con rasgos que un humano no tiene** (colmillos inferiores, quijada saliente, orejas, hombros de 2,9 cabezas). | 🔬 |
| R-Z7 | **El simio se evita en un faerus con ancla de postura de oso**, hocico corto con medida («as long as the eyes are wide apart») y cresta, no melena. | 🔬 |
| R-Z8 | **La ropa y el equipo se dicen como material con forma** (capa de plumas, falda de tiras de cuero, vendas de cuerda), no comparados con otro objeto (F8); el arma lleva su tamaño relativo a la figura. | 🔬 |
| R-Z9 | **La referencia manda sobre el canon**: si el banner contradice (músculo largo vs macizo, ojos oscuros vs violeta), se sigue el banner y se apunta (§5). | 🔬 |
