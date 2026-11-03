# Investigación: estilo de serie, «aspecto caro» y medida de coherencia (2026-10-26)

Objetivo: que el generador local (sd-cli + FLUX.3 Image Klein Q8, CPU de la Deck, ~49 min por imagen) iguale la calidad y el
diseño de los banners de GPT y que todas las imágenes parezcan del mismo juego, **sin una referencia por delante**.
Lo ya cubierto no se repite: sampler, VAE, `-r`/img2img/máscara en sd.cpp ([`investigacion-motor.md`](investigacion-motor.md)),
prompts de criaturas ([`investigacion-prompts-criaturas.md`](investigacion-prompts-criaturas.md)) y LoRA
([`investigacion-lora.md`](investigacion-lora.md)).

**Convención de fuentes.** `[P]` = documentación o código primario (BFL, sd.cpp, FFmpeg). `[S]` = secundaria o de quien lo
ha practicado (blogs de terceros, fal.ai, Krea). `[O]` = opinión o afirmación sin medición. `[M]` = **medido por mí en
esta sesión** con ffmpeg sobre los banners reales del juego y el intento r12 (las órdenes están en §5 para repetirlo).
`[E]` = estimación sin fuente.

Material medido: 134 banners de GPT de `World-Maker-Fantasy/backend/uploads/images/*/*-banner.png` (1983x793) y dos
intentos locales de r12 (`image-generator/generated/banco/r12-fotorreal-{aullador,cuernahoja}-fotorreal/intentos/`, 1280x512).

## 1. Resumen

1. **La coherencia de serie se consigue, según lo publicado, con tres cosas baratas: un bloque de estilo fijo al final del
   prompt, la misma semilla/estructura de prompt y una gradación común.** BFL documenta para klein una línea de cierre
   `Style: [estilo]. Mood: [ambiente].` «para una estética consistente» `[P]`. No documenta un método de serie más allá de eso.
2. **Referencias para fijar estilo:** BFL admite hasta 4 imágenes de referencia en klein y da el ejemplo «Turn Image 1 in the
   Style of Image 2» `[P]`, pero **no documenta cómo ni cuánto transfiere estilo**; en nuestras pruebas (r9) la paleta pasa y
   la composición no, y cada referencia cuesta tiempo y memoria en la Deck. Usar nuestras propias imágenes buenas como
   referencia es plausible, pero **no está demostrado** ni por BFL ni por la comunidad que he podido encontrar.
3. **El «aspecto caro» de GPT/Midjourney no es principalmente nitidez ni grano: es gradación.** Medido en el aullador
   `[M]`: el banner de GPT es *más oscuro* (media de luma 83 frente a 94), *más saturado* (45 frente a 28), con todo el
   cuadro teñido de rojo-anaranjado y con **menos** detalle de alta frecuencia que el intento local (4,7 frente a 7,0). Es
   decir, el local no está «demasiado liso»; está **demasiado neutro y limpio**. Lo dicen también las fuentes cualitativas
   `[S]`/`[O]`: el «look IA» viene de sesgos de estética (brillante, suave, paleta colapsada) y se arregla con una dirección
   de arte opinada, no con más nitidez.
4. **Una cadena de ffmpeg de ~0,3 s acerca mucho la paleta** `[M]`: sobre el aullador r12, la distancia de color (EMD por
   canal Cb/Cr, §4) al banner de GPT baja de 7,2/15,7 a 5,4/5,5 (Cb/Cr) y la imagen cambia de «render limpio» a «contraluz con
   bruma roja». Cuesta 0 minutos de generación. **Límite:** la gradación solo cambia color y contraste; la proporción del
   animal, la manada y la cresta (los fallos de composición de r12) no se tocan.
5. **Para medir «se parece a los banners del juego» hay un criterio objetivo sin GPU:** `signalstats` (percentiles de luma,
   saturación, matiz) + EMD de histogramas por canal + rejilla visual. La dispersión interna de los banners de GPT es
   grande (cada escena tiene su paleta), así que **el umbral no puede ser global: se compara contra los banners del mismo
   tipo y momento** (§4).
