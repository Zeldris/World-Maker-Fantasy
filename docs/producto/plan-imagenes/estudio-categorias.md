# Estudio de prompts por categoría (IMG-54)

Un elemento por categoría hasta saber qué hace que se genere bien **solo**, antes de combinar. Método por elemento:
mismo motor y semillas; el banner de GPT solo para medir (`--medir-con`), nunca como `-r` (entrando como `-r` el
modelo lo copia: el «bueno» de pilares era el banner). Pruebas: **A** techo (prompt escrito mirando el banner, solo lo
que se ve), **B** el prompt de la base, **C1…Cn** B con una pieza cambiada, y una con todas. Variante `img54` del
elemento en `generated/`, P1 a 480x192 con klein 4B (~40 s); FLUX.3 solo con lo que ya funcione.

## Lugar: acantilados-partidos (2026-11-08, klein 4B, semillas 3 y 4)

Hoja: `generated/banco/hojas/sueltas-acant54-1.png` (filas A, B, C1, C2, C3, C4).

| Prueba | Qué cambia | Resultado | Color (emd cb/cr/y) |
|---|---|---|---|
| A techo | 125 palabras: costa de acantilados de arenisca roja, grietas con espuma, nidos, meseta de hierba a la izquierda, mar a la derecha, mediodía | **Casi el banner**: costa, arenisca roja, mar azul, nidos | 13/13/32, 11/12/40 (cielo más claro) |
| B base | — (264 palabras) | Dos bloques grises como paredes, rayas blancas, sol bajo de espaldas, volcán | 10/11/24, 11/11/19 |
| C1 luz | luz de mediodía en vez de «golden-hour» | Casi igual que B | 6/9/15, 8/13/17 |
| C2 cámara | «high aerial view» en vez de «low camera angle» | Se mira la grieta desde arriba; sigue lo demás | 10/9/24, 11/14/17 |
| C3 contenido | sin «pale healed streaks», mar en vez de volcanes | Quita las rayas; siguen los dos bloques | 10/9/23, 11/9/16 |
| C4 todo | C1+C2+C3 | Mar azul y vista alta, pero sigue siendo «una pared partida en dos» de roca gris | **3/6/19**, 4/6/19 |

**Conclusiones (lugar):**

1. **El modelo puede**: con klein 4B y un prompt que describe lo que se ve, sale casi el banner. El fallo está en el
   prompt, no en el motor.
2. **Lo que más pesa es cómo se nombra el sujeto.** «A vertical split coastal wall… two cliff faces» pinta un objeto
   (dos bloques), aunque se arregle todo lo demás (C4). Un lugar se describe como paisaje («a rugged coastline where
   sheer cliffs drop into the sea, cut by deep chasms»), nunca como una cosa con caras.
3. **El color de la roca tiene que estar.** B no lo dice y sale gris oscuro; A dice «rust-red layered sandstone».
4. **La disposición izquierda/derecha** (meseta a un lado, mar al otro) ordena la imagen mejor que los tercios.
5. **La luz de «día» tiene que ser de día** (C1/C4 bajan mucho la distancia de color), pero sola no arregla la forma.
6. **El paisaje de la región no puede tapar el del sitio**: los «low volcanic peaks» de la región se pintan aunque el
   sitio sea costa.
7. **Las reglas de las pautas se pintan**: «pale healed streaks» sale como rayas blancas aunque el lore no lo pida.
8. Menos es más: A tiene la mitad de palabras que B.

**Prueba D, sin mirar el banner** (lo que haría el generador): prompt escrito solo desde el lore con las reglas 2-8.
Hoja `generated/banco/hojas/sueltas-d54-1.png`.

- Acantilados D: costa de acantilados rojos, mar azul, nidos, hierba en la meseta: **muy cerca del banner** (luz algo
  más fuerte: y 6-11). Las reglas valen sin ver la referencia.
- Pilares D (segundo lugar): todo lo del lore está (tres pilares, puentes, estandartes, anillo de acantilados, día),
  pero **la escala no**: salen como postes de ladrillo de unos metros, no como torres de roca más altas que el cañón.
  «Pillars» y «each as tall as the cliffs» no bastan: falta decir qué parte de la imagen ocupan y la forma de la
  ruina (agujas de roca desmoronadas que se estrechan hacia arriba).

9. **La escala se dice por la imagen**, no por comparación: «rising from the bottom edge to near the top of the
   image». Y la palabra del objeto cuenta: «pillar» da poste; «rock spire / ruined tower» da la mole.

