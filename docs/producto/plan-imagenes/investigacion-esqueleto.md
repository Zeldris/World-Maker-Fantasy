# Investigación: esqueleto, masas y pasadas para la forma de criaturas (2026-11-03)

Convención: [P] primaria (código/documentación oficial), [S] secundaria, [E] estimación nuestra sin fuente, [L] comprobado
en esta máquina. Consultas del 2026-11-03. No se ha generado nada ni lanzado `sd-cli`. Parte de
`investigacion-control-forma.md` (26-oct) sin repetirla.

## Resumen

1. **Lo más probable es que el fallo del aullador sea de fuerza, no de boceto.** `generar.sh` usa `--strength 0.97` con
   `strength_as_noise_level=true`: según el código [P] eso arranca el muestreo en el primer sigma <= 0,97. En flow-matching
   (x_t = (1-σ)·x0 + σ·ε) [E] queda ~3 % de señal: casi txt2img. El 26-oct se propuso ~0,85 y se probó 0,97. La comunidad
   usa 0,6-0,75 para cambios grandes que conservan estructura general [S] (en denoise de ComfyUI; ver §1.3 sobre la
   equivalencia).
2. **Esqueleto -> masas -> pasadas es razonable y tiene respaldo genérico** (img2img escalonado 0,7 -> 0,4 -> 0,2 [S]), pero
   **no hay ninguna fuente que lo pruebe con Klein**: todo lo de fuerzas con Klein es [E].
3. **Novedades desde el 26-oct:** en sd.cpp, nada de control. Releases posteriores a master-1039: solo master-1043 y
   master-1044 (CI y optimización de MOSS/Z-Image) [P]. En Hugging Face han aparecido controles para Klein **que no corren en
   sd.cpp** (ver §4): `DiffSynth-Studio/Template-KleinBase4B-ControlNet` (Apache-2.0, Base 4B, ~24-40 GB de GPU) y
   `gilfoyle0813/flux2_klein_9b_depth_control` (LoKR de 9B, MIT). Ninguno vale para FLUX.3 Image Klein en la Deck.
4. **LoRA por criatura:** la guía de BFL pide 15-40 imágenes de estilo; con 1-4 banners es de sobreajuste casi seguro al fondo y
   la composición. Viable solo como LoRA de *concepto* con muchas variaciones sintéticas [E]; no recomendado antes de agotar
   el boceto.
5. **Silueta del banner sin GPU:** `rembg` (MIT) con `isnet-general-use`/`u2netp` en CPU, ~1 s por imagen [S, un solo
   test]; con BiRefNet ~15 s. Pero aquí la silueta del banner **no es lo que falla** (el aullador sale mal porque el
   modelo no ve la forma), así que sirve más como máscara para repintar que como boceto.

## 1. Esqueleto -> masas -> img2img: fuerzas y qué hace `strength_as_noise_level`

### 1.1 Qué hace en sd.cpp (`src/pipeline/image.cpp`, leído 2026-11-03) [P]

Solo actúa con `init_image` y `strength < 1`.

- **Por defecto:** `t_enc = (size_t)(sample_steps * strength)`; se saltan los primeros `steps - t_enc` pasos del calendario de
  sigmas. Con el shift 6,93 de Klein el calendario está muy comprimido hacia sigma alto, así que strength 0,5 ya parte de un
  sigma alto (cálculo del 26-oct, [E]).
- **Con `strength_as_noise_level=true`:** `target_sigma = denoiser->noise_level_to_sigma(strength)` y se busca el primer índice
  con `sigmas[i] <= target_sigma`; el calendario se corta ahí. Si ninguno cumple, empieza en 0 (calendario completo). Se
  deja al menos un paso. Opción extra `force_first_sigma` (solo con este modo) fuerza `sigma_sched[0] = target_sigma`.
- **Consecuencia práctica:** con el modo de ruido, la fuerza es "cuánto ruido llevo" y **no depende del número de pasos**
  (con 8 pasos no se redondea a un paso entero de más o de menos). Cuántos pasos quedan = los del calendario por debajo de
  ese sigma.