6. **El perfil «fotorreal» reutilizable** se parte en tres capas: (a) bloque de estilo fijo (texto), (b) gradación base común
   (ffmpeg), (c) tinte por momento/región (ffmpeg, calibrado con EMD contra los banners de GPT de esa región). Sin
   referencia por delante.

## 2. Hallazgos con fuentes

### 2.1 Serie coherente con modelos abiertos

| Hallazgo | Tipo | Fuente |
|---|---|---|
| Klein no tiene *upsampling* de prompt: «lo que escribes es exactamente lo que recibe el modelo»; prosa, no listas de palabras clave. | `[P]` | [BFL, referencias y edición](https://docs.bfl.ai/guides/prompting_unified_reference.md), [BFL help](https://help.bfl.ai/articles/8642316687-flux-2-klein-fast-generation-guide) (vía búsqueda; la página no se pudo abrir) |
| Para estilo consistente en klein: cerrar cada prompt con `Style: [estilo]. Mood: [ambiente].` | `[P]` | [BFL, referencias y edición](https://docs.bfl.ai/guides/prompting_unified_reference.md), [BFL, estilo](https://docs.bfl.ai/guides/prompting_unified_style.md) |
| La guía de estilo de BFL **no tiene sección de coherencia de serie**; lo más cercano: etiquetas de estilo/ambiente repetidas, y referencias («Turn Image 1 in the Style of Image 2») cuando el estilo es difícil de describir. Repetir cámara/película/luz/hex entre prompts es inferencia, no lo dice BFL. | `[P]` + inferencia | [BFL, estilo](https://docs.bfl.ai/guides/prompting_unified_style.md) |
| Nombrar cámara, lente o película concreta con su efecto («shot on Kodak Portra 400, natural grain, organic colors»; «visible grain», «slight chromatic aberration») en vez de «professional photo». | `[P]` | [BFL, estilo](https://docs.bfl.ai/guides/prompting_unified_style.md) |
| Colores exactos con hex, **cada hex atado a un objeto con nombre** («change the color of only one bird … to #e01075»). Útil para paletas de región/facción. | `[P]` | [BFL, estilo](https://docs.bfl.ai/guides/prompting_unified_style.md), [BFL FLUX.2](https://docs.bfl.ai/flux_2) |
| Prompt en JSON con campos (sujeto, fondo, luz, estilo, ángulo, composición) para producción y automatización; es el equivalente de nuestras fichas. | `[P]` | [BFL FLUX.2](https://docs.bfl.ai/flux_2) |
| FLUX.3 Image no tiene prompt negativo ni `guidance`; la ratio y el prompt deben coincidir (para 21:9, describir elementos que abarquen el ancho). Los reemplazos en positivo van al principio de la frase. | `[P]` | [BFL, técnico](https://docs.bfl.ml/guides/prompting_unified_technical.md) |
| Consistencia con la **semilla**: fijarla y cambiar solo el texto; mantener una «biblioteca de fórmulas»; comprometerse con **una** estética (no mezclar fotorrealismo con acuarela). | `[S]` | [fal.ai, guía de klein](https://fal.ai/learn/devs/flux-2-klein-prompt-guide) |
| Klein admite hasta 4 referencias (4B y 9B); FLUX.2 pro/max/flex, 8; FLUX.3 Image, hasta 10 por posición («image 1»). Magnific: referencias con elementos de estilo claros y, aun así, describir sujeto y escena. | `[P]`/`[S]` | [BFL, referencias](https://docs.bfl.ai/guides/prompting_unified_reference.md), [Magnific](https://docs.magnific.com/api-reference/text-to-image/flux-2-klein/overview) |
| «Reference images anchor content, they do not lock structure.» | `[P]` | citado en [`investigacion-motor.md`](investigacion-motor.md) §2 desde la [ficha HF de FLUX.3](https://huggingface.co/black-forest-labs/flux-3-image-klein) |
| **Midjourney** (como modelo de lo que la gente hace en cerrado): un `--sref` fijo para toda la serie, peso de estilo `--sw` 200-400 «para cohesión sin que todas sean idénticas», y mantener las palabras de estilo fuera del texto para que mande la referencia (hay quien dice lo contrario: probar ambos). | `[S]`/`[O]` | [ruzuku](https://www.ruzuku.com/learn/tools/ai/midjourney-style-refs), [claudioautiero](https://claudioautiero.substack.com/p/midjourney-style-reference-guide-sref), [bootcamp.uxdesign.cc](https://bootcamp.uxdesign.cc/master-midjourney-new-style-references-to-create-a-consistent-style-4-advanced-tips-f2fd2e0e208e) |
| Krea sostiene que «es a menudo mejor y más fácil sobreajustar un modelo hacia un estilo» y que recoger datos con **dirección de arte clara** supera a mezclar gustos; recomienda curar pocos datos buenos. Es el argumento a favor del LoRA de estilo (ya descartado en la Deck, ver `investigacion-lora.md`). | `[S]` (el equipo que lo hizo) | [Krea, FLUX.1 Krea](https://www.krea.ai/blog/flux-krea-open-source-release) |

**Lo que NO encontré:** ningún hilo de Reddit/GitHub/civitai con resultados medidos de transferencia de estilo con
referencias en FLUX.2/FLUX.3 Klein (las búsquedas devuelven documentación y flujos de ComfyUI sin resultados). Lo de «usar
nuestros banners como referencia» queda como hipótesis por probar.

**Sobre «imágenes propias buenas como referencia».** Argumentos a favor `[E]`: BFL lo permite y su ejemplo es justo
«Turn Image 1 in the Style of Image 2»; r9 vio que la paleta sí pasa. En contra, ya medido o documentado: la referencia
entra al transformer y se atiende en cada paso (en klein 4B duplicó el tiempo; `investigacion-motor.md` §2), «no bloquea
estructura», y el README G dice que FLUX.3 con `-r` no arranca en la Deck por memoria. **Y va contra el deseo de la usuaria**
(calidad «sin depender de una referencia»). Mi lectura: la referencia sirve como **instrumento de calibración** (para medir
y para afinar el perfil, §4-§5), no como parte del flujo de generación.

### 2.2 Por qué GPT/Midjourney «parecen caros»

| Hallazgo | Tipo | Fuente |
|---|---|---|
| El «look IA» (fondos muy borrosos, piel cerosa, composición aburrida, paleta colapsada) viene de scorers estéticos sesgados (LAION Aesthetics favorece fondos borrosos, texturas suaves, imágenes brillantes) y de datasets de preferencias genéricos; **mezclar gustos produce un promedio que no satisface a nadie**. El arreglo de Krea fue partir de un modelo «crudo», ajuste fino con datos curados y optimización de preferencias con dirección de arte clara. | `[S]` (primaria de Krea) | [Krea](https://www.krea.ai/blog/flux-krea-open-source-release) |
| Atribuyen parte del look a la guía (CFG) alta («más prototípico, más promedio»); nombrar imperfecciones físicas (luz lateral dura, subexposición, encuadre descentrado) y bajar la guía da más variedad; grano, viñeta y aberración cromática «reducen los delatores de superficie pero no arreglan composición ni luz». Sin comparaciones antes/después. | `[O]` | [PromptZone](https://www.promptzone.com/sebastian_suzuki/why-ai-images-share-a-look-and-how-fine-tunes-fix-it-2g3c.md) |
| El «look IA» como ausencia de ruido de sensor, estructura química y imperfección orgánica. | `[O]` (blogs de vendedores de herramientas de vídeo) | [invideo](https://invideo.io/blog/luts-film-grain-ai-video/) |
| Orden de gradación recomendado: **color primero, textura (grano) después**; LUTs de emulación de película al 60-80 % de opacidad mejor que LUTs estilizados al 100 %; grano al 2-3 %: «si se ve conscientemente, es demasiado». | `[O]` | [invideo FAQ](https://invideo.io/faq/what-is-the-best-color-grading-workflow-for-ai-generated/) |
| Afilar no crea textura: aumenta el contraste de bordes, no el detalle; el sobre-afilado da halos y «piel de cera». | `[O]` | [weshop.ai](https://www.weshop.ai/blog/14-mushy-upscale-fix-over-smoothing/) (según el resumen de búsqueda) |
| El banco propio ya dijo que el sobreprocesado de FLUX.3 es el problema y que `cine2` («cielo ámbar/carmesí, polvo encendido, borde de luz») es lo más cercano. | propio | [`banco/resultados.md`](banco/resultados.md) |

**Medido en nuestros banners `[M]`** (134 banners de GPT, luma y croma en 1280x512; `signalstats`):

| Métrica | media | p10 | mediana | p90 |
|---|---|---|---|---|
| Luma mínima (YMIN) | 8,9 | 4 | 9 | 14 |
| Luma máxima (YMAX) | 235,8 | 221 | 238 | 251 |
| Luma media (YAVG) | 82,4 | 48 | 84 | 121 |
| Percentil bajo de luma (YLOW, 10 %) | 36,4 | 22 | 33 | 53 |
| Percentil alto de luma (YHIGH, 90 %) | 137,9 | 80 | 141 | 186 |
| Saturación media (SATAVG) | 20,6 | 4,6 | 21,2 | 37,5 |
| Detalle de alta frecuencia (HF, §5) | 6,6 | 4,3 | 6,5 | 9,2 |

Lectura: los banners de GPT **usan casi todo el rango** (negros cerca de 9, no aplastados; blancos ~236), con una media
oscura (~84 de 255) y detalle de alta frecuencia moderado. La dispersión entre banners es alta (cada escena tiene su luz),
así que ninguna cifra global sirve de umbral.

Pareja aullador, mismas condiciones `[M]`:

| | YLOW | YAVG | YHIGH | SATAVG | HF |
|---|---|---|---|---|---|
| Banner de GPT | 37 | 83,5 | 143 | 45,0 | 4,7 |
| Intento local r12 sin tocar | 43 | 94,0 | 154 | 28,1 | 7,0 |
| Local + cadena de §5 (tinte rojo) | 33 | 67,0 | 110 | 37,2 | 5,7 |

El local queda **menos saturado y más detallado** que GPT; tras la cadena queda algo más oscuro que GPT (el tinte rojo
se pasa de curva; ver §5 para retocarlo).

### 2.3 Medir coherencia sin GPU

| Método | Qué mide | Fuente |
|---|---|---|
| `signalstats` de FFmpeg: percentiles de luma, saturación, matiz por fotograma | rango dinámico, brillo, saturación | [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) `[P]` (índice 11.237) |
| `ssim`, `psnr` de FFmpeg | similitud estructural/píxel entre dos imágenes **de la misma escena** | [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) `[P]`; no sirven para estilo entre escenas distintas |
| `entropy`, `histogram`, `histeq` de FFmpeg | entropía y histogramas dibujados | [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) `[P]` |
| Histogramas por canal en LAB comparados con *Earth Mover's Distance*: «métrica de distancia de color estética», mejor que las genéricas para cambios de color de estilo | método publicado | [arXiv 2401.09673](https://arxiv.org/pdf/2401.09673) `[S]` |
| EMD: coste de transporte entre distribuciones, mide dónde está el color y cuánto hay | teoría | [Rubner et al., ICCV 1998](https://people.eecs.berkeley.edu/%7Eefros/courses/AP06/Papers/rubner-iccv-98.pdf), [CRAN colordistance](https://cran.r-project.org/web/packages/colordistance/vignettes/color-metrics.html) |
| Matrices de Gram de mapas de características (textura/estilo ignorando la disposición): necesitan una red (VGG) y por tanto GPU o CPU lenta | método publicado | [arXiv 2604.03064 (Gram-MMD)](https://arxiv.org/pdf/2604.03064) `[S]` |

No encontré una métrica establecida de «coherencia de estilo» que combine color y textura sin una red neuronal. Lo que
propongo (§4) es mío: EMD por canal sobre un diezmado de 160x64, hecho solo con ffmpeg y la biblioteca estándar de Python.

## 3. Lo demostrado y lo que no

- **Demostrado (fuente primaria o medido aquí):** la línea `Style:/Mood:` de klein existe en la guía de BFL; las referencias
  están limitadas a 4 (klein) o 10 (FLUX.3 por API) y «anclan contenido, no estructura»; sin prompt negativo; los banners
  de GPT usan casi todo el rango dinámico y son más saturados y oscuros que el intento local `[M]`; una cadena de
  curvas+tinte+bruma+grano en ffmpeg reduce la distancia de color al banner de GPT `[M]`.
- **No demostrado:** que `Style:/Mood:` mejore la coherencia (BFL lo recomienda, sin medición); que las referencias
  transfieran estilo de forma útil en FLUX.3 Klein Q8 en sd.cpp; que el «look IA» dependa de la guía alta (opinión);
  cualquier cifra de tiempo de `-r` en la Deck para FLUX.3 (ver `investigacion-motor.md`).
- **Opiniones útiles pero sin medir:** grano al 2-3 %, LUT al 60-80 %, color antes que textura.

## 4. Criterio objetivo de «se parece a los banners del juego» (propuesta)

Tres comprobaciones, todas sin GPU y en segundos:

1. **Estadísticas (`stats.sh`, §5):** YLOW/YAVG/YHIGH/SATAVG de la imagen nueva dentro del intervalo p10-p90 de los banners
   del mismo tipo (tabla de §2.2 como punto de partida; recalcular por tipo, que `location` y `fauna` difieren).
2. **Distancia de color (`emd.py`, §5):** EMD en Cb y Cr de la imagen nueva frente a **los banners de GPT del mismo
   tipo/momento**. Referencia de dispersión medida con 60 banners de fauna `[M]`: entre dos banners de GPT cualesquiera, EMD
   mediana Cb 11,4 y Cr 13,5 (p25: 5,9 y 7,4). Regla propuesta: pasa si la mediana de las distancias contra los 5 banners de
   su tipo está **por debajo del p25** de la dispersión entre banners de GPT (Cb ≲ 6, Cr ≲ 7,5); falla si supera la mediana.
   La EMD de luma (Y) se informa pero no decide: depende de la escena. (Umbrales de partida, sin validar con más datos.)
3. **Rejilla visual (`rejilla.sh`, §5):** banner de GPT + intento sin tocar + intento graduado, apilados a 960 px. El criterio
   de la usuaria manda; las cifras sirven para no discutir el color a ojo.

Prueba con r12 aullador `[M]`: sin tocar, EMD Cb/Cr contra su banner de GPT = 7,2/15,7; con la cadena de §5 = 5,4/5,5.
Otra referencia: un banner de `location` frente a uno de `fauna` (escenas sin parentesco) da Cb 20,9 y Cr 31,9.

Limitación: la EMD marginal por canal ignora la correlación entre canales y la disposición espacial; dos imágenes con la
misma paleta global pueden «sentirse» distintas. Por eso hay rejilla.

## 5. Prácticas aplicables y cadena de ffmpeg

### 5.1 Prácticas (qué cambiar y cuánto cuesta en la Deck)

| # | Práctica | Coste en la Deck | Estado de la evidencia |
|---|---|---|---|
| 1 | **Gradación de ffmpeg en dos capas** (base común + tinte por momento/región), calibrada con EMD contra banners de GPT | ~0,3 s por imagen, 0 min de generación | `[M]` en 2 imágenes; falta probar en el resto |
| 2 | **Línea de cierre fija** `Style: ... Mood: ...` al final del prompt (la misma en toda la serie) | 0 s (≈25 palabras, dentro del presupuesto; el prompt ya pasa de 300 palabras en algunas fichas, ojo con `RECORTABLES`) | `[P]` la recomienda BFL; sin medición propia |
| 3 | **Semilla fija por serie** (una por tipo) y cambiar solo la ficha | 0 | `[S]` fal.ai; ya se usa semilla 3 |
| 4 | **Medir antes de mirar**: `stats.sh` + `emd.py` + rejilla tras cada imagen o tanda | segundos | `[M]` |
| 5 | **Describir en el prompt el tinte y la bruma de GPT** (aullador r12: faltaba «bruma roja y contraluz en el suelo y el animal», ya anotado en `resultados.md`) en vez de pedirlo solo al cielo; es la parte que la gradación no puede inventar sin tintar todo | 0 | `[M]` + `banco/resultados.md` |
| 6 | **img2img de bajo ruido como «refinado»** si la gradación no basta (`strength_as_noise_level`, ~2 pasos) | ~6-9 min `[E]` | solo cálculo, ver `investigacion-motor.md` §2 |
| 7 | **LUT 3D propia** (`lut3d`/`haldclut`) hecha a partir de la gradación aceptada, para aplicarla idéntica a toda la serie | 0 | técnica estándar de FFmpeg `[P]`; no probada aquí (se pueden hornear las curvas a un `.cube`) |
| 8 | Si algún día se alquila una hora de GPU: LoRA de estilo con 30-40 banners (ver `investigacion-lora.md`) | no es la Deck | ver ese documento |

**Referencias propias como entrada de generación:** no la recomiendo como flujo (coste, límite de estructura, y no es lo que
pide la usuaria). Sí para calibrar.

### 5.2 Trampas de ffmpeg encontradas al probar `[M]` (cuestan horas si no se saben)

- **`vignette` por defecto (`mode=backward`) *aclara* los bordes** (corrección de viñeteo); sube la luma media de 127 a 161.
  Para oscurecer, `mode=forward`. Y el ángulo grande oscurece **más**: con `angle=PI/3` la media cayó de 127 a 68; con
  `PI/9` (el que uso) a 119.
- **`unsharp` sobre `gbrp` trata el plano G como «luma» y B/R como «croma»**: con croma a 0 solo afila el verde y vira todo
  a amarillo. Con `gbrp`, repetir la cantidad (`13:13:0.35:13:13:0.35`) o convertir antes a `yuv444p`.
- **`blend=screen` con una copia desenfocada revienta las escenas claras** (cielo del Cuernahoja a blanco). La bruma/halo
  solo en escenas oscuras o a ≤ 0,14 de opacidad; no va en la gradación base.
- Una curva `master` en S sube la saturación por canal (las hierbas amarillas se vuelven más amarillas): compensar con
  `eq=saturation=0.92` o suavizar la S.
- `signalstats` da percentiles (`YLOW`/`YHIGH`) y no el histograma; para la forma, `emd.py`.

### 5.3 Cadena propuesta de posprocesado

Orden: color primero, bruma/halo, afilado suave, viñeta, grano al final (el grano no debe pasar por el afilado).
Todo es ffmpeg 7.1.3 (el de la Deck); sin PIL ni numpy. Se escala a 1280x512 con `lanczos` y se escribe PNG sin pérdida.

**A. Base común (neutra; para cualquier imagen)**

```sh
ffmpeg -y -i ENTRADA.png -vf "scale=1280:512:flags=lanczos,format=gbrp,\
curves=master='0/0.02 0.2/0.17 0.5/0.48 0.85/0.84 1/0.96':red='0/0.02 0.5/0.51 1/0.99':blue='0/0.02 0.5/0.47 1/0.93',\
unsharp=13:13:0.35:13:13:0.35,\
vignette=angle=PI/9:mode=forward,\
noise=alls=3:allf=t+u:all_seed=7,\
format=rgb24" -frames:v 1 SALIDA-base.png
```

Qué hace: curva en S suave con negros levantados a 0,02 (no aplastados, como los banners: YMIN ~9), techo 0,96, un
empuje cálido leve (rojo +, azul −), «claridad» con un `unsharp` grande de poca fuerza (contraste local, no nitidez de
bordes), viñeta suave y grano temporal+uniforme de fuerza 3 (≈ 1 %). Sobre el Cuernahoja r12 `[M]` da luma media 114 (de 127),
saturación 31,5 (de 32,0), matiz 136 igual: cambia el contraste y el ambiente, no el color.

**B. Tinte «rojo atardecer» (ejemplo calibrado con el aullador; no se aplica a escenas azules o verdes)**

```sh
ffmpeg -y -i ENTRADA.png -filter_complex "\
[0:v]scale=1280:512:flags=lanczos,format=gbrp,split=2[a][b];\
[b]gblur=sigma=20,curves=green='0/0 1/0.7':blue='0/0 1/0.45'[halo];\
[a][halo]blend=all_mode=screen:all_opacity=0.14[bl];\
[bl]curves=master='0/0.03 0.18/0.12 0.5/0.40 0.85/0.82 1/0.95':red='0/0.05 0.5/0.54 1/1':green='0/0.01 0.5/0.38 1/0.80':blue='0/0.01 0.5/0.26 1/0.55',\
unsharp=13:13:0.35:13:13:0.35,\
vignette=angle=PI/9:mode=forward,\
noise=alls=3:allf=t+u:all_seed=7,\
format=rgb24" -frames:v 1 SALIDA-rojo.png
```

Qué hace: (1) saca una copia desenfocada (sigma 20) y la tiñe de naranja-rojo (verde ×0,7, azul ×0,45) para la **bruma
cálida**; (2) la mezcla en `screen` al 14 %; (3) curvas por canal que cargan el rojo y hunden el azul (rojo de negros a
0,05, azul a 0,55 en blancos) para el **teñido global rojo-anaranjado** de GPT; (4) afilado de claridad, viñeta, grano.
Resultado sobre el aullador r12 `[M]`: EMD Cb/Cr contra el banner de GPT **de 7,2/15,7 a 5,4/5,5**; luma media 67 (GPT 83,5,
original 94). **Queda algo oscuro:** para igualar la luma media, subir el punto medio de `master` (`0.5/0.40` → `0.5/0.46`)
y repetir `emd.py`. No lo he iterado más: es una propuesta para afinar, no un valor final.

**C. Comprobar (las tres herramientas, copiables)**

`stats.sh`: percentiles de luma, saturación, matiz y detalle de alta frecuencia (media de |Y − blur(Y)|, aprox. de «detalle»):

```sh
#!/bin/sh
f="$1"
ffmpeg -v error -i "$f" -vf "scale=1280:512:flags=lanczos,format=yuv444p,signalstats,metadata=print:file=-" \
  -frames:v 1 -f null - 2>/dev/null | grep -E "YMIN|YLOW|YAVG|YHIGH|YMAX|SATAVG|HUEMED" | sed 's/lavfi.signalstats.//' | tr '\n' ' '
hf=$(ffmpeg -v error -i "$f" -filter_complex "[0:v]scale=1280:512:flags=lanczos,format=gray,split[a][b];[b]gblur=sigma=2[c];[a][c]blend=all_mode=difference,signalstats,metadata=print:file=-" \
  -frames:v 1 -f null - 2>/dev/null | grep YAVG | sed 's/.*=//')
echo "HF=$hf"
```

(Con PNG que traen el prompt en un chunk de texto, la línea `parameters=...` puede colarse en la salida: filtrarla con
`sed 's/parameters.*//'` o con `grep -o '[A-Z]*=[0-9.]*'`.)

`emd.py` (solo biblioteca estándar; correr con `python3 -I emd.py A.png B.png`): distancia de Wasserstein-1 entre los
histogramas de Y, Cb y Cr (en niveles de 0-255):

```python
import subprocess, sys
def planos(f):
    raw = subprocess.run(['ffmpeg','-v','error','-i',f,'-vf','scale=160:64:flags=area,format=yuv444p',
                          '-f','rawvideo','-'],capture_output=True,check=True).stdout
    n = 160*64
    return [raw[i*n:(i+1)*n] for i in range(3)]
def cdf(p):
    h=[0]*256
    for v in p: h[v]+=1
    c=0; out=[]
    for x in h: c+=x; out.append(c/len(p))
    return out
def emd(a,b): return sum(abs(x-y) for x,y in zip(cdf(a),cdf(b)))
a,b=planos(sys.argv[1]),planos(sys.argv[2])
print('EMD Y=%.1f Cb=%.1f Cr=%.1f' % tuple(emd(x,y) for x,y in zip(a,b)))
```

`rejilla.sh` (apila N imágenes en vertical a 960x384 para compararlas a ojo):

```sh
#!/bin/sh
out="$1"; shift; n=$#; args=""; fc=""; i=0
for f in "$@"; do args="$args -i $f"; fc="$fc[$i:v]scale=960:384:flags=lanczos,setsar=1[v$i];"; i=$((i+1)); done
ins=""; j=0; while [ $j -lt $n ]; do ins="$ins[v$j]"; j=$((j+1)); done
ffmpeg -y -v error $args -filter_complex "${fc}${ins}vstack=inputs=$n" -frames:v 1 "$out"
```

**Prueba mínima sobre una imagen ya generada** (repite lo medido aquí):

```sh
R=World-Maker-Fantasy/backend/uploads/images/fauna/aullador-rojo-macho-banner.png         # banner de GPT
G=World-Maker-Fantasy/image-generator/generated/banco/r12-fotorreal-aullador-fotorreal/intentos/banner-s3-p16-20261026-153036.png
# 1) cadena B -> SALIDA-rojo.png (orden de arriba)
python3 -I emd.py "$R" "$G"            # antes:  EMD Y=11.2 Cb=7.2 Cr=15.7
python3 -I emd.py "$R" SALIDA-rojo.png # despues: EMD Y=16.5 Cb=5.4 Cr=5.5
sh rejilla.sh cmp.png "$R" "$G" SALIDA-rojo.png
```

### 5.4 Convertir el estilo en perfil «fotorreal» sin referencia

1. **Texto fijo, corto y siempre al final** (práctica 2): una línea `Style: ... Mood: ...` con cámara/película/luz verosímiles
   (la guía de BFL pide cámara y película concretas, no «professional photo»). Propuesta de partida, **sin validar**:
   `Style: photorealistic fantasy matte painting, cinematic concept art, shot on a full-frame camera with a 35mm lens, soft golden-hour
   rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded.` El perfil `realista` actual ya usa
   «full-frame, 35mm, rim lighting»; lo que cambia es el cierre con `Style:/Mood:` y la bruma.
2. **Gradación base común** (A) como paso final obligatorio del generador, con la misma semilla de grano.
3. **Tintes por momento y región** (B como plantilla): una orden por `momento` (`dia`, `atardecer`, `noche`) y, si hace falta,
   por región (Llanuras del Viento Rojo = rojo). Cada tinte se calibra una vez con `emd.py` contra 3-5 banners de GPT de
   esa región y se guarda con su EMD de aceptación; después se aplica sin referencia.
4. **Hornear la gradación aceptada a una LUT 3D** (práctica 7: `haldclut` o `lut3d`) para que sea un único fichero versionado
   y reproducible; las órdenes anteriores sirven de plano para generarla.
5. **Dónde vive:** nuevo bloque en `image-generator/estilo/mundo.json` (texto de `Style/Mood`) y las órdenes de ffmpeg junto al
   perfil; la prueba de aceptación, `stats.sh`/`emd.py` en el flujo de `calidad.sh` (no se toca aquí).

## 6. Lagunas y siguientes pruebas

- **Probar la línea `Style:/Mood:`** en una tanda de 2 intentos (con y sin ella, misma semilla y 6 pasos para que sea barato)
  y medirlos con §4. Hoy es la práctica con fuente primaria y sin medición propia.
- **Validar los umbrales de §4** con más parejas (cardo, pastos, cuernahoja) y revisar `emd.py` con otra resolución de diezmado.
- **Calibrar los tintes** para `dia` y `noche` con banners de GPT de esos momentos.
- **Referencias con `-r` en FLUX.3** (enlazado con `IMG-1`): solo como experimento de calibración; consume memoria en la Deck.
- **No se pudieron abrir** la guía de klein de BFL (`prompting_guide_flux2_klein`, 404) ni el artículo del help center de BFL
  (404); lo que de ellos se cita viene de resúmenes de la búsqueda y de la guía de estilo de BFL, que sí se leyó.
- **No hay resultados de comunidad** (Reddit/GitHub/civitai) medidos para transferencia de estilo con referencias en klein;
  las búsquedas no los devolvieron. Lo que hay de comunidad es opinión de blogs.
- La cadena de ffmpeg **no corrige composición ni proporciones** (el fallo principal de r12: el animal corto, la manada que
  no es la misma especie); eso sigue en la ficha y en la cadena de planos (r13).
