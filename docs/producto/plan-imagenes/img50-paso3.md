# `IMG-50`, paso 3: prompts de la IA en otros tipos

Prueba del 2026-11-07 con `qwen35-9b-32k`, un prompt por elemento (45-102 s cada uno, con RAG y sin ejemplos, porque ningún
elemento de estos tipos tiene `promptUsado`). Llama a `generateImagePrompt` con la misma entrada que la cola, **sin guardar
en `ImagePrompt`**. Juicio sobre el texto, contrastado con el banner y el lore de cada elemento; **no se generó ninguna
imagen**. Una sola muestra por elemento: las frecuencias son indicios, no medidas.

## Veredicto

La hipótesis de partida se cumple solo en parte: el modelo conserva casi todos los rasgos del lore (flor gris cerrada, piel
mineral, cabeza partida, tiras de cuero). Pierde lo distintivo en 2 de 4, y lo que más estorba es otra cosa.

| # | Problema | Dónde | Causa |
|---|---|---|---|
| 1 | **Copia los ejemplos de las reglas** | «Warm light low from the left» en 4 de 4. Goirnte: «built like a heavy-set human, only broader and greyer», «about seven heads tall», «a hide cape cut to the knee, laced at the chest», literales de la pauta de `npc` (la capa no está en el lore) | Los huecos de `37859bcd` se pusieron en `REGLAS_COMUNES`; quedan ejemplos en `PAUTAS_TIPO` y en la regla de la luz |
| 2 | **Aplica una regla de criaturas a todo** | «dull metallic grey growing from the skin» (hierro); «growing from the skin of the landscape» (rocas) | «say the material grows from the skin» está en las reglas comunes |
| 3 | **Se pierde qué es el sujeto** | Cardo → «the build of a cactus» (el banner es un cardo); hacha partida → «a heavy mace» (el lore dice que se *usa* como maza) | Prohibir el nombre propio le quita también el nombre común («thistle»), y el uso se confunde con la forma |
| 4 | **Escribe lo que no se ve** | «always points the same direction», «repulsion from opposite polarity», «magnetic north», «as if listening to a command» | Ninguna regla pide escribir solo lo visible |
| 5 | **El validador deja pasar nombres del mundo** | «Goirnte», «Red Wind Plains», «compass thistle» | `validarPrompt` busca solo el nombre exacto de la entidad |
| 6 | **Sin región no hay paisaje** | `region` es `undefined` en raza e item, aunque `mundo.json` tiene la Meseta del Orden y el lore del hacha dice «Llanuras del Viento Rojo» | `loreContextFor` no la resuelve en esos tipos |
| 7 | **Lugares: el paisaje tapa al sujeto** | Agujas: una sola frase larga que pega el paisaje de la región como forma del sitio («shaped like a vast red clay steppe»); las rocas flotantes, lo que define el banner, quedan en «floating stalactites»; no abre por el horizonte como pide la pauta | Por confirmar con más lugares |

**Luz fija, a revisar con imágenes:** la cola pide «soft golden-hour rim light, warm atmospheric haze» de día y al atardecer
(`mundo.json`). De los 7 banners vistos, 4 son oscuros o de tormenta (Goirntes, Agujas, hacha, múrgol) y 3 cálidos (cardo,
cuchillo, amuleto). Puede explicar parte del cielo de tormenta que le faltaba a múrgol, también con su `promptUsado`. Sin
imágenes no está comprobado.

**Lo que no hay que tocar:** el «still life» de `item`. El cuchillo y el amuleto lo cumplen, y el hacha empuñada es la excepción.

## Prompts

### Goirntes de la Meseta (`raza/goirntes-meseta-macho`)

