# Plan de la plantilla «fotorreal» (`IMG-16`…`IMG-23`)

**Fecha:** 2026-10-26. **Objetivo** (usuaria, 2026-10-26, en `IMG-15`): que el generador local (sd-cli + FLUX.3 Image
Klein Q8 GGUF, CPU de la Deck, ~49 min por banner de 1280x512 a 16 pasos) iguale en calidad y en diseño los banners
de ChatGPT del juego (`backend/uploads/images/`: 60 de fauna, 8 de flora, 61 de lugar), y que lo haga una plantilla
reutilizable que genere bien **sin imagen de referencia**. Cierra `IMG-15`; sus tareas entran en
[`roadmap-imagenes.md`](../roadmap-imagenes.md) detrás de `IMG-15`.

**Qué hay** (resultados en [`banco/resultados.md`](banco/resultados.md), r10-r12): FLUX.3 en CPU es el mayor salto de
calidad del banco, pero r12 falla en lo mismo en las dos criaturas: proporción (el aullador sale zorro; el cuernahoja,
cuello corto), rasgos a medias (cresta solo en el lomo; cuernos de carnero), manada de otra especie (hienas, ciervos)
y color neutro frente a la bruma roja de GPT. Cardo y pastos no se hicieron.

## Marco: las ocho decisiones (no se reabren aquí)