- Pilares E (escala por la imagen, «colossal ruined towers… craggy spires»): moles grandes, pero rechonchas.
- Pilares F (E + «slender craggy spires each about four times as tall as it is wide» + «carved with the worn remains
  of ancient doorways, windows and ledges»): torres en ruina con puertas y ventanas, más altas: **lo más cerca del
  banner sin mirarlo**. Siguen algo rechonchas y cuadradas: klein 4B no sigue la proporción en números; queda
  probarlo con FLUX.3. Hoja `generated/banco/hojas/sueltas-f54-1.png`.

10. **Los restos de construcción visibles** (puertas, ventanas, cornisas) convierten la roca en ruina; la proporción
    en números ayuda poco con klein 4B.

## Fauna: múrgol macho (2026-11-08, klein 4B, semillas 3 y 4)

Hojas: `generated/banco/hojas/sueltas-murgol54-1.png` (filas A, B, C, D) y `sueltas-murgol54ef-1.png` (E, F).

| Prueba | Qué cambia | Resultado | Color (emd cb/cr/y) |
|---|---|---|---|
| A techo | el prompt de la ficha (escrito mirando el banner, 291 palabras) | Composición del banner (de frente, rebaño, mesetas, sol), pero **cuernos de toro lisos** y lana corta con rayas rojas como sangre | 4/8/22, 4/6/18 |
| B base | — (247 palabras) | **Otro animal**: toro de perfil, pelo corto, volcanes y acacias | 1/2/16, 2/5/22 |
| C | B de frente, cornamenta ramificada, sin volcanes, una sola luz | Cornamenta de ciervo bien; sin rebaño, sabana con acacias | 1/9/3, 1/10/9 |
| D lore | solo desde el lore con las reglas del lugar (208 palabras) | De frente, rebaño a los lados, cornamenta clara algo ramificada, flequillo: **el mejor de los cuatro**; la lana no cae en cordones | 6/11/19, 5/10/20 |
| E | D con lana «in heavy matted cords like dreadlocks… dull rusty brown-red in patches» y cornamenta «like weathered driftwood… long pointed tines like an old stag's» | **Muy cerca del banner**: rastas grises con óxido, cornamenta ramificada, rebaño | — |
| F | E con «musk ox» en vez de «yak» | Casi igual que E | — |

**Conclusiones (fauna):**

11. **El color no mide la forma**: B tiene la mejor distancia de color y es otro animal. En fauna la medida solo
    sirve entre prompts que ya dan el animal.
12. **Las palabras arrastran a una especie**: «pale bone antlers… blunt tines» da cuernos de toro; «antlers… tines
    like an old stag's» da cornamenta. Se nombra el parecido con un animal real para cada rasgo raro.
13. **Las texturas, con un parecido concreto**: «corded wool» no da cordones; «matted cords like dreadlocks» sí.
14. **«Streaked with rust red» se pinta como sangre**; el tinte va como «dull rusty brown-red in patches».
15. **El ancla del cuerpo pesa poco** cuando el cuerpo está bien descrito (E ≈ F).
16. Lo que la base hace mal en fauna es lo de las pautas y el mundo, no el lore: el perfil y los cuernos enroscados
    salen de `sexDimorphism.ts` y de la pose genérica, y los volcanes y acacias del paisaje de la región (regla 6).

## Flora: cardo-brújula (2026-11-08, klein 4B, semillas 3 y 4)

Hojas: `generated/banco/hojas/sueltas-cardo54-1.png` (A, B, C, D) y `sueltas-cardo54e-1.png` (E). La ficha no describe
el banner (agujas negras y piedras flotando): va como C, y el techo A se escribió aparte mirando el banner.

| Prueba | Resultado |
|---|---|
| A techo | Composición del banner (acantilado a la derecha, mesetas a la izquierda, filamento de alambre), pero cardos naturales y finos |
| B base | Un cardo suelto con **un colgante de hilo** («colgada de un hilo» del lore, pintado), volcanes, sol de cara |
| C ficha | Capullo de alcachofa violáceo grande, rocas negras y agujas: la ficha, no el banner |
| D lore | Composición del banner, capullo violáceo, arena oscura; planta fina y pequeña |
| E | D con «stem… twisted like wrought iron», «scales of hammered pewter», «fibre curls up like a bent wire»: filamento y tallo bien; **el capullo sigue pequeño** y lila pastel |

**Conclusiones (flora):**

17. **El uso no se describe, se pinta**: lo que la planta hace (colgada de un hilo, gira hacia un rumbo) sale como
    objeto literal. Solo se describe lo que se ve en la planta viva.
18. **Los materiales comparados** («wrought iron», «bent wire») sí cambian la forma; «as big as a melon» no cambia el
    tamaño con klein 4B (como la proporción de los pilares): el tamaño grande, a probar con FLUX.3.