- **No pude confirmar** cómo mapea `noise_level_to_sigma` para el denoiser de Klein (¿identidad? ¿pasa por el shift?) ni la
  fórmula de mezcla del init con ruido: el muestreador no estaba en los archivos leídos (`image.cpp` pasa el latente y la
  máscara a `sd->sample(...)`; `diffusion_engine.cpp` truncado). **Tarea concreta:** leer `denoiser.hpp`
  (`src/runtime/denoiser.hpp`, `noise_level_to_sigma`) antes de fiarse del número. Si no hay shift, 0,97 es de verdad
  casi ruido puro; si lo hay, 0,97 sigue siendo alto.

### 1.2 Fuerzas de la comunidad (cifras con fuente)

| Fuerza (denoise) | Uso | Fuente |
|---|---|---|
| 0,2-0,35 | retoques pequeños, conservar identidad o disposición | RunDiffusion img2img [S] |
| 0,3-0,5 | cambios sutiles que conservan composición | idem [S] |
| 0,6-0,8 | cambios grandes que conservan la estructura general | idem [S] |
| 0,35-0,55 | refinar con Klein una imagen SDXL | workflow Civitai (vía buscador) [S] |
| 0,7 -> 0,4 -> 0,2 | pasadas sucesivas: cambios grandes, luego composición, luego pulido | guía Apatero (vía buscador) [S] |
| factor <1 de "denoising strength change factor" | loopback de A1111: la fuerza se multiplica en cada vuelta y el resultado converge | pista de A1111 (webui hints.js) [S] |

Sin fuente: **nadie documenta fuerzas para boceto de manchas -> fotorrealismo en Klein**. La búsqueda del 26-oct ya lo dijo;
repetida hoy da lo mismo. Todo lo siguiente es [E].

### 1.3 Aviso de equivalencia

Los 0,6-0,75 de ComfyUI/A1111 son *denoise* sobre un calendario con shift distinto (SD: lineal/Karras; Klein: shift 6,93).
En sd.cpp **modo por defecto** (`t_enc = pasos·strength`) con shift 6,93, saltarse 25 % de los pasos ya quita mucho del
ruido alto; en **modo ruido** 0,7 es sigma 0,7 (si no hay shift en el mapeo). No son comparables: **hay que medir** con
una rejilla corta.

### 1.4 ¿Valores o color plano en el boceto?

- Sin fuente de Klein [E]. Razonamiento: la forma gruesa la deciden los sigmas altos; lo que sobrevive a sigma ~0,7 es la
  **luminancia de baja frecuencia** (manchas claras/oscuras) y el color medio. Un boceto de **masas con luz simple (un
  degradado por volumen, sombra en el suelo)** da más señal de "esto es un cuerpo cilíndrico y bajo" que un relleno plano,
  que el modelo lee como ilustración vectorial/pintura plana.
- Bordes suaves (`gblur` 2-4 px): un borde duro se copia (ya dicho el 26-oct).
- Color: poner los rasgos que fallan en un color distinto (cresta negra, púas rojas) sigue siendo recomendable [E].
- Fondo: en el boceto, **fondo ya con el color/luz del banner final** (cielo y suelo en degradado); si no, el modelo
  repinta un fondo plano.

### 1.5 Loopback iterativo

- Idea: salida 1 -> entrada 2 con fuerza menor. Fuente: loopback de A1111 con factor <1 converge [S]; guía 0,7/0,4/0,2 [S].
- Coste en la Deck: cada pasada es completa en píxeles (~190 s/paso a 1280x512) pero solo gasta los pasos por debajo del
  sigma inicial; a menor fuerza menos pasos [E]. Una cadena 0,75 -> 0,5 -> 0,3 con 16 pasos sería ~12 + 8 + 5 pasos [E]
  = ~80 min a 1280x512; en 640x256 ~20 min.
- Riesgo [E]: el loopback acumula artefactos del VAE y tiende a aplanar texturas; con 3 pasadas máximo.
- **Pasadas a 640x256 para decidir la forma y subir luego** pierde la forma al subir si se sube con fuerza alta; subir con
  <=0,4.