```text
Wide cinematic panorama from a low camera angle, layered depth from textured ground to hazy horizon, subject fully in frame. A male Goirnte stands in the left third of the frame from head to toe, built like a heavy-set human, only broader and greyer, about seven heads tall with shoulders three heads wide. His skin is almost mineral and chitinous, grey and taut over angular bones, showing a faint metallic sheen when he concentrates, with eyes of cold obsidian black and a wide chin. He holds a low, grounded stance, his body angled slightly inward as if listening to a command. A hide cape cut to the knee, laced at the chest, drapes over his shoulders, while a belt of iron-woven leather cinches his waist. The ground beneath him is stone-grey and perfectly symmetrical, rising into a middle distance of polished fortresses and black iron towers, then fading into a horizon of hazy, ordered cliffs. Warm light low from the left highlights the metallic gloss on his skin and the texture of his chitinous hide. The scene is bright and clear, emphasizing the precision of his form and the rigid geometry of the surrounding city of polished stone and iron. Style: photorealistic fantasy matte painting, cinematic concept art, soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded. Shot on a full-frame camera with an 85mm lens. The image is completely textless.
```

### Cardo Brújula (`flora/cardo-brujula`)

```text
Wide cinematic panorama from a low camera angle, layered depth from textured ground to hazy horizon, subject fully in frame. A rigid thorny plant with a closed bud of dull metallic grey stands as a natural magnetized needle, the build of a cactus with a single hanging central fiber that always points the same direction. The structure features a stiff stem about twice the length of the root system, topped by a closed bud of dull metallic grey that runs from the apex down to the first thorny node. The pose is upright and static, anchored firmly in the red clay. In the lower third from the bottom edge, the ground is a vast red clay steppe with tufts of dry straw-yellow grass tinged with orange. The middle distance shows scattered savanna scrub and low volcanic peaks far off in the haze, while the horizon holds fine red dust drifting on the wind. Warm light low from the left casts a golden rim light across the scene, illuminating the metallic grey of the plant against the warm earth tones of the landscape. Style: photorealistic fantasy matte painting, cinematic concept art, soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded. Shot on a full-frame camera with a 50mm lens. The image is completely textless.
```

### Las Agujas Imán (`location/agujas-iman-dia-primavera`)

```text
Wide cinematic panorama from a low camera angle, layered depth from textured ground to hazy horizon, subject fully in frame. A field of black magnetic rocks floating by repulsion from opposite polarity, standing as a field of magnetized stones where magnetic sandstorms comb the ground into ridges and floating stalactites, shaped like a vast red clay steppe with tufts of dry straw-yellow grass tinged with orange, scattered savanna scrub and low volcanic peaks far off in the haze, fine red dust drifting on the wind, a field of magnetized stones running from the lower third up to the upper edge, black magnetic rock growing from the skin of the landscape, black magnetic rock about ten times the width of a floating stalactite, tilted slightly eastward to face the magnetic north, a single compass thistle growing from the southern edge of the field to point the way, the ground layer of red clay and tufts of dry straw-yellow grass tinged with orange, middle distance of scattered savanna scrub and magnetic sand ridges, horizon of low volcanic peaks far off in the haze, warm light low from the left throwing a warm golden rim light, day with clear solar light and direct visibility of all landscape details, spring with vegetation in bud, vibrant and fresh colors, temperate climate. Style: photorealistic fantasy matte painting, cinematic concept art, soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded. Shot on a full-frame camera with a 24mm lens. The image is completely textless.
```

### Hacha de guerra rota (`item/hacha-guerra-maktor-rota`)

```text
Wide cinematic panorama from a low camera angle, layered depth from textured ground to hazy horizon, subject fully in frame. A heavy mace resting on rough wood, the build of a broken war axe only used as a blunt hammer. The head is split iron, the left half about half the length of the right half, both halves about twice the width of the handle. The split iron head shows a dull metallic grey growing from the skin, with one jagged edge about twice the length of the other. The handle is dark brown wood, about seven times the length of the iron head, wrapped in several turns of reddish-brown leather strips running from the grip to the base of the head. The leather strips are about one third the length of the wood handle. The mace stands upright, the split head tilted slightly to the right. The background is softly blurred, showing hints of the Red Wind Plains. The lower third, from the bottom edge, holds the rough wood surface. Warm light low from the left illuminates the scene, casting a soft shadow to the right. The setting is quiet, with the only focus on the broken weapon and the leather wrapping. Style: photorealistic fantasy matte painting, cinematic concept art, soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded. Shot on a full-frame camera with a 50mm lens. The image is completely textless.
```