19. «Faint violet tint» da lila pastel; el banner es gris metálico casi sin violeta.

## Objeto: amuleto de hueso (2026-11-08, klein 4B, semillas 3 y 4)

Sin ficha ni prompt en `ImagePrompt` (no hay B). Hojas: `sueltas-amuleto54-1.png` (A, D) y `sueltas-amuleto54e-1.png` (E).

| Prueba | Resultado |
|---|---|
| A techo | Muy cerca del banner (losa, banco, toldo rojo, meseta, amuletos colgados); algo limpio, de render |
| D lore | «Ivory-yellow» da **amarillo plástico**; colmillos enormes («the size of a thumb» no cuenta); el cordel «loop» se cierra como pulsera; fondo vacío |
| E | D con «dirty off-white, stained brown in its carved grooves, chipped and worn», «sags in a wide open curve»: color y cordel bien; el «red dust» sale como manchas rojas y las piezas como garras grandes |

**Conclusiones (objeto):**

20. **El color del material, con su suciedad**: «ivory-yellow» satura; «dirty off-white, stained brown in the grooves»
    acierta. El polvo rojo sobre algo claro se pinta como sangre (regla 14): mejor «dusty».
21. **La forma del conjunto, con un verbo**: «a loop» cierra el cordel; «sags in a wide open curve» lo abre.
22. **El entorno de uso hace el banner**: la losa, las herramientas y los amuletos colgados de A dan el taller; desde
    el lore solo, el fondo queda vacío. El generador debería poner al objeto en su sitio de uso con objetos vecinos.
23. El tamaño de las piezas pequeñas tampoco se sigue (regla 18).

## Construcción: ayuntamiento pequeño (2026-11-08, klein 4B, semillas 3 y 4)

Sin banner ni prompt en `ImagePrompt`: se juzga contra el lore (`AYUNTAMIENTO_PEQUENO_RECIPE`, `construction.ts`:
sala de consejo modesta, piedra apilada, vigas de leña trabada, un fuego central). Hojas `sueltas-ayunt54-1.png` (D, D2)
y `sueltas-ayunt54e-1.png` (E).

| Prueba | Resultado |
|---|---|
| D lore | Casa larga de **ladrillo ordenado** con techo de troncos; la hoguera pegada a la puerta, como chimenea |
| D2 | D + el estilo de clan de la choza (tendón, pieles, postes de hueso con marca): los huesos salen blancos, de dibujo; las pieles, franjas rojas |
| E | D2 con «like a dry-stone wall from irregular rough fieldstones of every size», «doorway is dark inside, with only a warm orange glow from a fire deep within», «tusks of old yellowed bone, cracked and dirty»: piedra más irregular y fuego dentro; los colmillos parecen pegados |

**Conclusiones (construcción):**

24. **«Stacked stones» da ladrillo**; la piedra irregular se pide con su parecido real («a dry-stone wall… fieldstones
    of every size»).
25. **Una luz que sale de dentro se pinta en la puerta** salvo que se diga que el interior está oscuro y la luz viene
    del fondo.
26. **Los adornos añadidos salen como atrezo pegado**: sin banner, menos adornos y unidos a la estructura.
27. **Sin banner, el lore no basta para la identidad**: sale un granero de piedra, sin nada orco. Falta una decisión de
    diseño (forma, tamaño, qué lo distingue de la choza) que no es del agente: propuesta para la usuaria y Álvaro.

## NPC: Gistera Koh (2026-11-08, klein 4B, semillas 3 y 4)

Sin banner, a propósito (usuaria: el suyo no casa con la raza ni con el diseño de hembra orca); se juzga contra la
raza (`fichas/raza/orcos-llanuras.json`, hembra) y su ficha (`worldCatalog.ts`: fugitiva, cazadora, cuchillo corto y
odre). Hojas `sueltas-gistera54-1.png` (D entera, D rodillas), `sueltas-gistera54ef-1.png` (E, F) y `sueltas-gistera54g-1.png` (G).

| Prueba | Resultado |
|---|---|
| D entera | Ilustración, no foto; figura pequeña; **orejas de elfo** (no pedidas); colmillos finos como bigote; cicatrices como trazos blancos |
| D rodillas | Lo mismo con la cara legible |
| E | rodillas + «young woman's face… small ears close to her head», «tusks like a wild boar's», «raised lines of old scar tissue»: siguen las orejas; cicatrices rojas, mejor |
| F | E + «a film still of an actress in realistic orc prosthetic makeup»: más foto y cara más orca |
| G | F sin la palabra «orc»: cara más humana, orejas algo menos; los colmillos se curvan a los lados |

**Conclusiones (NPC):**

