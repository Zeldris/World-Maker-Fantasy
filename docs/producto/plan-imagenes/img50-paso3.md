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

## Resultado del paso 4

Tras `b3bb845a` (reglas sin ejemplos copiables, solo lo visible, validador y región), los cuatro prompts regenerados, una F0
de cada prompt, el de antes y el de después, con la semilla 4021. Una sola muestra por elemento y a 480x192: indica, no mide.

| Elemento | Parecido con el banner | Antes → después | EMD Cb antes → después | EMD Cr antes → después |
|---|---|---|---|---|
| Cardo | **Mejor** | Un palo con un bulbo → un cardo espinoso con su hilo | 3,1 → 3,8 | 5,6 → 6,7 |
| Agujas | **Mejor, a medias** | Cantos rodados → agujas altas de roca negra; siguen sin las rocas flotantes y salen matas azules, porque el prompt pide vegetación de primavera «green and blue» | 7,8 → 6,2 | 7,0 → 10,0 |
| Hacha | **Mejor el entorno, igual el sujeto** | Sobre madera en un fondo vacío → en el suelo rojo de su región; sigue pareciendo un martillo y añade un trozo de hielo que viene del RAG | 2,9 → 3,8 | 6,1 → 5,5 |
| Goirnte | **Peor** | Un hombretón con capa, lo más cerca del banner, por la capa copiada de la regla → un gólem de piedra | 4,4 → 4,2 | 1,9 → 3,3 |

**Luz fija: confirmado que estorba.** Las ocho F0 salen claras y doradas, también las tres cuyo banner es oscuro y de tormenta
(Goirnte, Agujas, hacha). Solo el cardo acierta. Cambiar el cuerpo no lo arregla: la cola fija sigue pidiendo «soft
golden-hour rim light, warm atmospheric haze».

**El color medido no ve esto.** El Goirnte da EMD «ok» (4,2 y 3,3) con una imagen luminosa frente a un banner casi negro:
Cb y Cr miden el tono, no la luminosidad. Además, el EMD apenas se mueve con los cambios de la tabla, y no distingue la imagen
mejor de la peor.

**Problemas nuevos o que siguen en el texto:**

- **Rellena huecos mal:** «Low quality light» en el hacha (el `[quality]` tomado al pie de la letra) y un Goirnte de tres
  cabezas de alto, sin el dato en el lore.
- **Falla el sujeto del Goirnte:** «built like a golem of living iron»: el lore dice piel casi mineral y el modelo elige un gólem
  como cosa real con esa silueta. La causa es una lectura mía, sin probar: el ancla empuja a eso cuando el lore no dice
  a qué se parece el cuerpo.
- **«Sun» se cuela** en 3 de 4: la regla lo prohíbe, pero viene de la luz de región de `mundo.json` y el validador no lo mira
  de día.
- **Sigue lo no visible:** «repulsion», «magnetic pull», «points one direction».
- **Sigue la fuga del RAG:** el saquito de salvia y el hielo del hacha vienen de otros objetos.
- **Calcos fuera de la lista:** «the Windy Steppes». Una lista fija no los cubre todos.

**Por decidir:** ver [el apartado de `IMG-50`](../roadmap-imagenes.md). Nada de esto se ha aplicado todavía.

## Prompts de antes

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

## Prompts de después (paso 4)

### Goirntes de la Meseta

```text
Wide cinematic panorama from a low camera angle, layered depth from textured ground to hazy horizon, subject fully in frame. A male figure of angular, mineral-like density stands as a living construct of chitin and grey stone, built like a golem of living iron only with the organic texture of chitin skin. His body spans about three heads tall and shoulders nearly two heads wide, composed of a blocky, heavy frame where the skin is grey and taut over angular bones, tensing visibly to reveal a faint metallic sheen when he concentrates. His eyes are cold black obsidian and his jaw is wide and broad. He holds a low, grounded stance with legs set wide apart, his arms resting at his sides or gripping heavy tools cut from iron-grey metal, fastened with simple, functional clasps. The ground beneath him is a flat slab of grey stone, rising into stepped terraces of unnatural symmetry in the middle distance, where sparse iron-grey grass grows between the cracks. The horizon shows distant fortress walls of polished stone and black iron under a clear pale sky. Harsh high sun shines from above, casting crisp hard shadows that define the sharp angles of his form and the geometric precision of the stone architecture surrounding him. Style: photorealistic fantasy matte painting, cinematic concept art, soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded. Shot on a full-frame camera with an 85mm lens. The image is completely textless.
```

