# Investigación: prompts para criaturas, plantas y lugares inventados (FLUX.3 Klein)

Fecha: 2026-10-26. Rama `claude/plan-imagenes`. Encargo: bajar a prácticas concretas cómo escribir la ficha para que
FLUX.3 Image Klein dibuje criaturas inventadas como un diseñador de concept art y como salen en los banners de
ChatGPT (fallos de r10-r12: manada de otra especie, proporciones que se diluyen hacia el ancla, fondo que pierde
calidad con la criatura, poses de frente simétricas).

Convenciones: cada afirmación lleva su enlace. **[sin fuente primaria]** marca lo que es inferencia mía o viene de un
resumen de terceros. **[hipótesis]** marca un cambio que hay que probar en el banco antes de adoptarlo. No se generó
nada para este documento; las medidas de palabras salen de `prompt_ficha.py` sin lanzar el generador.

## 1. Resumen

1. **El prompt actual se recorta a sí mismo.** Con el perfil `banner`, el aullador macho (312 palabras) y el
   cuernahoja macho (300) pierden **B5 (entorno) y B6 (luz)**: `prompt_ficha.py --json` devuelve
   `recortados: ['B6','B5']` en los dos. Unas 145 palabras de las 320 son texto fijo (encuadre, estilo, preámbulo), así que
   la ficha dispone de ~175. Parte de «el fondo pierde calidad con la criatura» es literalmente que el fondo no llega
   al modelo. (Comprobado en esta rama; r12 habló de un perfil `fotorreal` que no está en `estilo/mundo.json` de este
   árbol de trabajo, así que habrá que repetir la medida con ese perfil.)
2. **El ancla pesa más que la descripción.** «fox» sale 3 veces en el aullador («three times the length of a fox»,
   «a red fox stretched to…», «fox-like head») y «giraffe» y «deer» compiten en el cuernahoja. Un codificador que lee
   como un LLM (Qwen3) agarra la palabra más familiar y dibuja ese animal. Los diseñadores de criaturas parten de un
   animal real y lo deforman por partes (ver §2); en el prompt eso se traduce a **«cabeza de X, cuerpo de Y»** con la
   proporción dicha en medidas internas (tantas cabezas de largo), no «un X estirado».
3. **La manada falla porque se pide por referencia** («more of the same…»). Una referencia anafórica lejana se
   resuelve mal; repetir la frase nominal completa con sus 3-4 rasgos propios en la misma oración (§4) y, mejor, hacerlo
   **por composición** (copiar al protagonista como referencia o recorte), no por fraseo.
4. **ChatGPT compone mejor en parte porque reescribe el prompt**: la propia OpenAI lo documenta (§6). BFL hace lo
   mismo con *prompt upsampling* en FLUX.2 [dev/pro], pero **Klein no lo incluye**. Se puede imitar con un LLM local,
   en lote, con la salida validada por las mismas reglas y guardada en la ficha para no perder el determinismo.
5. **Las guías oficiales piden menos adjetivos de calidad y una sola señal de realismo**, orden sujeto-primero y luz
   con fuente nombrada. Nuestro estilo apila «photograph, hyper-detailed, razor-sharp, ultra detailed…, Shot on…».

## 2. Cómo diseña una criatura un artista (y qué se traduce)

Lo que se encontró en fuente primaria es escaso; lo anoto tal cual.