28. **«Orc» trae el orco de videojuego** (orejas de elfo, ilustración) por encima de lo que diga el prompt; «a film
    still of an actress in realistic prosthetic makeup» lo acerca a foto.
29. **La analogía trae su forma entera**: «like a wild boar's» curva los colmillos a los lados como los del jabalí.
    Para la forma del canon hay que decir la dirección («short thick tusks pointing straight up»).
30. **Las cicatrices** se piden como tejido («raised lines of old scar tissue»), no como marca (regla 7).
31. **De las rodillas arriba** la cara se lee en P1; de cuerpo entero queda diminuta.

- Gistera H (truco de la usuaria en ChatGPT: no decir «hembra» ni nada femenino, pedirla musculosa y fuerte, y luego
  añadir el pecho): con klein 4B en una sola pasada sale **un varón con barba y bigote**; «a full chest» al final no
  cuenta, y los colmillos siguen curvados a los lados aunque se pida «point straight up». Hoja `sueltas-gistera54h-1.png`.
  En ChatGPT el truco son dos pasos (figura, luego edición); el equivalente aquí es una fase de edición sobre la imagen
  (P2 con la anterior como referencia: «give this warrior a woman's chest, keep everything else»): queda probarlo.
- Gistera en dos pasos (variante `rec-gistera`, klein 4B: P1 = H, P2 = «Make this warrior a woman: a young woman's
  face with no beard and no moustache, smooth skin, and a woman's chest… Keep everything else exactly the same»):
  **funciona**: mujer musculosa, misma pose, ropa y fondo. Pero «young woman's face, smooth skin» le quita lo orco a la
  cara y el colmillo se vuelve un palito. Hoja `sueltas-recgis-1.png`.

34. **El truco de la usuaria vale en dos pasos**: P1 sin palabras femeninas (sale fuerte), P2 de edición que nombra
    **solo** el cambio («add a woman's chest, remove the beard»); todo lo que se nombre en la edición se rehace.

## Raza: goirntes de la Meseta, macho (2026-11-08, klein 4B, semillas 3 y 4)

Hoja `sueltas-goirnte54-1.png` (filas A, B, D).

| Prueba | Resultado |
|---|---|
| A techo | ficha (escrita desde el banner, 330 palabras): composición del banner (muralla, ciudad con grúas, capa óxido), pero **un enano de dibujo** con orejas de elfo (el ancla «a stocky, tuskless orc») |
| B base | **Un gólem de piedra** sin cara: la base eligió «built like a golem of living iron», «three heads tall», y una meseta soleada |
| D lore | «A film still of an actor in realistic prosthetic makeup as a huge… humanoid», de los muslos arriba, piel «grey like slate» con «seams like the joints of an insect's shell»: **el más cercano al banner**; añade barba («actor» trae rasgos humanos) |

32. **El ancla de un pueblo no puede ser otra criatura**: «orc» trae orejas y dibujo, «golem» trae piedra sin vida.
    Mejor «a huge humanoid» y los rasgos uno a uno, cada uno con su parecido real.
33. Lo que se quiera quitar de lo humano se dice («beardless»).

## Lo común a todas las categorías

1. **El modelo puede**: en todas las categorías, un prompt escrito desde el lore con estas reglas se acerca al banner
   con klein 4B. Lo que falla es el prompt de la base: cambia el sujeto (lugar → bloques, múrgol → toro, goirnte → gólem,
   cardo → colgante), mete el paisaje de la región (volcanes, acacias) y la luz de atardecer en todo.
2. **Cada rasgo raro, con el objeto real al que se parece y su forma** (reglas 12, 13, 18, 24, 29): la forma la decide la
   analogía, no el adjetivo.
3. **Solo lo que se ve**: ni usos (17), ni reglas de estilo como «pale healed streaks» (7), ni «red streaks» (14, 20).
4. **El color de cada material, con su suciedad** (3, 19, 20).
5. **Encuadre por tipo**: lugar como paisaje con izquierda/derecha; fauna de frente con el rebaño; personas de los
   muslos o rodillas arriba; objeto en su sitio de uso con objetos vecinos (22, 31).
6. **Tamaño y proporción en números no los sigue klein 4B** (9, 18, 23): queda probarlo con FLUX.3.
7. **Sin banner, el lore puede no bastar** para la identidad visual (ayuntamiento, regla 27): decisión de diseño.

**Siguiente:** probar con FLUX.3 los mejores de cada categoría (acantilados D, pilares F, múrgol E, cardo E, amuleto E,
ayuntamiento E, Gistera F, goirnte D) y llevar las reglas a las pautas de `imagePromptGenerator.ts` y a `mundo.json`.
