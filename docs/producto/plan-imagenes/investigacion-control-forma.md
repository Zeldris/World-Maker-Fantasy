# Investigación: forzar la forma de criaturas inventadas sin entrenar (2026-10-26)

Objetivo: que el modelo respete anatomías que no conoce (depredador larguísimo y bajo con cresta de placas negras y púas
rojas de la nuca a la cola; herbívoro de cuello de jirafa con «cuernos» de hoja plana), en banners 1280x512 con
FLUX.3 Image Klein Q8 en la CPU de la Deck (~180 s por paso a 1280x512, ~49 min a 16 pasos).
No repite [`investigacion-motor.md`](investigacion-motor.md), [`investigacion-prompts-criaturas.md`](investigacion-prompts-criaturas.md)
ni [`investigacion-tecnicas-diseno.md`](investigacion-tecnicas-diseno.md): parte de ellos.

**Convención.** `[P]` primaria (código/documentación de sd.cpp, BFL, ficha del autor), `[S]` secundaria (blogs, guías,
workflows de terceros), `[E]` estimación o deducción nuestra **sin fuente: hay que medirla**, `[L]` comprobado en esta
máquina hoy. No se ha lanzado ninguna generación.

## Resumen

1. **No hay ControlNet para FLUX.3/FLUX.2 Klein en sd.cpp.** El README solo nombra ControlNet con SD 1.5; lo único de
   control para Flux que se fusionó (PR #692, 10-oct-2025) son los modelos **FLUX.1-Canny-dev / FLUX.1-Depth-dev** y
   Flex.2, con `--control-image`. Klein no tiene ControlNet ni Control-LoRA oficial; el sucedáneo de la comunidad es
   meter un mapa (profundidad/bordes) como **imagen de referencia**.
2. **Lo realista aquí son tres palancas, de más barata a más cara:** (a) un **boceto de color como `--init-img`** con
   `strength_as_noise_level` alto (~0,85): fija la composición a gran escala por ~25 min; (b) el mismo boceto como **`-r`**
   (referencia limpia, con rol dicho en el prompt), más cara y sin prueba de que Klein lo obedezca; (c) **inpainting por
   partes** con `--mask` (cuerpo primero; cresta o cuernos después), que en FLUX.3 es img2img acotado sin modelo de
   inpaint dedicado.
3. **Boceto sin librerías: `rsvg-convert` existe [L]** y rasteriza SVG a PNG de 1280x512 al instante; ffmpeg también trae
   `drawbox`, `geq`, `gblur` y el decodificador `librsvg`. Dibujar a mano un SVG es el método más expresivo; abajo van los
   dos SVG (depredador y herbívoro) ya renderizados y revisados a ojo.
4. **La evidencia de comunidad sobre bocetos toscos como init en Klein es casi nula**: no se encontró ningún hilo de
   Reddit ni de Civitai que lo pruebe con cifras. Todo lo de «qué fuerza» es `[E]`. Por eso se propone una prueba de 3
   generaciones.
5. **Aviso de `--strength`:** en Klein solo actúa con `-i`; con `-r` da resultados idénticos a cualquier valor
   ([discusión 1516 de sd.cpp](https://github.com/leejet/stable-diffusion.cpp/discussions/1516)) [P/S].

## 1. ControlNet y equivalentes en sd.cpp y FLUX

| Hallazgo | Fuente |
|---|---|
| README de sd.cpp: «Control Net support with SD 1.5»; FLUX.3 Image Klein aparece como modelo de imagen y de edición. | [README](https://github.com/leejet/stable-diffusion.cpp/blob/master/README.md) [P] |
| PR #692 «Support for Flux Controls + Flex.2», fusionado el 10-oct-2025: añade control para **FLUX.1-Canny-dev y FLUX.1-Depth-dev** (modelos con condicionado integrado, no ControlNet aparte) y Flex.2; se usa con `--control-image` y `--control-strength`. Los Control-LoRA quedaron fuera (falta soporte de bias y de dimensiones distintas). | [PR #692](https://github.com/leejet/stable-diffusion.cpp/pull/692) [P] |
| `--help` de nuestro `sd-cli` (commit `95ff762`): existen `--control-net`, `--control-image`, `--control-strength`, `--ip-adapter-image`; el `-r` se describe «for Flux Kontext or MiniMax-H3 Ref2VA». No hay nada de FLUX.2/3 en la ayuda de control. | `sd-cli --help` [L] |
| `docs/image_preprocessing.md`: `--image-preprocess ...,canny=true` aplica **detección de bordes (Canny) a cualquier imagen de entrada** (init, máscara, referencia…) antes de la generación; «no sustituye el preprocesado interno del ControlNet». La página no menciona FLUX. | [image_preprocessing.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/image_preprocessing.md) [P] |
| `docs/edit.md`: FLUX.2 y FLUX.3 Klein usan el preset `flux2` (índice RoPE `increase`, sin VLM); no hay sección de canny ni de control. | [edit.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md) [P] |
| «Klein doesn't do ControlNet — this is the structural-reference workaround»: nodo de ComfyUI que mete un mapa de profundidad (Depth Anything V2) o de bordes como `reference_latents` de la edición de Klein; la propia página dice que el modo de bordes **no está verificado** para Klein y recomienda el de profundidad. | [nodo comfy.icu](https://comfy.icu/node/FluxKleinControlNetImg2Img) [S] |
| LoRA «refcontrol» (referencia + mapa Canny) para **Klein 9B**; entrenada sobre todo con humanos; 4 pasos destilado = «calidad algo menor»; no consta compatibilidad con otros tamaños ni con sd.cpp. Nuestro FLUX.3 Image Klein es otro modelo (5,6 B): **no es utilizable** sin comprobar `[E]`. | [HF thedeoxen](https://huggingface.co/thedeoxen/refcontrol-FLUX.2-klein-9B-reference-canny-lora) [S] |
| ControlNet-Union / Fun-Controlnet-Union (canny, depth, pose…) existen para FLUX.1-dev y FLUX.2-dev, no para Klein. | [Hackernoon](https://hackernoon.com/a-guide-to-flux2-dev-fun-controlnet-union), [Shakker-Labs](https://huggingface.co/Runware/FLUX.1-dev-ControlNet-Union-Pro-2.0) [S] |

**Conclusión de la sección:** descartar ControlNet real. Los dos equivalentes que quedan son el *init-img* (estructura
por el latente inicial) y la *referencia* (estructura por atención). Un boceto de siluetas es un mapa de «segmentación
de color», sin Canny posible porque es relleno plano; el Canny de sd.cpp (`canny=true`) sirve solo para bocetos de línea.

## 2. Forzar la forma: qué se sabe de cada técnica

### 2.1 Boceto o maqueta como `--init-img` (img2img)

- sd.cpp: `--strength` normal salta los primeros `(1-s)` de los pasos; con el planificador desplazado de FLUX.3
  (shift 6,93) una fuerza de 0,5 ya equivale a sigma ≈ 0,87 `[E]` (cálculo de [`investigacion-motor.md`](investigacion-motor.md) §2).
  Con `--extra-sample-args strength_as_noise_level=true` la fuerza pasa a ser el sigma real
  ([`image.cpp`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/pipeline/image.cpp)) [P].
- En la discusión 1516, un comentarista recomienda subir pasos a ~6 con strength 0,5 en el destilado y probar `euler_a`
  con `-i`; es opinión de usuario, sin imágenes comprobadas [S].
- Guías generales de img2img: valores bajos conservan composición y color, cerca de 1,0 es casi txt2img
  ([stable-diffusion-art](https://stable-diffusion-art.com/flux-img2img-inpainting), [Runware](https://runware.ai/docs/guides/image-to-image)) [S]. No
  hablan de Klein ni de manchas de color como init.
- **Hipótesis `[E]`:** en flow-matching, la forma gruesa se decide en los primeros pasos (sigma alto). Un boceto
  plano con sigma de inicio ~0,85-0,9 conserva la **disposición y proporción gruesas** (cuerpo largo y bajo, cuello
  vertical, posición de la cabeza) y deja al prompt los detalles (placas, púas, textura). A sigma ≥ 0,95 se pierde.
  Con sigma bajo (≤ 0,7) el resultado se queda con aspecto de «pintura plana» (el boceto manda demasiado).
- Riesgo `[E]`: el modelo ve «animal marrón en perfil» y reinterpreta la silueta hacia lo conocido (zorro) si el boceto
  es ambiguo; por eso el boceto debe llevar **los rasgos que fallan** (cresta oscura, hojas verdes) en color distinto.

### 2.2 Maqueta de color («blockout») y silueta

- No hay fuente primaria ni de comunidad que pruebe blockouts de color con Klein. La búsqueda dio solo guías genéricas de
  img2img y un modelo GGUF que avisa de que la fuerza que sirve para una foto no es la que sirve para otra imagen de
  prueba (secundaria, sin cifras).
- La práctica de diseño (siluetas y miniaturas antes de detallar) ya está en [`investigacion-tecnicas-diseno.md`](investigacion-tecnicas-diseno.md) (Gnomon, Feng Zhu) y
  es de pintura digital, no de IA.
- Silueta pura (negro sobre gris) frente a maqueta con color: `[E]` la de color da más información (qué es cresta, qué es
  hoja), pero también más riesgo de que el color se arrastre a la imagen final. Probar la de color primero.

### 2.3 Referencia `-r` («edición con referencia»)

- BFL: edición multirreferencia, la instrucción añade o cambia por texto («add a flock of birds…»); admite 4 (guía de
  edición de klein) a 8-10 referencias según canal; **no documenta bocetos, bordes ni pose como entrada de control**
  ([edición FLUX.2](https://docs.bfl.ml/flux_2/flux2_image_editing), [visión general](https://docs.bfl.ai/guides/prompting_editing_overview)) [P].
- Patrón de prompt que repiten las guías: nombrar la imagen y un solo cambio («Using image 1 as the base, change [x] to
  [y]»), y decir qué se conserva ([fal.ai](https://fal.ai/learn/devs/flux-2-klein-prompt-guide),
  [aireiter](https://aireiter.com/blog/flux-2-klein-prompt-guide-image-editing-consistency)) [S]. Un ejemplo de «render this pencil sketch as a photoreal photo» se atribuye a
  Klein en una guía ([tensorhub](https://www.tensorhub.art/articles/953971374114737739)) como prueba inicial del autor [S/opinión].
- La referencia en Klein es **limpia** (no se ruidea), así que influye más en estructura que el init, pero cuesta más:
  sd.cpp avisa de que las referencias «se atienden en cada paso»; con klein 4B duplicó el tiempo
  (ver [`investigacion-motor.md`](investigacion-motor.md) §2, [`banco/resultados.md`](banco/resultados.md)) [P/E]. `--ref-image-args vae_input_max_pixels=262144` reduce el coste.
- Un nodo de ComfyUI afirma que en Klein «no hay desruido parcial: siempre es 1,0» y que la estructura entra por
  `reference_latents` [S]; en sd.cpp, en cambio, `-i` con strength sí es parcial (discusión 1516) [P/S]. Las dos vías
  existen y se pueden combinar (`-i` y `-r`), «calidad variable» según la discusión.
- «Añade una cresta a este animal» (editar un animal ya generado): **sin fuente de que funcione con anatomías
  inventadas**; por el diseño del modelo `[E]` funciona mejor con rasgos que existen en su entrenamiento (cresta de
  iguana/estegosaurio) que con «hojas planas laterales».

### 2.4 Inpainting por partes (`--mask`)

- sd.cpp con FLUX.3 no tiene modelo de inpaint: usa `denoise_mask` (mezcla en el latente en cada paso), es decir
  img2img acotado a la zona ([`image.cpp`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/pipeline/image.cpp)) [P]; calidad de costuras con FLUX.3 sin probar.
- Flujo por partes `[E]`: (1) cuerpo/cabeza con el prompt del cuerpo y sin la cresta; (2) máscara sobre la línea del
  lomo con prompt solo de la cresta («a row of black plates with red spikes along the spine»); (3) igual con los cuernos.
  Cada pasada cuesta lo de un img2img con la máscara a pantalla completa (la máscara no reduce el cálculo del
  transformer, solo el resultado; no hay recorte automático salvo en el flujo de detección tipo ADetailer) `[E]`.
- La investigación académica va en la misma dirección (componer subconceptos por partes en vez de un solo prompt):
  [DreamCreature, arXiv 2311.15477](https://arxiv.org/abs/2311.15477) [P, investigación; requiere entrenamiento, no aplicable].

### 2.5 Comunidad (Reddit, Civitai, GitHub)

Búsquedas hechas: boceto/silueta como init para Klein, blockouts de color con Flux, quimeras y criaturas inventadas,
trucos de inpainting por partes. **Resultado honesto: no apareció ningún hilo de Reddit ni de Civitai con experiencias
medidas** (el buscador no devolvió Reddit en ningún caso). Lo único con sustancia es:

- [Discusión 1516 de sd.cpp](https://github.com/leejet/stable-diffusion.cpp/discussions/1516): `--strength` solo con `-i`, no con `-r` en Klein [P/S].
- [Nodo comfy.icu](https://comfy.icu/node/FluxKleinControlNetImg2Img): Klein sin ControlNet, mapas como referencia; la profundidad es lo que
  «merece confianza», los bordes sin verificar [S].
- [Civitai 2637283](https://civitai.com/models/2637283) (workflow de Klein 9B con «denoise» que afirma funcionar): no se pudo abrir (403); solo se conoce
  por el resumen del buscador [S, sin verificar].

## 3. Dibujar la silueta sin GPU ni librerías

Comprobado en esta máquina `[L]` (2026-10-26): **`rsvg-convert` existe** (`/usr/bin/rsvg-convert`);
`magick`, `convert` e `inkscape` **no** existen; ffmpeg tiene `drawbox`, `drawgrid`, `geq`, `gblur`, `colorize`,
`edgedetect`, y el decodificador `librsvg` (puede leer SVG como entrada: `ffmpeg -i x.svg`). Python3 sin librerías puede
escribir un PPM (P6) a mano. Un `drawbox` de ffmpeg y un SVG con `rsvg-convert` los he ejecutado de verdad.

**Método recomendado: SVG a mano + `rsvg-convert`.** Curvas Bézier, degradados y polígonos, versionable en el repo
(`docs/prototipos/` o junto al prompt), repetible y retocable con la usuaria. Orden de dibujo, de lejos a cerca: cielo y
suelo, sombra, patas lejanas, cuerpo, cabeza, patas cercanas, rasgos que fallan (cresta, hojas). Para dar **vista de tres
cuartos**: cabeza más grande y delante, cuerpo que se afina y se acorta hacia el fondo, patas lejanas desplazadas y más
claras o más cortas, y cola que se pierde de tamaño. Con ffmpeg: `drawbox` para rectángulos, `gblur` para suavizar el
borde de la silueta (un borde duro hace que el modelo copie el borde), `geq` para degradados.

```sh
rsvg-convert depredador.svg -o depredador.png     # 1280x512 directamente
ffmpeg -i depredador.png -vf "gblur=sigma=2" -y init.png   # opcional: bordes blandos
```

Alternativa sin librería, solo si no hubiera `rsvg-convert` en la máquina de producción: PPM con Python puro
(`open('x.ppm','wb').write(b'P6 1280 512 255\n'+bytes(...))`, rellenando polígonos con un test «punto dentro de polígono»)
y `ffmpeg -i x.ppm x.png`. Más trabajo y ninguna ventaja; el SVG es mejor.

Nota para la **Deck de producción**: `rsvg-convert` es una dependencia de sistema; el sandbox de `tools/qa/host.sh` está
pensado para npx, no se ha comprobado desde ahí. Comprobar con `which rsvg-convert` donde corra el generador `[E]`.

### 3.1 Depredador largo y bajo, tres cuartos (`depredador.svg`)

Cabeza cercana a la izquierda, cuerpo que se afina hacia la derecha, cola larga, cresta de placas negras con punta roja
de la nuca a la cola (placas cada vez más pequeñas por la perspectiva). Renderizado y revisado: se lee como animal largo
y bajo con cresta continua; **sigue pareciendo más lateral que de tres cuartos** (mejora: acortar el cuerpo visible,
cabeza más ancha y girada, un borde de la barriga visible).

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="512" viewBox="0 0 1280 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa7b0"/><stop offset="1" stop-color="#6f7a6a"/></linearGradient></defs>
<rect width="1280" height="512" fill="url(#g)"/>
<rect y="330" width="1280" height="182" fill="#5c6552"/>
<!-- sombra -->
<ellipse cx="700" cy="438" rx="560" ry="22" fill="#2f342b" opacity=".6"/>
<!-- patas lejanas -->
<path d="M820 360 L840 430 L868 430 L862 360Z M1010 355 L1030 425 L1056 425 L1050 352Z" fill="#3b3430"/>
<!-- cuerpo: cabeza cerca (izq, grande), cuerpo se aleja a la derecha y se afina; cola larga -->
<path d="M150 330 C170 285 250 270 330 285 C420 275 520 280 640 288 C800 292 960 300 1090 318 C1170 328 1230 345 1262 372 C1230 360 1170 352 1090 348 C960 340 800 346 640 352 C520 358 420 366 330 372 C260 392 190 392 150 370Z" fill="#4a3a33"/>
<!-- cabeza 3/4: hocico hacia el espectador-izquierda -->
<path d="M60 345 C70 310 120 292 180 296 C240 300 270 325 262 352 C250 380 190 392 120 386 C80 380 56 365 60 345Z" fill="#54433a"/>
<ellipse cx="170" cy="330" rx="14" ry="9" fill="#e8d9a0"/>
<!-- patas cercanas -->
<path d="M230 372 L215 450 L262 452 L290 376Z M470 366 L462 440 L505 442 L520 368Z" fill="#3f332d"/>
<!-- cresta de placas desde la nuca hasta la punta de la cola -->
<g fill="#0c0c0c">
<path d="M250 292 L262 232 L290 286Z M300 284 L318 218 L346 282Z M360 282 L376 224 L404 280Z M420 280 L434 232 L460 280Z M476 281 L488 238 L514 282Z M530 283 L540 246 L562 285Z M580 285 L590 254 L610 288Z M630 288 L638 262 L654 290Z M690 290 L697 270 L710 291Z M760 292 L766 276 L776 293Z M850 296 L855 283 L863 298Z M960 304 L964 294 L970 306Z M1070 316 L1073 309 L1078 318Z M1170 332 L1173 326 L1176 334Z"/></g>
<g fill="#b3121a">
<path d="M262 232 L258 246 L266 246Z M318 218 L314 234 L322 234Z M376 224 L372 238 L380 238Z M434 232 L430 244 L438 244Z M488 238 L485 249 L491 249Z M540 246 L537 255 L543 255Z M590 254 L588 261 L592 261Z"/></g>
</svg>
```

### 3.2 Herbívoro de cuello largo con cuernos-hoja (`herbivoro.svg`)

Cuello largo inclinado, cabeza de tres cuartos mirando a la izquierda, dos hojas planas y verdes que salen **hacia los
lados** de la cabeza (verde distinto del cuerpo para que el modelo no las lea como cuernos marrones).

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="512" viewBox="0 0 1280 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9b8c2"/><stop offset="1" stop-color="#8a9a78"/></linearGradient></defs>
<rect width="1280" height="512" fill="url(#g)"/>
<rect y="400" width="1280" height="112" fill="#6c7a56"/>
<ellipse cx="640" cy="468" rx="260" ry="18" fill="#3a4430" opacity=".6"/>
<!-- patas lejanas -->
<path d="M690 330 L700 465 L722 465 L728 330Z M770 330 L782 462 L802 462 L806 330Z" fill="#6b5a3e"/>
<!-- cuerpo -->
<path d="M520 300 C560 250 700 240 800 270 C850 290 860 340 830 360 C760 385 600 385 540 360 C510 345 505 320 520 300Z" fill="#8a7550"/>
<!-- cuello largo inclinado hacia el espectador-izquierda, 3/4 -->
<path d="M545 290 C520 220 470 140 430 80 L478 62 C520 120 590 210 625 270Z" fill="#907a52"/>
<!-- cabeza 3/4, hocico hacia la izquierda y adelante -->
<path d="M395 78 C410 52 450 42 485 52 C505 60 505 82 490 92 C470 104 430 106 405 98Z" fill="#9b845a"/>
<ellipse cx="402" cy="88" rx="12" ry="9" fill="#2d241a"/>
<!-- cuernos-hoja: dos láminas planas hacia los lados -->
<path d="M430 55 C380 30 320 28 270 50 C320 70 385 74 440 66Z" fill="#3f7a3a"/>
<path d="M480 52 C540 24 610 22 670 44 C610 68 540 70 490 64Z" fill="#3f7a3a"/>
<!-- patas cercanas -->
<path d="M545 360 L548 468 L575 468 L585 365Z M640 368 L650 470 L676 470 L680 368Z" fill="#7a6644"/>
</svg>
```

## 4. Prácticas aplicables a nuestro flujo

Coste en la Deck con `[E]` lineal en píxeles y pasos (180 s por paso a 1280x512), más ~40 s de VAE y la codificación del
init.

| # | Práctica | Cambio en el flujo | Coste | Pasadas | Fiabilidad |
|---|---|---|---|---|---|
| 1 | Boceto SVG de color como `--init-img` con `strength_as_noise_level=true`, fuerza ~0,85 | Paso previo: SVG a PNG; orden `-i boceto.png --strength 0.85 --extra-sample-args strength_as_noise_level=true`, prompt completo | ~7 pasos ≈ 23-25 min `[E]` (menos que el txt2img de 49) | 1 | Media `[E]`; sin prueba en Klein |
| 2 | Borrador a baja resolución para elegir boceto/fuerza | Mismo init a 640x256 y 8 pasos para ver si la forma se respeta antes de gastar 25 min | ~1/4 de píxeles: ~5-8 min `[E]` | 1-3 | Útil para decidir; la forma no tiene por qué mantenerse al subir de resolución |
| 3 | Boceto como referencia `-r` con rol en el prompt («image 1 is a flat shape layout guide for a photo of…») | `-r boceto.png --ref-image-args vae_input_max_pixels=262144` | hasta ×2 (~50-90 min) `[E]` | 1 | Baja-media `[E]`; BFL no documenta bocetos |
| 4 | Inpainting por partes: cuerpo, luego cresta o cuernos con máscara | Máscara en blanco y negro con el mismo SVG (solo la cresta o las hojas en blanco), `-i` = imagen buena anterior, `strength_as_noise_level` 0,7-0,85 | cada pasada ≈ 12-23 min `[E]` | 2-3 | Media-baja `[E]`; costuras sin probar en FLUX.3 |
| 5 | Prompt de cada rasgo en su pasada, con el rasgo **primero** y nombrado con lo que el modelo conoce («row of black bony plates like a stegosaurus crest, tipped with red») | Cambio de prompts de [`investigacion-prompts-criaturas.md`](investigacion-prompts-criaturas.md) a pasadas separadas | 0 extra | – | Media (de la parte de prompts, ya investigada) |
| 6 | Cuernos-hoja: hoja verde plana horizontal como **máscara de color** más prompt «two flat green leaf blades growing sideways from the head» | Dibujar las hojas en el boceto con verde distinto | 0 extra | – | `[E]` |
| 7 | Descartar | ControlNet (no existe para Klein), LoRA refcontrol (es de Klein 9B), Canny sobre un boceto de relleno plano (`canny=true` no da nada útil sin líneas) | – | – | – |

**Orden recomendado:** 2 para elegir boceto, 1 para producir, y solo si falla un rasgo concreto, 4 con ese rasgo. La 3
solo si la 1 no mantiene la forma.

## 5. Prueba mínima propuesta (3 generaciones máximo)

Sujeto: el **depredador largo** (el fallo más claro: cuerpo de zorro). Mismo prompt (ficha completa ya aprobada, vista
de tres cuartos, el rasgo de silueta primero), misma semilla, 16 pasos, `--backend diffusion=cpu -t 8`. Boceto:
`depredador.svg` rasterizado a 1280x512 (§3.1). Orden en la Deck, **sin lanzarlas desde esta investigación**:

1. **A, init con fuerza alta:** `-i depredador.png --strength 0.85 --extra-sample-args strength_as_noise_level=true`.
   ≈ 25 min `[E]`. Criterio de éxito (mirar a ojo, sí/no): cuerpo ≥ 3 veces más largo que alto; cresta negra continua con
   púas rojas de nuca a cola; cabeza de tres cuartos y no de perfil.
2. **B, mismo boceto como referencia:** `-r depredador.png --ref-image-args vae_input_max_pixels=262144`, prompt que dice
   «image 1 is a flat colour layout guide: follow its proportions, pose, black crest, and viewpoint; render as a
   photograph», **sin** `-i` (txt2img con referencia). ≈ 50-90 min `[E]`; mide cuánto cuesta y si obedece mejor que A.
3. **C, init con fuerza más baja o más alta según A:** si A salió «demasiado pintura plana», `0.92`; si A perdió la forma,
   `0.75`. ≈ 15-35 min `[E]`. Así se acota el rango útil de fuerza.

Resultado esperado: si A o C cumplen los tres criterios, la práctica 1 pasa a ser el flujo del depredador y se prueba
con el herbívoro (§3.2) y luego con el inpainting de la cresta (práctica 4) solo si hace falta. Si ninguna cumple, la
forma no se puede forzar con el boceto sin entrenar y queda LoRA ([`investigacion-lora.md`](investigacion-lora.md)).
Apuntar en la tabla de pruebas la semilla, la fuerza, el tiempo real y los tres sí/no.

## Límites de esta investigación

- No se ha generado nada: ninguna cifra de tiempo ni de fuerza de este documento está medida; todas son `[E]`.
- No se encontraron hilos de Reddit ni Civitai con experiencias medidas (la búsqueda no devolvió Reddit); lo de
  comunidad es una discusión de GitHub, un nodo de ComfyUI y guías de terceros.
- Las páginas del repo se leyeron por WebFetch (resumen automático), no clonando el código; la ausencia de soporte de
  ControlNet para FLUX.3 se apoya en el README, el PR #692 y el `--help` local, no en una lectura completa de `control.hpp`
  (esa URL dio 404).
- El resumen del buscador sobre el workflow de Civitai y el sitio sketchto.com no se pudo contrastar con la página.