## 2. Repintado por partes con `--mask` (código leído de `image.cpp`) [P]

- La máscara se **redimensiona al tamaño de la imagen y se binariza** (`round`): no hay degradado ni desenfoque de borde
  (el código dice "mask blur not implemented here").
- Se reduce al latente con interpolación `NearestMax`: **toda celda de latente que toque un píxel enmascarado se regenera**
  (el área efectiva crece ~una celda de 16 px alrededor en FLUX.2 VAE) [P/E].
- Sin máscara: unos de todos los píxeles (regenera todo).
- **Para Klein (modelo sin variante de inpaint)** no se construyen canales de concat; la máscara llega al muestreador solo como
  `denoise_mask` [P]. Los canales de concat existen para FLUX Fill y Flex.2, no para Klein. La fórmula de mezcla por paso
  está en el muestreador (no leído); lo habitual (RePaint / inpaint latente) es `x = m·x_gen + (1-m)·noised(x_init)` [E].
- Limitaciones [E]: costura visible porque el borde es binario (arreglo: máscara con margen, y una pasada final de
  `-i` al 0,2-0,3 sobre toda la imagen); el modelo no ve el contexto fuera de la máscara de forma "sana" (el contexto fijo
  entra por la atención con ruido, no limpio); no baja el coste (se calcula todo el transformer).
- Hay un `detailer.cpp` en `src/` (tipo ADetailer) que no se ha leído; **tarea:** mirar `sd-cli --help` por opciones de
  detailer (puede recortar y repintar solo la zona; ahorraría tiempo).
- Ejemplos de uso con Klein en sd.cpp: **no encontrados**; solo la discusión 1516 (de la investigación anterior).

## 3. LoRA por criatura con 1-4 imágenes

- **Cantidad (BFL, guía oficial de LoRA para Klein):** estilo 15-40 imágenes de un mismo aspecto; edición 50-200 pares;
  >=1024 px de lado largo; lr 1e-4; los de estilo rinden mejor hacia los pasos 750-1500; **"mira las muestras, no la
  pérdida"**; "evita repetir el mismo fondo" [P] ([HF blog BFL](https://huggingface.co/blog/black-forest-labs/flux-2-klein-lora)).
  fal.ai: mínimo 10 [S].
- **Con 1-4 banners:** debajo de lo recomendado [P]. Riesgos [E]: aprende fondo, encuadre y luz del banner (todos son el mismo
  tipo de plano panorámico); la criatura sale "pegada" en la misma pose.
- **Cómo mitigar [E]:** (a) recortes de la criatura sola en 8-12 encuadres y escalas distintas (cuerpo entero, cabeza,
  cresta, patas) más volteo horizontal (la criatura es asimétrica solo si hay un lado definido: valida que no cambie nada
  de la ficha); (b) fondos sintéticos distintos (pegar la silueta sobre fondos variados: rembg + componer), o
  mejor **entrenar con el fondo enmascarado** si el entrenador admite máscaras (ai-toolkit tiene máscara de pérdida: [E],
  sin comprobar); (c) subtítulos de solo el contenido y una palabra disparadora inventada (regla de BFL [P]); (d) rank bajo
  (16): rank >=64 sobreajusta con pocos datos [S, workingnotworking].
- **Kaggle gratis:** nuestro LoRA de estilo ya sale a ~30 s/paso en T4 con fp32 (`lora-kaggle.md`, [L] del 2026-11-02),
  1000 pasos = ~8,5 h con 134 imágenes. Un LoRA por criatura con ~30-40 recortes a 512 px y 500-750 pasos cabe en una
  sesión, pero **consume una parte grande de la cuota semanal (~30 h, sin confirmar)** y habría que repetirlo por criatura
  [E]. Mejor un único LoRA "criaturas inventadas del juego" con varias criaturas y palabras disparadoras distintas.
- Veredicto: segunda línea. Solo si el boceto con fuerza media no basta.

## 4. Novedades desde el 26-oct

