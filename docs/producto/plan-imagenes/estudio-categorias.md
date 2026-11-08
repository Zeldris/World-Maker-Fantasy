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