Lo que la evidencia no apoya de cada una va a [Riesgos y dudas](#riesgos-y-dudas), sin cambiar la decisión.

| # | Decisión | Investigación que la sostiene |
|---|----------|-------------------------------|
| 1 | El prompt llega entero: texto fijo ≤ ~60 palabras; B5 entorno y B6 luz nunca se recortan; en `fotorreal` sube el tope de 320 palabras (FLUX.3 lee 4096 tokens); orden plano → sujeto con proporción estructural → pose → entorno → luz → línea fija `Style: … Mood: …`; **sin reescritura por LLM** | [prompts P1-P6, P8](investigacion-prompts-criaturas.md#4-prácticas-concretas), [motor §3](investigacion-motor.md#3-codificador-de-texto), [motor §5](investigacion-motor.md#5-guía-de-prompts-de-bfl-flux3--flux2--klein) |
| 2 | Gradación y medida en ffmpeg: base común + tinte por momento; calibrada una vez contra los banners de GPT (único uso de referencias); criterio objetivo (`signalstats` + EMD de croma en Python puro + rejilla visual); horneable a LUT 3D | [estilo §4](investigacion-estilo-serie.md#4-criterio-objetivo-de-se-parece-a-los-banners-del-juego-propuesta), [§5.3](investigacion-estilo-serie.md#53-cadena-propuesta-de-posprocesado), [§5.4](investigacion-estilo-serie.md#54-convertir-el-estilo-en-perfil-fotorreal-sin-referencia) |
| 3 | Forma de las criaturas raras: boceto SVG plano rasterizado con `rsvg-convert` como `--init-img` con `strength_as_noise_level=true`, fuerza ≈ 0,85; rasgo que falle, inpainting por partes; solo en fichas que lo piden (campo de la ficha) | [control-forma §2.1](investigacion-control-forma.md#21-boceto-o-maqueta-como---init-img-img2img), [§3](investigacion-control-forma.md#3-dibujar-la-silueta-sin-gpu-ni-librerías), [§5](investigacion-control-forma.md#5-prueba-mínima-propuesta-3-generaciones-máximo) |
| 4 | Composición por planos: plancha y sujeto sobre verde por separado, montaje con `montar.sh` (manada = copias); manada por edición (`-r`) solo de reserva | [técnicas §4](investigacion-tecnicas-diseno.md#4-propuesta-cadena-de-planos-para-un-banner-con-criatura), [comunidad §4](investigacion-comunidad.md#4-grupos-de-la-misma-especie) |
| 5 | Armonización abierta, se decide probando: `-i` con `strength_as_noise_level` bajo frente a edición con `-r` («misma escena, luz X»); comparación pequeña, misma semilla | [motor §2](investigacion-motor.md#2-img2img-máscara-y-edición-con-referencias), [comunidad §2.2](investigacion-comunidad.md#22-cambiar-solo-la-luz-o-el-estilo-del-conjunto) |
| 6 | Codificador de texto en Q8 (`Qwen3VL-4B-Instruct-Q8_0`, ~4,3 GB), descarga **con permiso de la usuaria**; A/B con la misma semilla frente al Q4_K_M actual | [comunidad §5](investigacion-comunidad.md#5-klein-en-hardware-modesto-lo-que-se-sabe-y-lo-que-no), [motor §3](investigacion-motor.md#3-codificador-de-texto) |
| 7 | Iteración barata: decisiones de composición con borradores de 640x256 y ~8 pasos, más `--preview`; 16 pasos a 1280x512 solo para el candidato | [motor §6](investigacion-motor.md#6-velocidad-para-poder-probar-más), [control-forma §4](investigacion-control-forma.md#4-prácticas-aplicables-a-nuestro-flujo) |
| 8 | Descartado por ahora: ver [abajo](#descartado-por-ahora) | [lora](investigacion-lora.md#recomendación), [comunidad §7](investigacion-comunidad.md#7-lo-que-se-descarta-y-por-qué), [motor](investigacion-motor.md#lo-que-se-descarta-y-por-qué) |

## Reglas que valen para todo el plan

- **Memoria, antes de cada generación** (memoria del agente «Memoria antes de generar»): `free -m`, `ollama ps` y los
  procesos `sd-cli`, `sd-server` y el narrador; se dice a la usuaria qué ocupa memoria y se le pregunta qué cerrar.
  Se lanza con `LIBERAR_OLLAMA=1` y el `MIN_INICIO_MB=7000` de `generar.sh`; FLUX.3 ha corrido con 4,7-6 GB libres
  de mínimo y r8 abortó por el narrador (5,2 GB). Con sd-cli en marcha no se pasan el check ni los tests
  (`test_interfaz_imagenes` rompe).
- **Costes:** 1280x512 ≈ 180 s/paso + 40 s de VAE (16 pasos ≈ 49 min; 8 ≈ 25 min; 4 ≈ 13 min). Borrador 640x256 a 8
  pasos ≈ 5-8 min `[E]`. Sujeto 1024x384 a 16 pasos ≈ 28-30 min. img2img con `strength_as_noise_level=true`: 0,5 →
  ~2 pasos (6-9 min); 0,7 → ~4 (12-15 min); 0,85 → ~7 (23-25 min). `-r` multiplica el tiempo ×1,5-2 y en la Deck
  FLUX.3 con `-r` no llegó a arrancar por memoria (README G). Todo `[E]`: se apunta el tiempo real en
  `banco/resultados.md` en cada tanda.
- **Cada generación con semilla fija** (la 3 de r12 para comparar con lo que ya hay) y una palanca a la vez.
- **Lo comprobable lo hace un script**: cada criterio de aceptación de abajo es una orden, no una opinión, salvo el
  «sí/no a ojo» de la usuaria, que se apunta en la tabla de pruebas de `resultados.md`.
- **Nada se da por fijo hasta Fase 3**: en Fases 1 y 2 los mandos van a mano (`banco.sh` con `r14-*.tsv` y `planos.sh`),
  y solo lo que gana pasa a `generar.sh`, `probar.sh` y `mundo.json`.

## Fase 0 · Sin generar nada

### IMG-16 · Prompt `fotorreal` en `prompt_ficha.py`, con tests [P] · S

Decisión 1. Hoy `RECORTABLES = ('B6', 'B5', 'B4')` recorta la luz y el entorno en cuanto la ficha pasa de 320 palabras
(el aullador va a 312 y el cuernahoja a 300 ya sin texto fijo), las anclas («fox» ×3, «giraffe») mandan sobre los
rasgos y la manada se pide por anáfora («more of the same»), que el modelo no resuelve
([prompts §1](investigacion-prompts-criaturas.md#1-resumen)).

**Cambios:**
- `image-generator/estilo/mundo.json`: perfil `fotorreal` en `estilos` (`palabra: photographic`; `base` = la línea
  `Style: photorealistic fantasy matte painting, cinematic concept art, shot on a full-frame camera with a 35mm lens,
  soft golden-hour rim light, warm atmospheric haze, rich natural colour. Mood: epic, hazy, grounded.` de
  [estilo §5.4](investigacion-estilo-serie.md#54-convertir-el-estilo-en-perfil-fotorreal-sin-referencia), con la
  lente por tipo en `porTipo` y «The image is completely textless» al cierre), en `encuadres` (el de `banner`,
  con la cámara baja de r13) y en `longitud` un tope por perfil (`fotorreal.max: 520`, de referencia: FLUX.3 lee 4096
  tokens; 320 sigue para el resto) y la lista de recortables por perfil (`fotorreal: ["B3b"]`).
- `image-generator/scripts/prompt_ficha.py`: `RECORTABLES` pasa a leerse de `mundo['longitud']['recortables'][perfil]`
  (por defecto la actual); el perfil `fotorreal` **no usa `preambulo`** (su texto fijo son `encuadre` + `base` ≈ 60
  palabras, se comprueba con un test) y ordena B7 encuadre → B1 sujeto + campo nuevo `proporcion` (medidas del propio
  cuerpo: «body three times as long as it is tall», antes del ancla, P2) + B3 rasgos distintivos + ancla + B2 cuerpo →
  B4 pose + campo nuevo `manada` (frase nominal completa, P3) → B5 entorno → B6 luz → B8 `Style/Mood`. Campo nuevo
  opcional `rasgosSecundarios` (B3b), el único recortable en `fotorreal`; si aun así pasa del tope, aviso, no recorte.
  Avisos nuevos en `_comprobar` (van al `--json` como `avisos`): palabra de animal real del ancla repetida más de 2
  veces (P2); pose sin ninguna de `turned, lifted, weight, three-quarter, mid-stride` (P4); anáfora en `manada`
  (`more of the same`, `the rest of`, `others`); más de una fuente de luz nombrada en B6 (P5).
- `docs/producto/plan-imagenes/banco/prompts.py`: acepta `--perfil fotorreal` y escribe `banco/prompts/r14-<ficha>-fotorreal.txt`.
- Fichas `image-generator/fichas/fauna/aullador-rojo.json` y `cuernahoja.json`: `proporcion`, `manada`, `rasgosSecundarios`
  y la reescritura de [prompts §5](investigacion-prompts-criaturas.md#5-ejemplos-reescritos) (279 y 291 palabras);
  `flora/cardo-brujula.json` y `location/pastos-de-la-deriva.json` por capas (P9: la planta en su paisaje, no macro).
  Lo que choca con el canon sigue en `propuestas` de la ficha, no se toca `docs/rpgtarkor/`.
- Tests en `tools/qa/tests/test_prompt_ficha.py` (hoy 69): orden de bloques en `fotorreal`; B5 y B6 nunca recortados
  aunque la ficha pase del tope; texto fijo ≤ 60 palabras; cada aviso nuevo; `--json` con `recortados` y `avisos`;
  el perfil `banner` no cambia (regresión). Cada test rojo sin su arreglo:
  `bash .claude/gw/scripts/rojo-sin-arreglo.sh "cd tools/qa/tests && python3 -m unittest -q test_prompt_ficha" image-generator/scripts/prompt_ficha.py`.

**Aceptación:** `python3 image-generator/scripts/prompt_ficha.py image-generator/fichas/fauna/aullador-rojo.json
--perfil fotorreal --variante macho --json` (y el cuernahoja, el cardo y los pastos) da `recortados: []`, `avisos: []`,
entre 260 y 400 palabras, y los cuatro `r14-*-fotorreal.txt` escritos; check del proyecto en verde.
**Coste:** 0 generaciones, ~0 min de Deck; 2-3 h de agente (modelo barato para los tests, revisión en la principal).
**Bloquea:** todo lo demás (Fase 1 usa estos prompts). **Si falla:** si el tope de 520 resulta corto para una ficha,
se sube el tope antes que recortar; el texto fijo nunca pasa de 60.

### IMG-17 · Gradación y medida en ffmpeg, calibradas contra los banners de GPT [P] · S

Decisión 2. Medido en [estilo §2.2](investigacion-estilo-serie.md#22-por-qué-gptmidjourney-parecen-caros): los 134
banners de GPT dan YAVG ~82, SATAVG ~21, YMIN ~9, YMAX ~236; el aullador r12 va a 94 / 28 y la cadena B baja el EMD
de croma de 7,2/15,7 a 5,4/5,5 pero deja la luma en 67 (oscura).

**Cambios:**
- `image-generator/scripts/gradar.sh <entrada> <salida> <momento> [region]`: cadena A (base: curvas, claridad con
  `unsharp` en `gbrp`, viñeta `mode=forward`, grano) + tinte por momento (`dia`, `atardecer`, `noche`) de
  [§5.3](investigacion-estilo-serie.md#53-cadena-propuesta-de-posprocesado), con el `master 0.5/0.40 → 0.5/0.46` que
  corrige la luma de B. Las órdenes viven en `image-generator/estilo/gradacion.json` (una por momento, con su EMD de
  aceptación); cuando una se acepta, `gradar.sh --hornear` la guarda como LUT 3D (`image-generator/estilo/lut/<momento>.cube`,
  vía `haldclut`) y desde entonces se aplica con `lut3d`.
- `image-generator/scripts/medir/stats.sh` (signalstats + HF), `emd.py` (stdlib, se ejecuta con `python3 -I`) y
  `rejilla.sh` (rejilla candidato / 5 banners GPT) del código de §5.3. `medir.sh <imagen> <tipo> <momento>` elige 5
  banners de GPT del mismo tipo y momento (lista en `gradacion.json`, elegida a ojo una vez) y devuelve la mediana
  del EMD Cb/Cr y las stats.
- Tests `tools/qa/tests/test_gradar.py`: `emd.py` da 0 entre una imagen y sí misma y > 0 con un tinte; `gradar.sh`
  sobre un PNG sintético (`ffmpeg -f lavfi`) no cambia el tamaño y mueve YAVG en la dirección esperada; se saltan si
  no hay `ffmpeg` (CI).
- Calibración (ffmpeg, segundos): A + cada tinte sobre los r12 (aullador atardecer, cuernahoja día) y sobre 3 banners
  de GPT que no estén entre los 5 de referencia (control: la gradación sobre un GPT no debe alejarlo). Rejilla a la
  usuaria para decir sí/no a cada tinte.

**Aceptación** ([§4](investigacion-estilo-serie.md#4-criterio-objetivo-de-se-parece-a-los-banners-del-juego-propuesta)):
para cada momento, la mediana del EMD frente a los 5 banners baja de Cb ≲ 6 y Cr ≲ 7,5 (pasa) y nunca sube de
11,4/13,5 (falla); YAVG en 70-95 y SATAVG en 15-30; sobre un GPT de control, el EMD no empeora más de 1. Los tres
tintes aceptados por la usuaria en la rejilla. **Coste:** 0 generaciones, ~10 min de Deck (ffmpeg), 2-3 h de agente.
**Bloquea:** la medida de Fases 1-3 (sin ella no hay criterio). **Si falla:** un tinte que no baje del umbral se
ajusta a mano con `rejilla.sh` sobre los r12; si el umbral no se alcanza con ninguna cadena, el tope se fija en la
mediana (11,4/13,5) y se apunta en Riesgos.

### IMG-18 · Bocetos SVG de forma, revisados por la usuaria [P] · S

Decisión 3. `rsvg-convert` está en la Deck (`/usr/bin/rsvg-convert`; sin `magick` ni `inkscape`); los dos SVG de
[control-forma §3](investigacion-control-forma.md#3-dibujar-la-silueta-sin-gpu-ni-librerías) existen solo en la
investigación, y el depredador «sigue leyéndose más lateral que de tres cuartos».

**Cambios:**
- `image-generator/bocetos/depredador.svg` (cuerpo ≥ 3× más largo que alto, cresta continua nuca → cola en negro,
  cabeza girada a tres cuartos con el lado lejano visible y las patas lejanas desplazadas) y `herbivoro.svg` (cuello
  largo, cuernos-hoja verdes laterales, patas de ave). Colores planos: suelo rojizo, cielo ámbar, sujeto en su color
  base, cresta en negro. Rasterizados a 1280x512, 1024x384 (sujeto) y 640x256 (borrador):
  `rsvg-convert -w 1280 -h 512 depredador.svg -o depredador-1280.png`.
- Campo de ficha `boceto: {"archivo": "bocetos/depredador.svg", "fuerza": 0.85}` en el aullador y el cuernahoja
  (`prompt_ficha.py` lo ignora; lo leerán `generar.sh`/`probar.sh` en `IMG-23`). Sin el campo, la ficha va por txt2img.
- Test `tools/qa/tests/test_bocetos.py`: cada SVG es XML válido, de 2,5:1, y rasteriza si hay `rsvg-convert`
  (se salta si no); comprobación en la Deck de que `rsvg-convert` corre dentro de `tools/qa/host.sh`.

**Aceptación:** la usuaria dice sí a los dos PNG (rejilla con la silueta y el banner de GPT al lado): se lee la
proporción, la cresta entera y el tres cuartos. **Coste:** 0 generaciones, ~5 min de Deck, 1-2 h de agente.
**Bloquea:** `IMG-19b` y la parte de sujeto de `IMG-21`. **Si falla:** si un boceto no convence a ojo no se prueba en
el generador; se redibuja (como mucho dos vueltas) o esa criatura va sin boceto y se apunta.

## Fase 1 · Borradores baratos (640x256, ~8 pasos)

Decisión 7. Un borrador ≈ 5-8 min. Todos con la semilla 3 y los prompts `r14-*` de `IMG-16`, por `banco.sh` con
`banco/r14-borradores.tsv` (misma fila de modelo que `r12-fotorreal.tsv`: FLUX.3 Q8, VAE `flux2-vae`, `--backend
diffusion=cpu -t 8`, `TOPE` corto). Las imágenes van a `image-generator/generated/banco/r14-*`.

### IMG-19 · Tanda de borradores: método, bocetos, planos y armonización [P] · M

**19a · Que el borrador valga como anticipo** (bloquea el resto de la fase). 1 borrador del aullador con el prompt
`r14` a 640x256 / 8 pasos, y `--preview proj --preview-interval 1` activado para ver si la proyección sirve con
FLUX.3 ([motor §6](investigacion-motor.md#6-velocidad-para-poder-probar-más), sin verificar). Después, el mismo prompt
a 1280x512 / 16 pasos **una sola vez** (es el candidato txt2img de referencia de Fase 2, no se tira). *Aceptación:*
la composición del borrador (dónde está el sujeto, horizonte, manada) coincide a ojo con la de 16 pasos; `--preview`
escribe algo legible. *Coste:* 7 + 49 min, 2 generaciones. *Si falla:* los borradores solo deciden el prompt, no la
composición, y los pasos de composición de Fase 2 se hacen a 1280x512 / 8 pasos (25 min) en vez de 7.

**19b · Escalera de fuerza del boceto** ([control-forma §5](investigacion-control-forma.md#5-prueba-mínima-propuesta-3-generaciones-máximo),
adaptada a borrador). Depredador con `-i bocetos/depredador-640.png --strength 0.85 --extra-sample-args
strength_as_noise_level=true`, luego 0,75 y 0,92; el herbívoro con la fuerza ganadora y una vecina. *Aceptación:*
los tres sí/no de §5 (cuerpo ≥ 3× largo; cresta continua nuca → cola; cabeza de tres cuartos), apuntados por fuerza
en la tabla de pruebas. *Coste:* 5 borradores, ~30 min. *Si falla:* ninguna fuerza da la forma → el boceto se
descarta como mando, se apunta en Riesgos y la forma queda en manos del prompt (`proporcion`) y del inpainting por
partes; la decisión 3 no se reabre aquí, se lleva a la usuaria.

**19c · Planos en pequeño** (decisiones 4 y 5). Plancha (`r14-plancha`, 640x256) + sujeto sobre verde (`r14-sujeto`,
512x192, con boceto si ganó en 19b) + `montar.sh` (`HERO`, `MANADA` con 3 copias; se añade a `montar.sh` un volteo
horizontal y escala por copia para que no sean la misma silueta) + armonización, dos vías con la misma semilla:
`-i montaje.png --strength 0.5 --extra-sample-args strength_as_noise_level=true` y luego 0,7 con `r14-armonia`
(que solo describe la escena y la luz); y `-r montaje.png --ref-image-args vae_input_max_pixels=262144` con el prompt
«the same scene and animals as image 1, rendered as a photograph in dusk light» ([comunidad §2.2](investigacion-comunidad.md#22-cambiar-solo-la-luz-o-el-estilo-del-conjunto)).
`planos.sh` se corrige antes: su fase 2 pasa `--strength 0.2/0.3/0.4` **sin** `strength_as_noise_level`, que con
FLUX.3 es casi ruido total ([motor §2](investigacion-motor.md#2-img2img-máscara-y-edición-con-referencias)).
*Aceptación:* el montaje conserva la composición y las copias de la manada se leen como la misma especie; de las
tres armonizaciones, gana la que menor EMD da con `medir.sh` sin perder la silueta del sujeto (comparar bbox antes y
después, `montar.sh` ya la calcula); se apunta si `-r` arranca en la Deck y cuánto tarda. *Coste:* 2 borradores +
3 armonizaciones ≈ 35-50 min (la vía `-r`, 15-30 min o aborto). *Si falla:* si `-r` no arranca o dobla el tiempo sin
ganar, la decisión 5 se cierra por `-i`; si el montaje se nota pegado también tras armonizar a 0,7, Fase 2 prueba la
manada por edición (reserva de la decisión 4).

**Bloquea:** `IMG-16`, `IMG-17`, `IMG-18`. **Coste total de `IMG-19`:** ~10 generaciones, 2-2,5 h de Deck.

### IMG-20 · Codificador de texto Q8, A/B con la misma semilla [P] · S · opcional

Decisión 6. **Opcional y al final** (revisión de la sesión principal, 2026-10-26): la evidencia a favor midió la
cuantización del modelo de difusión, no la del codificador, y r2 vio el Q8 neutro (Riesgos 4); no bloquea nada. Pedir permiso a la usuaria para descargar `Qwen/Qwen3-VL-4B-Instruct-GGUF` → `Qwen3VL-4B-Instruct-Q8_0.gguf`
(4,28 GB; el Q4_K_M ocupa ~2,5 GB, así que el pico de memoria al codificar sube ~1,8 GB; con `--params-backend disk`
se libera antes de la difusión, a comprobar en el log). A/B: el borrador de `19a` con `LLM=…Q8_0.gguf`, misma semilla,
y el candidato de 16 pasos si el borrador cambia algo. *Aceptación:* se apunta a ojo si el Q8 obedece mejor la
proporción, la cresta y la manada (tres sí/no) y la diferencia de tiempo; gana si mejora al menos uno sin empeorar
ninguno. *Coste:* 1 borrador (7 min) + 1 candidato (49 min) si procede; descarga 4,3 GB. *Bloquea:* el permiso y
`19a`. *Si falla:* el Q8 se queda en disco como `LLM=` opcional y el perfil sigue en Q4_K_M; se apunta que r2 ya lo
vio neutro con klein 4B ([motor §3](investigacion-motor.md#3-codificador-de-texto)).

## Fase 2 · La imagen buena

Cada criatura cierra con un **candidato** a 1280x512 / 16 pasos, gradado con `gradar.sh` y medido con `medir.sh`, en
una rejilla junto a su banner de GPT (`imagenJuego` de la ficha) para el sí/no de la usuaria. Se apunta en
`resultados.md` la receta exacta (prompt, semilla, fuerza, vía de armonización, tiempos reales) porque es lo que
`IMG-23` convierte en perfil.

### IMG-21 · Aullador rojo y cuernahoja [A] · M

**Aullador** (atardecer, Llanuras del Viento Rojo), por planos:
1. Plancha 1280x512 / 16 pasos con `r14-plancha` (49 min). Se guarda como plancha de la región: la reutilizan el
   cuernahoja si cae en la misma región y `IMG-12` más adelante.
2. Sujeto sobre verde 1024x384 / 16 pasos con `r14-sujeto`; con `-i bocetos/depredador-1024.png` a la fuerza ganadora
   de `19b` si el boceto ganó (≈ 15-25 min), si no, txt2img (≈ 30 min).
3. `montar.sh` con `HERO` y `MANADA` de `19c` (segundos) y la armonización ganadora de `19c` a 1280x512 (6-15 min
   con `-i`; 50-100 min si ganó `-r`).
4. Si falla un rasgo (cresta, colmillos): inpainting por partes con `--mask` sobre la zona y `-i` del candidato,
   fuerza 0,6-0,7 (12-23 min por parte, máximo dos partes). Sin evidencia publicada en FLUX.3: la primera vez se mira
   si el resto de la imagen queda intacto.
5. `gradar.sh … atardecer` + `medir.sh`.

**Cuernahoja** (día, desierto de mesas rojas): igual, con `herbivoro.svg`, la vía de armonización ya decidida y
`gradar.sh … dia`; si su entorno de ficha no es la llanura, plancha propia (49 min).

**Aceptación:** los tres sí/no de forma de `19b` en el candidato; la manada se lee como la misma especie; EMD dentro
de `IMG-17`; y la usuaria dice que **iguala el diseño** de `imagenJuego` (proporción, rasgos del canon, luz) o
apunta qué falta. **Coste:** aullador 2,5-3,5 h (5-7 generaciones), cuernahoja 2-3 h (4-6); con `-r` como
armonización, +1 h cada uno. **Bloquea:** `IMG-19`, `IMG-17`, `IMG-18`. **Si falla:** una criatura que tras el
inpainting no cumple la forma se cierra como «falla la forma» con su mejor candidato, y la decisión de LoRA fuera de
la Deck ([lora](investigacion-lora.md#recomendación)) vuelve a la usuaria; el resto del plan sigue.

### IMG-22 · Cardo brújula y Pastos de la Deriva [A] · S

Sin sujeto animal: una pasada txt2img 1280x512 / 16 pasos con su `r14-*-fotorreal.txt` (P9: la planta en su paisaje
a 35 mm, no macro; el lugar por capas suelo → media distancia → horizonte), gradación por momento y medida. Si el
cardo necesita aislar la planta (se come el encuadre o sale genérica), se pasa a planos como `IMG-21` (+1 h).
**Aceptación:** EMD dentro de `IMG-17`, y el sí de la usuaria frente a su `imagenJuego`. **Coste:** 2 generaciones,
~1,8 h (hasta 3 h con planos en el cardo). **Bloquea:** `IMG-16`, `IMG-17`, `19a`. **Si falla:** se repite con otra
semilla una vez (49 min); si sigue, se apunta qué falla del prompt y se cierra con el mejor.

## Fase 3 · La plantilla

### IMG-23 · Perfil `fotorreal` en `generar.sh`, `probar.sh` y `mundo.json`, con docs [A] · M

**Cambios:**
- `image-generator/scripts/generar.sh`: `PERFIL=fotorreal` fija los valores por defecto que ganaron (`MODELO=flux3-image-klein-Q8_0.gguf`,
  `LLM=` Q4 o Q8 según `IMG-20`, `VAE=flux2-vae.safetensors`, 16 pasos, `--backend diffusion=cpu -t 8`, `TOPE=10800`,
  `--scheduler discrete`) sin tocar los perfiles actuales; mando `--boceto <png> <fuerza>` que añade `-i` y
  `strength_as_noise_level=true`; paso final `gradar.sh` por momento (desactivable con `GRADAR=0`).
- `image-generator/scripts/probar.sh`: perfil `fotorreal` de 1280x512; lee `boceto` de la ficha; si la ficha tiene
  `manada` y `region`, corre la cadena de planos (`planos.sh` pasa de banco a `image-generator/scripts/planos.sh`:
  plancha de la región si no existe, sujeto, `montar.sh`, armonización con la vía ganadora); escribe en `registro.tsv`
  y `notas.md` la receta y el EMD.
- `image-generator/estilo/mundo.json`: lo de `IMG-16` ya está; aquí entra solo lo que cambió en Fase 2 (texto de
  `Style/Mood`, encuadre) y `gradacion.json`/LUT se marcan como aceptados.
- Docs: `image-generator/README.md` (o el que describa los perfiles) con la receta, tiempos reales y la regla de
  memoria; `docs/producto/plan-imagenes/guia-visual-mundo.md` con la línea `Style/Mood`; `banco/resultados.md` con la
  tanda r14 cerrada; `roadmap-imagenes.md` con `IMG-15` tachada y estas tareas.
- Tests: `tools/qa/tests/test_generar_perfil.py` (con un `sd-cli` falso que escribe los args: el perfil `fotorreal`
  produce los flags esperados, `--boceto` añade `-i` y `strength_as_noise_level=true`, `GRADAR=0` no llama a
  `gradar.sh`); los de `IMG-16`/`IMG-17` siguen verdes.

**Aceptación:** una sola orden, `bash image-generator/scripts/probar.sh fauna aullador-rojo fotorreal 3 16`, reproduce
el candidato de `IMG-21` (misma receta; el PNG puede diferir por el hilo de la CPU, pero el EMD queda dentro del
umbral); check del proyecto en verde; la usuaria aprueba la receta como plantilla. **Coste:** 1-2 generaciones
(1-2 h de Deck), 3-4 h de agente. **Bloquea:** `IMG-21` (necesita una receta que haya ganado). **Si falla:** si la
reproducción se va del umbral, se compara receta y log con el candidato (semilla, pasos, mandos) hasta cuadrar; no se
cierra con una receta que no reproduce.

## Presupuesto y orden

| Paso | Generaciones | Deck | Agente |
|------|--------------|------|--------|
| Fase 0 (`IMG-16`, `IMG-17`, `IMG-18`) | 0 | ~15 min (ffmpeg, rsvg) | 5-8 h |
| `IMG-19` | ~10 | 2-2,5 h | 1 h |
| `IMG-20` | 1-2 | 1 h | 0,5 h |
| `IMG-21` | 9-13 | 4,5-6,5 h (+2 h si gana `-r`) | 2 h |
| `IMG-22` | 2-3 | 1,8-3 h | 1 h |
| `IMG-23` | 1-2 | 1-2 h | 3-4 h |
| **Total** | **~25-30** | **~11-15 h** (peor caso ~18 h) | ~13-16 h |

Las horas de Deck son de generador en marcha: caben en tandas de noche; mientras tanto no se pasan check ni tests.

**Orden por valor/coste:** Fase 0 primero (gratis y lo desbloquea todo; `IMG-16` antes que `IMG-17` e `IMG-18`, que
pueden ir en paralelo a subagentes baratos) → `19a` (7 min, valida el método de borradores) → `19b` (30 min, decide
el mando de más valor: la forma, que es lo que más falla en r12) → `19c` (cierra la armonización) → `IMG-21`
aullador → cuernahoja → `IMG-22` → `IMG-23`; `IMG-20` (permiso + 7 min) solo si sobra tiempo, tras `IMG-23`. Si la usuaria quiere ver una imagen buena
pronto, el candidato de `19a` (49 min) ya es el aullador txt2img con el prompt nuevo y la gradación: una comparación
honesta con r12 antes de meter planos ni bocetos.

## Descartado por ahora

- **Entrenar un LoRA:** no cabe en la Deck (gfx1033, sin CUDA) y no hay otra GPU ([lora §3](investigacion-lora.md#3-entrenar-un-lora)).
- **LoRAs de la comunidad:** los de FLUX.2 Klein no sirven en FLUX.3 y en sd.cpp la carga está rota hasta el PR #2214,
  sin verificar ([lora §2](investigacion-lora.md#2-un-lora-de-flux2-klein-sirve-en-flux3-klein)).
- **Recompilar sd.cpp:** solo haría falta para LoRAs o fixes sin publicar; el binario `95ff762` ya hace todo lo del plan.
- **IC-Light y LayerDiffuse:** no existen en sd.cpp; su trabajo lo hace la armonización de la decisión 5 ([comunidad §7](investigacion-comunidad.md#7-lo-que-se-descarta-y-por-qué)).
- **Prompting regional / atención por regiones:** no está en sd.cpp; su trabajo lo hacen los planos.
- **Cajas de maquetación en JSON:** sin evidencia de que Klein las lea; el encuadre va en prosa en el caption.
- **Reescritura previa por LLM:** decisión 1; la prosa de la ficha ya es el upsampler y queda guardada.
- **Hires fix, ESRGAN y ADetailer** como palanca de calidad: ya medidos en `IMG-15` sin ganancia ([motor §4](investigacion-motor.md#4-hires-fix-esrgan-adetailer)); ESRGAN queda solo para llegar a los 1983x793 del juego.

## Riesgos y dudas

Lo que la evidencia no apoya o deja sin cubrir de cada decisión. Ninguna se cambia aquí; se prueban en `IMG-19`
y, si fallan, vuelven a la usuaria.

1. **Decisión 3 (boceto a 0,85):** la fuerza es una estimación `[E]` sin fuente comunitaria para FLUX.3 y el único
   dato cercano es img2img con otros modelos; el SVG del depredador se lee lateral. Riesgo real de que el modelo pinte
   «pintura plana» (fuerza baja) o pierda la forma (alta). Se acota con la escalera de `19b` antes de gastar un candidato.
2. **Decisión 3 (inpainting por partes):** `--mask` es una máscara de latente sin modelo de inpainting; nadie lo ha
   publicado sobre FLUX.3 ([control-forma §2.4](investigacion-control-forma.md#24-inpainting-por-partes---mask)). Se
   prueba solo si hace falta y como mucho dos partes.
3. **Decisión 5:** la comunidad (y el hilo #1516) prefiere `-r` a `-i` para rearmonizar, pero en la Deck FLUX.3 con
   `-r` no arrancó por memoria (README G) y cuesta ×1,5-2. Es probable que la comparación la gane `-i` por coste, no
   por calidad; se apunta así.
4. **Decisión 6:** la tarjeta de AtomicChat midió la cuantización del modelo de difusión en una H100, no la del
   codificador; r2 vio el Q8 neutro con klein 4B. La descarga (4,3 GB, +1,8 GB de pico) puede no aportar nada.
5. **Decisión 7:** no hay fuente de que la composición a 4-8 pasos y 640x256 coincida con la de 16 a 1280x512; la
   comunidad avisa de lo contrario, y la proyección de `--preview` para FLUX.3 no está verificada. `19a` lo decide con
   una generación; si no coincide, los borradores de composición cuestan 25 min, no 7, y el presupuesto sube ~1,5 h.
6. **Decisión 1:** BFL dice que FLUX atiende más a lo que va primero, y la línea `Style/Mood` al final es la propia
   recomendación de BFL para Klein, sin medir. El límite de 4096 tokens sale del código de sd.cpp, BFL no publica
   ninguno. 2,5:1 no está en la lista de formatos de BFL (el más cercano, 21:9).
7. **Decisión 2:** los umbrales de EMD se fijaron con dos imágenes; la cadena B dejó la luma en 67. La calibración
   de `IMG-17` sobre más imágenes puede mover los umbrales, y se apunta.
8. **Decisión 4:** las copias de `montar.sh` son la misma silueta escalada y oscurecida: pueden leerse como pegadas;
   se mitiga con volteo y escala por copia en `19c` y, si no basta, la manada por edición. `planos.sh` tal cual está
   hace la fase 2 casi a ruido total (sin `strength_as_noise_level`): se corrige antes de usarlo.
9. **`rsvg-convert` dentro de `host.sh`** (sandbox Flatpak) no se ha comprobado; se hace en `IMG-18`.
10. **Memoria:** FLUX.3 ha corrido con 4,7-6 GB libres de mínimo; sumar el codificador Q8 o `-r` puede tirarlo. Por eso
    la regla de memoria va antes de cada generación y las vías con `-r` se prueban primero en borrador.
11. **Tiempos `[E]`:** todos los costes de este plan son estimaciones sobre los 180 s/paso de r10-r12; la tabla de
    presupuesto se corrige con los tiempos reales de `19a`-`19c` antes de empezar Fase 2.