- **sd.cpp:** releases master-1043 (02-nov, CI) y master-1044 (03-nov, "native SiTU for MOSS") posteriores a master-1039
  (01-nov, "custom modulate operator and ConvRot fusion"). Commits del 28-oct al 03-nov: optimizaciones, correcciones de
  Vulkan/CUDA y "fix: support integer LoRA scalar conversion to FP32 (#2263)". **Nada de control, ControlNet ni edición con
  referencia para Klein** [P, listados de releases y commits consultados hoy; la lista de commits se truncó, no cubre el
  26-oct al 28-oct]. `docs/flux3.md`: `-r` hasta 10 referencias, 16 pasos, cfg 1,0, shift 6,93; **no menciona control,
  strength, máscara ni LoRA** [P].
- **Hugging Face (Klein con control):**
  - `DiffSynth-Studio/Template-KleinBase4B-ControlNet`: control estructural (profundidad/contornos/perspectiva), Apache-2.0,
    para **FLUX.2-klein-base-4B** con la librería DiffSynth; 24-40 GB de GPU; ejemplos con 50 pasos y cfg 4. No es nuestro
    modelo (FLUX.3 Image Klein Q8) ni corre en sd.cpp [S].
  - `gilfoyle0813/flux2_klein_9b_depth_control`: LoKR de profundidad para Klein 9B, MIT, entrenado con ~550 imágenes casi
    todas humanas; fuerza 0,3-1,3 [S]. 9B y licencia de Klein 9B no comercial [S, wiki BFL].
  - `thedeoxen/refcontrol-...-9B-...`: ya vistos el 26-oct. `prithivMLmods/Flux2-Klein-Cinematic-FlatLog-Control`: no es
    de forma [S].
  - **Conclusión:** sigue sin haber ControlNet utilizable para FLUX.3 Image Klein en la Deck.
- Xinference lista FLUX.2 klein con "Available ControlNet: None" [S].

## 5. Silueta del banner sin GPU

- **rembg** (MIT): `pip install "rembg[cpu,cli]"` (Python 3.11-3.13); `rembg i in.png out.png`, `-om` solo máscara; modelos
  `u2netp` (ligero), `isnet-general-use`, `birefnet-general(-lite)`; `bria-rmbg` (por defecto) **no vale: licencia
  comercial de pago** [P, README rembg].
- **Coste:** un test aislado en CPU Apple Silicon: u2net 0,4 s, isnet-general-use 1,1 s, BiRefNet-general 15,2 s [S, un solo
  caso]. En la Deck será algo más lento [E], pero segundos por imagen.
- **Licencias de los pesos:** rembg MIT; BiRefNet MIT (código y pesos) [S]; u2netp/isnet: sin confirmar (mirar el repo de
  origen antes de redistribuir) [S]. Para uso interno de generación no hay problema [E].
- **Alternativas sin red neuronal:** si el banner tiene un fondo de color limitado, un umbral de color/ chroma con ffmpeg
  (`chromakey`, `colorkey`) y `rsvg-convert`/Python puro; sin dependencias nuevas [E, ffmpeg ya comprobado el 26-oct].
- **Uso:** la máscara del banner sirve (a) para repintar solo la criatura (§2) y (b) para obtener la **proporción real**
  (caja y área) que el script del esqueleto compara con la ficha. Como boceto directo, la silueta de un banner donde el modelo
  ya falla no ayuda (es la silueta mala); el que sirve es el que dibuja el script con las proporciones de la ficha.

## Propuesta: prueba de 4 borradores del aullador (640x256, 8 pasos, ~9 min cada uno [E]: 190 s/paso a 1280x512 / 4 px)

Antes de lanzar: comprobar `noise_level_to_sigma` en `src/runtime/denoiser.hpp` (§1.1). Mismo prompt (ficha del aullador),
misma semilla, `--backend diffusion=cpu -t 8`, `-W 640 -H 256 --steps 8 --cfg-scale 1.0 --sampling-method euler`.
Boceto `esqueleto.png` (640x256): cinta larguísima (largo ~3x alto), patas cortas, cresta negra con púas rojas, **masas con
degradado de luz y sombra de suelo, bordes con `gblur` 3 px, fondo ya en los colores del banner**. Boceto `plano.png`: el mismo
con relleno plano. Nota: `generar.sh` trae `--strength 0.97` por defecto (`FUERZA_BOCETO`); aquí se fuerza el valor.