- **Anatomía real primero, deformación después.** El taller de Terryl Whitlatch en Gnomon parte de un estudio de un
  animal real (un bovino para su «Moo Monster»), estudia esqueleto y musculatura y su efecto en la superficie, y apunta
  a criaturas «biológicamente creíbles» por estilo de vida, entorno y función
  ([Gnomon, Creature Design with Terryl Whitlatch Vol. 1](https://www.thegnomonworkshop.com/tutorials/creature-design-with-terryl-whitlatch)).
  Su segundo volumen parte de miniaturas y de un estudio real de cálao
  ([Gnomon, Vol. 2](https://sae.thegnomonworkshop.com/tutorials/creature-design-with-terryl-whitlatch-vol2)).
  *Traducción:* el prompt debe nombrar la **estructura** que da la proporción (columna larga, tórax profundo, patas
  cortas), no solo la comparación.
- **Miniaturas y siluetas.** Whitlatch empieza con miniaturas (misma página de Gnomon). La página **no** menciona
  siluetas; el «esqueleto → músculo → piel → detalle» de cuatro pasos sale de un resumen de terceros
  ([skillselion](https://skillselion.com/skills/omer-metin/skills-for-antigravity/creature-design)) **[sin fuente
  primaria]**. El consejo genérico de «silueta legible» sí está en
  [Creative Bloq](https://www.creativebloq.com/features/15-tips-for-better-creature-design) (no es de un autor de
  referencia).
- **Carlos Huante:** curso de Gnomon que lo describe como intuitivo, con formas orgánicas sueltas y mucho
  conocimiento anatómico ([Gnomon, Techniques of Carlos Huante](https://www.thegnomonworkshop.com/tutorials/the-techniques-of-carlos-huante-1)).
  La entrevista de CG Channel
  ([10 questions](https://www.cgchannel.com/?p=64848)) **no** habla de su método. Nada citable sobre proporciones
  exageradas **[sin fuente primaria]**.
- **Jordu Schell:** esculpe masas grandes, fija la pose y luego añade músculo y detalle
  ([Gnomon, Jordu Schell Creature Studio](https://bit.thegnomonworkshop.com/workshops/jordu-schell-creature-studio));
  insiste en que los detalles transmitan la personalidad (misma fuente, vía resumen). Nada sobre vistas
  ortogonales **[sin fuente primaria]**.
- **Vistas (perfil, tres cuartos):** en la bibliografía de Whitlatch son la base de las láminas, pero **no** hallé
  texto citable que lo explique **[sin fuente primaria]**. Es práctica común del oficio; para el prompt, lo que
  importa es que el **perfil** enseña la proporción larga/baja y el **tres cuartos bajo con peso en una pata**
  rompe la simetría.

Lo que sí se desprende con seguridad: el diseñador no describe «un zorro estirado»; construye sobre una estructura
y la pone en una vista que la enseñe. El prompt debería hacer lo mismo.

## 3. Cómo leen el prompt Klein y las guías oficiales

- **Codificador y límite.** `Flux2KleinPipeline` usa `Qwen3ForCausalLM` como codificador de texto, con
  `max_sequence_length=512` y las capas ocultas 9, 18 y 27 (<https://huggingface.co/docs/diffusers/main/en/api/pipelines/flux2>).
  Es la API de FLUX.2 [klein]; **no verifiqué que FLUX.3 Image Klein con Qwen3VL-4B y `sd-cli` coincidan**
  **[sin fuente primaria para FLUX.3]**, ni qué hace `sd-cli` al pasar de 512 tokens. Un prompt de 320 palabras en
  inglés ronda 420-460 tokens: **cerca del tope**, y lo que cae es lo último (el preámbulo, hoy). Hay que medir con
  el tokenizador real. Al ser un codificador causal, cada token solo «ve» lo anterior (inferencia mía a partir de la
  clase `…ForCausalLM`) **[sin fuente primaria]**: las referencias hacia atrás («Its», «the same») funcionan peor
  cuanto más lejos están.
- **Orden.** «FLUX.2 pays more attention to what comes first»; prioridad: sujeto → acción → estilo crítico →
  contexto esencial → detalles secundarios ([BFL, guía FLUX.2](https://docs.bfl.ai/guides/prompting_guide_flux2)).
  Si la cámara se aleja demasiado: sujeto primero y el entorno después
  ([BFL, building a prompt](https://docs.bfl.ai/guides/prompting_unified_building)).
- **Longitud.** FLUX.2: 80+ palabras para escenas complejas; «A clear structure matters more than length» y «Leave
  out quality tags such as "masterpiece"» ([BFL, building](https://docs.bfl.ai/guides/prompting_unified_building)).
  Para realismo, «describe what a camera would record… one is enough» (misma página).
- **Sin negativos:** «FLUX.2 does not support negative prompts» (guía FLUX.2, arriba); ya lo cumplimos (regla 3).
- **Varios sujetos:** «Describe relationships directly when they matter» (building); la guía FLUX.2 usa un array
  `subjects` con `description`, `position` y `action` para escenas complejas, y dice que entiende JSON y prosa por
  igual (guía FLUX.2). Para Klein **no hay guía propia**: la página de resumen no trae nada específico
  ([BFL, overview](https://docs.bfl.ai/flux_2/flux2_overview) solo dice «Write detailed, descriptive prompts»).

## 4. Prácticas concretas

Ordenadas por lo prometedoras que me parecen. Cada una dice qué cambia en las fichas o en `prompt_ficha.py`.

### P1. Presupuesto de palabras: texto fijo corto, ficha entera

- **Por qué:** el recorte quita entorno y luz (§1). BFL: sin etiquetas de calidad y una sola señal de realismo
  ([building](https://docs.bfl.ai/guides/prompting_unified_building)).
- **Cambio:** en `mundo.json`, `estilos.banner.base/acabado`, `encuadres.banner` y `preambulo.*` pasan de ~145 a
  ~60 palabras: una frase de formato («Cinematic wide frame, 35mm lens, sharp focus from foreground to horizon»), una de
  mundo y la luz **dentro de la ficha** (una sola fuente de luz, la de la ficha). Quitar «hyper-detailed»,
  «razor-sharp», «ultra detailed», «vivid saturated». En `prompt_ficha.py`: el recorte pasa a avisar **antes** de quitar
  B5/B6 y a recortar primero el texto fijo (B8/B9 duplicados) y no el fondo. **[hipótesis]**: compararlo con r12.
- Medida añadida: palabras × 1,4 como estimación de tokens, aviso a >450 (límite 512, §3).

### P2. Ancla por partes y proporción por estructura

- **Por qué:** §2 (estructura primero) y la repetición de «fox»/«giraffe» (§1).
- **Cambio en fichas:** `ancla` pasa de «a red fox stretched to the length of a weasel» a «the head of a red fox on
  the long, supple torso of a weasel» (cabeza de X, cuerpo de Y). La proporción se dice en medidas del propio animal,
  una vez y sin la palabra del ancla: «the torso is as long as five of its own heads laid end to end; the legs are
  shorter than the chest is deep». Cuernahoja: «from shoulder to the top of the head it measures the same as from
  shoulder to the ground». Para escala absoluta, metros («its head held about three and a half metres up»), no
  «above an adult orc» (el modelo no sabe qué es un orco de la ficha). **[hipótesis]** (sin fuente que lo demuestre
  para Klein; es la traducción de §2 y de que el codificador es un LLM).
- **Cambio en `prompt_ficha.py`:** nuevo campo `proporcion` (frase corta) que va **dentro de B1, antes del ancla**, y
  un aviso si una palabra de animal real aparece más de 2 veces en el prompt.

### P3. Manada: repetir la frase nominal completa y, mejor, componerla

- **Por qué:** la fuga de atributos entre sujetos es un fallo documentado: la atención «tiende a mezclar rasgos
  visuales de distintos sujetos» y falla más cuando los sujetos se parecen
  ([Bounded Attention, arXiv 2403.16990](https://arxiv.org/html/2403.16990v1)); el *attribute binding* es un problema
  abierto de los modelos de difusión ([StructureDiffusion, arXiv 2212.05032](https://arxiv.org/abs/2212.05032), que lo
  ataca con la estructura lingüística de la frase). En 1Prompt1Story, la descripción de identidad va **primero** y
  las siguientes comparten la misma frase ([arXiv 2501.13554](https://arxiv.org/html/2501.13554v3)); ellos mismos
  señalan fuga semántica entre fragmentos. BFL, para personajes repetidos: «repeat detailed character descriptions
  across every panel prompt» ([guía FLUX.2](https://docs.bfl.ai/guides/prompting_guide_flux2)).
- **Cambio en fichas (fraseo):** el campo `pose` deja de decir «more of the same long, crested hunters» y repite la
  frase nominal con sus rasgos de silueta: «a pack of six more hunters, each one long and low, with a rust coat, a
  black plate crest with red spikes and pale sabre fangs». Se añade el campo `manada` (frase nominal reutilizable)
  que `prompt_ficha.py` pega en B4; así no se reescribe a mano.
- **Cambio de proceso (composición):** la salida fiable es no pedirle al modelo que invente la manada. Klein admite
  imágenes de referencia: la guía FLUX.2 dice «describe how each input should be used» y hasta 8 referencias a 1 MP
  ([guía FLUX.2](https://docs.bfl.ai/guides/prompting_guide_flux2); la BFL anuncia coherencia con múltiples
  referencias en [FLUX.2](https://bfl.ai/blog/flux-2)). Es la «cadena de planos» (r13): 1) protagonista, 2) recorte
  reducido y repetido con bruma en ffmpeg, 3) pasada corta de armonización. Los métodos de investigación
  ([ConsiStory, arXiv 2402.03286](https://arxiv.org/abs/2402.03286); 1Prompt1Story) tocan la atención interna y no
  están en `sd-cli`: **no son aplicables hoy**.

### P4. Poses asimétricas y vista que enseñe la proporción

- **Por qué:** las poses «de frente» salen simétricas. BFL y OpenAI recomiendan decir ángulo y encuadre: low-angle,
  Dutch, plano ([BFL, building](https://docs.bfl.ai/guides/prompting_unified_building);
  [OpenAI, gpt-image prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide):
  «Specify framing and viewpoint»).
- **Cambio en fichas:** `pose` incluye siempre (a) ángulo bajo, (b) peso en una pata, (c) cabeza girada o una pata
  adelantada, (d) la vista: **perfil** para cuerpos largos, **tres cuartos bajo** para cuellos largos, con el cuello
  recortado contra el cielo. En `prompt_ficha.py`, un aviso si `pose` no contiene ninguna de una lista de palabras de
  asimetría (`turned`, `lifted`, `weight`, `three-quarter`). **[hipótesis]**.
- Encuadre: el banner 1280×512 es 2,5:1; un animal de cuello de jirafa con «sky across the top sixth» sale pequeño.
  `encuadres.banner` debería dejar al sujeto ocupar ~3/4 del alto (inferencia mía **[sin fuente primaria]**).

### P5. Luz con fuente nombrada y una sola vez

- **Por qué:** «Name the source and say what the light does» y ejemplos como «soft golden rim light» y «golden hour»
  ([BFL, building](https://docs.bfl.ai/guides/prompting_unified_building)); hoy la luz está repartida entre `luz`,
  el estilo («dramatic rim lighting») y el preámbulo (dos veces «rim light»).
- **Cambio:** que `luz` sea la única descripción de luz y la que se protege del recorte; el preámbulo deja solo el
  mundo. Una frase por fuente: «The low sun behind the pack rims fur and spikes with orange light; dust glows in the
  backlight.»

### P6. Cámara y lente: poco y verosímil

- **Qué dicen las guías:** BFL da ejemplos con cuerpo y objetivo («Shot on Hasselblad X2D, 80mm lens, f/2.8», «Canon
  5D Mark IV, 24-70mm at 35mm, golden hour, shallow depth of field») y dice que un modelo de cámara concreto da
  resultados «más auténticos» que términos genéricos ([guía FLUX.2](https://docs.bfl.ai/guides/prompting_guide_flux2)).
  OpenAI: usar lenguaje fotográfico, pero «detailed camera specs may be interpreted loosely»; «photorealistic»,
  «real photograph» ayudan; evitar palabras que impliquen estudio o puesta en escena
  ([OpenAI guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)).
- ***Anamorphic*:** **no hallé guía oficial** de BFL ni de OpenAI que lo nombre. Lo único cercano es el ejemplo
  de BFL «Ultra-wide cinematic shot… 21:9… soft golden rim light»
  ([BFL, building](https://docs.bfl.ai/guides/prompting_unified_building)). Hay que probarlo en el banco
  **[sin fuente primaria]**.
- **Cambio:** un solo bloque de cámara por perfil (`banner`: 35 mm, ángulo bajo, foco profundo para que el fondo
  conserve detalle; una distancia focal larga con poca profundidad de campo desenfoca justo el fondo que queremos
  nítido, inferencia mía **[sin fuente primaria]**) y, como prueba, comparar «35mm» frente a «anamorphic 40mm» y
  «shot on a cinema camera».

### P7. Reescritura previa con LLM local, en lote y cacheada

- **Por qué ChatGPT compone mejor:** DALL·E 3 reescribía todos los prompts con GPT-4 («we use GPT-4 to optimize all
  of your prompts… very detailed prompts give significantly better results») y no se podía desactivar
  ([OpenAI Cookbook, What's new with DALL·E 3](https://developers.openai.com/cookbook/articles/what_is_new_with_dalle_3)).
  Con gpt-image en la API de Responses, «the mainline model… will automatically revise your prompt», visible en
  `revised_prompt` ([OpenAI, image generation](https://developers.openai.com/api/docs/guides/image-generation)).
  El artículo de DALL·E 3 atribuye la mejora a entrenar con descripciones largas, y el reescritor las imita (resumen
  de la [OpenAI DALL·E 3 paper](https://cdn.openai.com/papers/dall-e-3.pdf); no pude abrir el PDF entero, cito el
  resumen de búsqueda). **No hay fuente primaria de lo que reescribe ChatGPT con gpt-image en la web**, que es lo que
  vieron las referencias del juego **[sin fuente primaria]**.
- **BFL ya lo hace para FLUX.2:** su mensaje de sistema de *upsampling* pide añadir «forma, escala, texturas,
  materiales, luz, sombras, relaciones espaciales y contexto del entorno», conservar el sujeto y devolver solo el
  prompt ([flux2/system_messages.py](https://github.com/black-forest-labs/flux2/blob/main/src/flux2/system_messages.py),
  leído vía resumen); la temperatura recomendada es 0,15
  ([diffusers, Flux2](https://huggingface.co/docs/diffusers/main/en/api/pipelines/flux2)). Y «FLUX.2 [klein] does not
  include prompt upsampling» ([overview](https://docs.bfl.ai/flux_2/flux2_overview)): hay que ponerlo nosotros.
- **Cambio en `prompt_ficha.py`:** opción `--reescribir` (y script aparte) que manda la ficha completa a Ollama con un
  mensaje de sistema propio (borrador abajo), temperatura 0,15, semilla fija; pasa el resultado por `_comprobar`
  (negaciones, vetadas, 120-320 palabras, nombre propio, momento) y, si pasa, lo guarda en la ficha como
  `prompt_final` con su hash. Misma ficha + mismo hash = mismo texto, así se mantiene la regla 1 (determinismo) en el
  sentido que importa. Se hace **en lote y antes de generar**, nunca con `sd-cli` en marcha (memoria de la Deck).
- **Riesgo:** un LLM pequeño estandariza («majestic creature») y puede suavizar lo raro, que es justo lo que queremos
  conservar. El mensaje de sistema debe fijar las frases-ancla de la ficha (rasgos, proporciones) como intocables.

Borrador del mensaje de sistema (en inglés porque el prompt va en inglés):

```
You rewrite a creature, plant or place sheet (JSON) into ONE image prompt of 150-300 words for a diffusion model.
Rules: start with the main subject in its camera view and pose; keep every distinctive trait and every measured
proportion of the sheet word for word, in the sheet's order; describe each repeated creature in the background with
the full noun phrase and its three defining traits, never with "same" or "more of"; name one light source and what it
does to the subject; state lens and angle once. Use only affirmative sentences. Do not invent traits, names or animals
that are not in the sheet. Return only the prompt.
```

(Este texto sí lleva negaciones, pero es un mensaje de sistema, no un prompt de imagen; la regla 3 se aplica a la
salida.)

### P8. Orden de bloques: rasgos distintivos antes del ancla

- **Por qué:** orden/primacía ([BFL](https://docs.bfl.ai/guides/prompting_guide_flux2)) y codificador causal (§3).
- **Cambio:** B1 queda «vista + sujeto + proporción», B2/B3 los rasgos de silueta (cresta, cuernos, colmillos), y el
  `ancla` pasa a una frase tardía y corta, o desaparece si P2 la absorbe. **[hipótesis]**.

### P9. Lugares y plantas

- **Lugares:** capas explícitas (primer plano, plano medio, horizonte) con un material por capa, y la luz de P5;
  es lo que hace ChatGPT en sus banners (r9: «suelo con textura fina, cielo cubierto y dramático»). Coincide con el
  flujo de «fondo primero, sujeto después» de [`investigacion-tecnicas-diseno.md`](investigacion-tecnicas-diseno.md).
- **Plantas:** pedir el paisaje alrededor y no macro (r9: «cardo como un huevo en macro»); proporción en medidas
  (altura respecto a la planta o al sujeto de escala conocido), no «like an egg».

## 5. Ejemplos reescritos

Cumplen el límite de 120-320 palabras del **prompt completo** (texto fijo incluido, ya compactado según P1), no
llevan negaciones ni palabras vetadas, y siguen P2-P5. Son prompts finales para probar; no sustituyen aún las fichas.

### Aullador rojo (macho, atardecer)

```
A long, low pack hunter in full side profile, seen from a low camera angle with its weight on one foreleg and its head turned slightly toward the viewer. Its body is a ribbon: the torso is as long as five of its own heads laid end to end, with a deep chest and a flexible spine, carried on short, strong legs shorter than the depth of its chest, each ending in dark curved claws. Its narrow head belongs to a red fox, with tall pointed ears, an amber eye and two long pale sabre fangs hanging below the lower jaw. The short, dense coat is warm rust brown, paler in faint stripes along the flanks. A crest of overlapping black armoured plates runs unbroken from the nape along the whole spine and down the long banded tail to its dark spiny tip, edged with a row of sharp glowing red spikes. This male is heavier in the neck and shoulders, with longer fangs and a taller crest. Behind it lopes a pack of six hunters, each one a long, low hunter with a rust coat, a black plate crest with red spikes and pale sabre fangs, smaller and hazier with distance. The ground is cracked red earth with sparse dry tufts, and dark dust devils rise far off on the plain. The low sun sits behind the pack and rims every coat and spike with fiery orange light, while thick drifting dust glows in the backlight and a dense red-orange haze tints earth and sky alike. Cinematic wide frame on a 35mm lens, sharp focus from the lead hunter to the horizon, concept art for a feature film.
```

### Cuernahoja (macho, día)

```
A tall, slender herd grazer in three-quarter view from a low camera angle, caught mid-step with its weight on the far hind leg and its small head turned toward the viewer. Its upright neck is as long as its legs: from the shoulder to the top of the head it measures the same as from the shoulder to the ground, so the head is held about three and a half metres above the earth. The head is small and deer-like, with large dark eyes and a short tuft of beard. Two wide, flat horns shaped like broad leaf blades, pale bone grey and veined like real leaves, stick out straight sideways from the top of the head. The very short coat is rust red along the back and neck and creamy white on the belly, throat and inner legs. Each long leg ends in a large splayed foot of three clawed toes, like a big bird's. This male has the larger, wider-spreading leaf horns of the herd. Around it graze and wander five more grazers at different distances, each one a tall slender animal with a long upright neck, a small deer-like head and two flat pale leaf-blade horns sticking out sideways, smaller and softer with distance. The land is red desert earth with dry scrub and tufts of pale grass, and red sandstone mesas and spires stand on the horizon. Clear daylight under a blue sky with scattered white clouds, the sun high and to the left so the long neck and the horns cast crisp shadows on the ground. Cinematic wide frame on a 35mm lens, the animal filling three quarters of the image height, sharp focus from the foreground to the mesas, concept art for a feature film.
```

Comprobado al escribir el documento con la expresión `negaciones` y los patrones `vetadas` de `mundo.json`: el
aullador tiene 279 palabras y el cuernahoja 291, sin negaciones ni vetadas (~390 y ~410 tokens estimados, bajo los 512).
La regla 9 (momento) y la del nombre propio no se pasaron; las comprueba `prompt_ficha.py` al convertirlos en fichas.

## 6. Cómo probarlo sin gastar rondas

Orden barato (cada prueba son ~50 min en la CPU, así que una variable por tanda):

1. **P1 + P5** juntos en el aullador (misma semilla 3 que r12): si el fondo mejora, el recorte era la causa.
2. **P2** sola (ancla por partes + medidas): mide si el largo/bajo se acerca al de ChatGPT.
3. **P3 composición** (referencia/recorte) frente a P3 fraseo, con el cuernahoja.
4. **P4** (tres cuartos bajo) y **P6** (35 mm frente a «anamorphic»), con el cuernahoja.
5. **P7** al final: es la más cara de montar; solo si P1-P6 no bastan.

Criterio común: la manada es de la misma especie (sí/no), proporción (largo del tronco / alto de la cruz medido a
ojo contra el banner de ChatGPT), detalle del suelo al 100 % con `recorte.sh`, y simetría de la pose.

## 7. Lagunas

- Sin fuente primaria de Huante, Schell o Whitlatch sobre proporciones exageradas, siluetas ni vistas ortogonales
  (solo descripciones de cursos). Convendría leer *Principles of Creature Design* o ver los talleres de Gnomon.
- Sin guía de BFL específica de Klein ni documentación de FLUX.3 sobre el tope de tokens; los 512 son de la
  integración de `diffusers` para FLUX.2 [klein].
- Sin guía oficial de *anamorphic* en BFL ni OpenAI.
- No pude leer el PDF completo del artículo de DALL·E 3 (supera el límite de descarga) ni los detalles de cómo
  reescribe ChatGPT con gpt-image en la web.
- Los artículos de *attribute binding* y de consistencia son sobre Stable Diffusion y similares; su relevancia para un
  transformador de flujo con un codificador LLM es una extrapolación.