### Cardo Brújula

```text
Wide cinematic panorama from a low camera angle, layered depth from textured ground to hazy horizon, subject fully in frame. A spiky thorny plant with a rigid stem about four times the length of its central leaf cluster stands as a flora featuring a closed flower of dull metallic grey. The stem runs from the ground up to the flower head, where a single central magnetic fiber hangs from a thin thread pointing one direction. This thorny plant resembles a common burdock, only with a rigid metallic core and a permanently oriented magnetic thread. The plant sits in the lower third from the bottom edge on red clay soil, surrounded by tufts of dry straw-yellow grass tinged with orange in the middle distance. Far off on the horizon, low volcanic peaks rise from the haze. Warm golden rim light from the low sun just above the horizon through a haze of red dust illuminates the scene, casting long shadows across the red dust drifting on the wind. The metallic grey of the flower contrasts with the orange grass and red earth, while the magnetic fiber catches the golden glow. Style: photorealistic fantasy matte painting, cinematic concept art, soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded. Shot on a full-frame camera with a 50mm lens. The image is completely textless.
```

### Las Agujas Imán

```text
Wide cinematic panorama from a low camera angle, layered depth from textured ground to hazy horizon, subject fully in frame. A field of black, magnetic rocks suspended by repulsion, only the compass thistle growing in the lee wind. The dark stone spires stand tall and slender, each about ten times the length of its own base width, with fine red dust coating every surface and continuous ridges of magnetized sand running from the lower third up to the middle distance. The formation leans gently against the magnetic pull, creating floating stalactites that drift between the main pillars. A low camera angle captures the scene from the textured red clay steppe, where tufts of dry straw-yellow grass tinged with orange break the uniformity of the earth. In the middle distance, scattered savanna scrub and small tufts of fresh spring vegetation appear in vivid green and blue hues. The horizon holds low volcanic peaks far off in a haze of red dust, while the sky above glows with warm golden rim light from the low sun just above the horizon. The entire composition sits within a vast red clay steppe under clear daylight, with fine red dust drifting on the wind and pale healed streaks visible on the oldest stone surfaces. Style: photorealistic fantasy matte painting, cinematic concept art, soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded. Shot on a full-frame camera with a 24mm lens. The image is completely textless.
```

### Hacha de guerra rota

```text
Wide cinematic panorama from a low camera angle, layered depth from textured ground to hazy horizon, subject fully in frame. A broken war axe rests on rough red clay, a heavy blunt instrument with a split metal head and a short wooden haft. The head is heavy iron, split cleanly down the middle to form two blunt striking faces that are now dull grey with oxidation, while the haft is dark brown wood wrapped tightly in several turns of worn leather strips that show scuff marks from use. The axe lies flat on the ground, angled slightly toward the right, its weight settled firmly into the soft earth. Beside it sits a small pouch of dried sage cataplasm and a shard of silicate ice knife, both resting against the lower third from the bottom edge. The scene opens with the textured red soil of the Windy Steppes, moving into a middle distance of dry straw-yellow grass tufts and low volcanic scrub, then fading to a hazy horizon of distant peaks. Low quality light from just above the horizon through a haze of red dust throws a warm golden rim light across the fractured iron and the leather wrappings, casting long soft shadows that stretch toward the left. Style: photorealistic fantasy matte painting, cinematic concept art, soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded. Shot on a full-frame camera with a 50mm lens. The image is completely textless.
```