| Borrador | Parámetros distintos | Qué mide |
|---|---|---|
| A | `-i esqueleto.png --strength 0.75 --extra-sample-args strength_as_noise_level=true` | Fuerza media en modo ruido: ¿conserva la silueta larga y da acabado fotorreal? Es el punto de partida de la rejilla. |
| B | igual que A con `--strength 0.60` | Dónde empieza a mandar demasiado el boceto ("pintura plana") o ya se conserva por completo: acota el rango útil junto a A. |
| C | igual que A con `-i plano.png` | Efecto de las masas con luz frente a color plano (con la misma fuerza que A). |
| D | `-i` = salida de A (copiada a `a.png`) `--strength 0.40 --extra-sample-args strength_as_noise_level=true`, `--steps 8` | Loopback: ¿la segunda pasada suave añade detalle sin mover la forma? Comparar la proporción largo/alto con A. |

Medidas (a ojo y con la máscara de rembg de la salida): relación largo/alto del cuerpo (objetivo >= 3), altura de las
patas, cresta continua con púas rojas, aspecto (fotorreal / pintura plana), tiempo real por paso. Criterio: si A o B dan
largo/alto >= 2,5 en dos semillas, esa fuerza pasa al banner a 1280x512; si ninguna conserva la forma, probar `-r` o
LoRA de concepto (§3). Si D mejora el acabado sin perder la forma, el flujo es dos pasadas (0,75 y 0,4).

## Fuentes

- [P] sd.cpp `src/pipeline/image.cpp` (strength_as_noise_level, denoise_mask), consultado 2026-11-03:
  https://raw.githubusercontent.com/leejet/stable-diffusion.cpp/master/src/pipeline/image.cpp
- [P] sd.cpp `docs/flux3.md`, `docs/edit.md`; releases y commits (a 2026-11-03):
  https://github.com/leejet/stable-diffusion.cpp/releases , https://api.github.com/repos/leejet/stable-diffusion.cpp/commits
- [P] BFL, LoRA con Klein: https://huggingface.co/blog/black-forest-labs/flux-2-klein-lora ; entrenamiento:
  https://docs.bfl.ai/flux_2/flux2_klein_training
- [P] rembg README: https://github.com/danielgatis/rembg
- [S] RunDiffusion img2img: https://www.rundiffusion.com/img2img-docs ; Apatero guía de edición con Klein:
  https://apatero.com/blog/flux-2-klein-image-editing-guide ; Civitai receta FLUX.2: https://developer.civitai.com/orchestration/recipes/flux2
- [S] Controles Klein en HF: https://huggingface.co/DiffSynth-Studio/Template-KleinBase4B-ControlNet ,
  https://huggingface.co/gilfoyle0813/flux2_klein_9b_depth_control ; wiki BFL: https://github.com/black-forest-labs/flux2/wiki
- [S] guías de LoRA: https://workingnotworking.com/flux-2-lora-training-guide/ , https://www.runcomfy.com/trainer/ai-toolkit/flux-2-klein-lora-training
- [S] tiempos de rembg: https://aireiter.com/blog/best-background-removal-api ; PyPI: https://pypi.org/project/rembg/2.0.71/
- [L] `image-generator/scripts/generar.sh` (strength 0.97), `docs/producto/plan-imagenes/lora-kaggle.md` (30 s/paso en T4).

## Límites

- No se leyó el muestreador de sd.cpp ni `denoiser.hpp`: el mapa de `noise_level_to_sigma` y la fórmula de mezcla por paso de
  la máscara son [E].
- Las cifras de comunidad vienen de resúmenes del buscador (no se abrieron las páginas de Apatero, Civitai ni RunDiffusion).
- No se encontró nada de Reddit/Civitai con experiencias de bocetos -> Klein.
