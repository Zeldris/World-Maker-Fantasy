# Banco de calidad (`IMG-15`): resultados

Semilla 3, banner 1280×512, en la Deck. Cada ronda es un `rN-*.tsv` de esta carpeta (se lanza con
`bash docs/producto/plan-imagenes/banco.sh <ronda>`); los prompts salen de `prompts.py` a `prompts/`. Las imágenes
quedan en `image-generator/generated/banco/<ronda>-<nombre>/intentos/` (no se suben). Para comparar el detalle fino,
`recorte.sh` apila la misma zona al 100 %. Referencia: los banners de ChatGPT de `backend/uploads/images/`.

Antes de este banco (`calidad.sh`, 2026-10-25): 12 pasos ≈ 6; hires fix, peor; Real-ESRGAN, misma imagen a
5120×2048 (sirve para el tamaño final); `klein-base` con cfg 3,5, 15 min y sobresaturado; **el estilo «cine»
(luz dorada dramática, gradación cálida) es lo que más acerca**.

## Lo que se ve en las referencias de ChatGPT

Luz: sol bajo a contraluz, cielo naranja o carmesí saturado, polvo encendido, borde de luz en el sujeto. Diseño:
rasgos del canon exagerados hasta lo fantástico (cresta de púas rojas, cuernos en hoja), aunque a veces fuera del
canon (su aullador es largo y de patas cortas; el canon dice patas largas).

## r1 · VAE (2026-10-25)

| Prueba | Decodificar | Lectura |
|---|---|---|
| `full_encoder_small_decoder` (hoy) | 22 s | referencia |
| `flux2-vae.safetensors` (completo, Apache 2.0, `unsloth/FLUX.2-VAE`) | 41 s | igual a la vista; al 200 %, pelo y hierba prácticamente iguales (PSNR 29-34 dB) |
| VAE de `black-forest-labs/FLUX.2-klein-4B` (diffusers) | 41 s | idéntico al completo |

**Veredicto:** el VAE no es el cuello de botella; se queda el pequeño.

## r2 · Codificador de texto Qwen3-4B Q8 frente a Q4_K_M

Mismo tiempo (~2,6 min). Cambia algo la composición (manada, cola), sin mejora clara de calidad ni de fidelidad.
**Veredicto:** neutro; se decide con más semillas si hace falta.

## r4 · Z-Image-Turbo Q4_K (Apache 2.0, 6B, 8 pasos)

Arranca en la Deck con las mismas protecciones (mín. libre ~8 GB), **~6 min** por banner. Aullador: la anatomía del
canon mejor que klein (patas largas y finas, colmillos curvos, manada a contraluz entre polvo), pero más blando y
pictórico. Pastos: más neblina y menos detalle; los Cuernahoja salen como caballos. **Veredicto:** prometedor en
fauna; se prueba en Q6_K por si la blandura es de la cuantización.

## r3 · Estilo del prompt (klein, 6 pasos, ~2,6 min)

| Estilo | Qué cambia | Lectura |
|---|---|---|
| `cine` | luz dorada dramática, gradación cálida | referencia (r1) |
| `cine2` | cielo ámbar/carmesí saturado, polvo encendido a contraluz, borde de luz; «hyper-detailed, razor-sharp» | **el más cercano a ChatGPT**: sol con rayos, cielo encendido, más profundidad; en el aullador conserva los colmillos curvos del canon |
| `corto` | `cine` sin la frase «grounded… handmade from wood, hide, bone…» | casi igual que `cine`: esa frase no estorba |
| `arte` | `cine2` como *concept art* / *matte painting* | tan dramático como `cine2`, más pictórico; cresta de púas más marcada, colmillos más cortos; en pastos, los Cuernahoja más vacunos |
| `fantasia` | `cine2` + «criatura de otro mundo, no un animal real» | cresta de púas y aire de criatura, como ChatGPT; colmillos más cortos; el prompt pasa de 300 palabras y se pierde B6 |

Hulki y el cardo con `cine2`: también ganan (contraluz, cielo encendido, profundidad). `cine2` solo toca el preámbulo
de día; la noche y las estaciones (`IMG-14`) siguen igual. En todos, las «motas rojas brillantes» del aullador
salen como gotas: se prueba «polvo mate» en r6.

**Veredicto:** `cine2` es el estilo de partida. `fantasia`, si la usuaria prefiere el diseño exagerado de ChatGPT al
del canon (decisión suya).

## r5 · Z-Image-Turbo Q6_K

Aullador con `cine`: casi la misma imagen que Q4 (r4); al 100 %, algo más nítido el pelo y el ojo. ~7 min (Q4,
~6) y la memoria libre baja a ~4 GB (Q4, ~8). **Veredicto provisional:** la blandura es del modelo, no de la
cuantización. Pastos y `cine2` con Z-Image, pendientes: piden 7,2 GB libres al empezar.

## r6 · Sampler, pasos y polvo mate (klein, `cine2`)

| Prueba | Lectura |
|---|---|
| `dpm++2m`, `res_multistep` | prácticamente iguales a euler |
| `er_sde` (estocástico) | cambia la composición al azar: aullador más oscuro y sin los colmillos curvos; pastos con Cuernahoja más de gacela (canon) y un remolino de polvo rojo |
| euler 9 pasos | igual que 6 y un 40 % más lento |
| polvo mate (`aullador-polvo`) | ya no salen gotas ni gemas sino manchas de tierra apelmazada; con esta semilla, colmillos más cortos |

**Veredicto:** euler y 6 pasos se quedan. El polvo mate, a confirmar con más semillas (r7).

Memoria: klein baja la libre ~2,2 GB y Z-Image ~3,5 GB; con el vigilante de 1500 MB, klein arranca con 5 GB
(`MIN_INICIO_MB=5000`, `LIBRE=5200`).

## r7 · Robustez con las semillas 7 y 11 (klein, `cine2`, euler, 6 pasos)

| Prueba | Lectura |
|---|---|
| aullador `cine2` | colmillos curvos con la 7, cortos con la 11; con las dos, el lomo lleno de gotas rojas |
| aullador `polvo` | sin gotas con las tres semillas: tierra rojiza mate apelmazada; los colmillos, iguales que `cine2` con la misma semilla |
| pastos | misma escena con las dos: Cuernahoja en primer plano, manada lejos, montañas con polvo rojo; con la 11, más de vaca que de gacela |
| hulki | muy estable: manto de hojas, colgante de hueso, plataforma atada; la mejor de la tanda |
| cardo | estable: bulbo plateado, semillas negras en el tallo, polvo al aire |

**Veredicto:** la configuración aguanta con otras semillas. La longitud de los colmillos depende de la semilla, no
del texto: el polvo mate entra en el estilo ganador. Toca generar 2-3 semillas por imagen y elegir.

Z-Image Q6 con `cine2` (aullador): colmillos curvos, manada y luz muy logradas, más pictórico y saturado que
klein; las garras salen como anillas. ~7 min.

Z-Image Q6 en pastos (2026-10-26): con `cine` salen caballos, como Q4; con `cine2`, Cuernahoja con cuernos y polvo
rojo, pero cielo plano, menos contraste y menos nitidez que klein `cine2`, a ~7 min. **Veredicto del banco:** el
perfil ganador es klein Q8 + `cine2` con polvo mate, euler, 6 pasos y VAE pequeño; Z-Image queda como `MODELO=`.

## r8 · El estilo ganador en `mundo.json` (D8)

`cine2` se parte en dos (usuaria, 2026-10-26): el acabado (nitidez, borde de luz, polvo con volumen, color saturado)
va a todo `banner` y al preámbulo de día; el sol bajo con el cielo encendido, solo al de atardecer. La luz de la región
sigue mandando (la de día de las Llanuras ya es un sol bajo). Prompts del estilo `guia` (`prompts.py guia`), más el
aullador de noche. Solo salieron el aullador y pastos: cardo, hulki y el aullador de noche abortaron por memoria (el
narrador de Ollama, 5,2 GB, cargado por el juego). **Leída (2026-10-26):** sin el atardecer forzado el cielo sale azul
y plano; el aullador conserva la anatomía del canon pero parece CGI de catálogo, y pastos queda en postal de safari
de día, más lejos aún de ChatGPT. La separación de D8 arregla la luz, no el aspecto.

## r9 · Aspecto: arte conceptual y `-r` de ChatGPT

Puestas al lado de los banners de ChatGPT del juego, las nuestras no se parecen ni de lejos (usuaria, 2026-10-26):
aullador de documental, pastos de postal de sabana, cardo como un huevo en macro. Los de ChatGPT son arte conceptual,
no fotografía. `concepto`: *concept art* / *matte painting* en todo banner y la flora en su paisaje, sin lente macro.
`ref`: el banner de ChatGPT de Pastos de la Deriva como `-r` y una frase que pide su estilo en otra escena.
Las 6, bien (2026-10-26): `concepto` ~150 s, `ref` ~270 s, con ~9 GB libres como mínimo.

**Leída:** ninguna se acerca. `concepto` apenas cambia frente a `guia`: el mismo acabado liso de CGI, sol de frente y
el sujeto centrado. `ref` es la que más se acerca en paleta (el aullador toma el suelo rojo, el polvo y los tonos de
ChatGPT), pero no en composición ni en detalle; en el cardo trae lomas negras en vez del cañón. El cardo sigue siendo
un bulbo con forma de huevo en las dos (el texto de la ficha lo pide así). Lo que separa a ChatGPT: sujeto bajo y
ancho con mucho paisaje, suelo con textura fina, cielo cubierto y dramático en vez de sol directo, y micro-detalle que
el modelo de 4B no da a este tamaño. Queda `-r` como palanca de paleta (casi el doble de tiempo) y se prueba un
modelo más grande en la CPU (FLUX.3 Klein).

## r10 · FLUX.3 Image Klein en la CPU

`flux3-image-klein-Q8_0` con `Qwen3VL-4B-Instruct-Q4_K_M` y `flux2-vae`, `--backend cpu` (sin el tope de 2 GB de la
GPU, que no le deja arrancar), 1280x512, 16 pasos, cfg 1, semilla 3, el prompt `aullador-guia` de r8
(`generated/banco/r10-flux3-cpu`). Arranca y acaba (2026-10-26): **62 min** (muestreo 3340 s, ~209 s por paso; VAE
en la CPU 376 s), con ~6 GB libres como mínimo.

**Leída, al lado del klein de r8:** el salto de calidad más grande del banco. Pelo, hierba y suelo con textura fina,
la manada con profundidad real, colmillos curvos del canon, cielo con nubes y polvo con volumen; klein, al lado,
parece plástico. Es lo más cerca de ChatGPT en detalle, no en composición (sujeto centrado y sol en el horizonte), y
el aullador sale escuálido y con el rojo del pelo como mojado. Sirve para tandas de noche (unas 8 por noche), no para
probar en el momento. Palancas sin probar: VAE en la GPU (`--backend diffusion=cpu`, ~6 min menos), `-t 8` (hoy 4
hilos) y menos pasos.

Pastos con FLUX.3 (prompt `pastos-guia`, `--backend diffusion=cpu -t 8`: el VAE en la GPU y 8 hilos): **49 min**
(muestreo 2873 s, ~180 s por paso, un 14 % menos que con 4 hilos; VAE 40 s en vez de 376), ~4,7 GB libres como
mínimo. **Leída:** fotografía de estepa creíble, mucho mejor que klein: hierba con textura, arcilla roja, profundidad
por capas y los Cuernahoja del canon (vientre blanco, cuernos hacia atrás). Sigue siendo postal de safari con cielo
azul: lejos del aire ámbar y del primer plano con rocas y sendero de ChatGPT. Eso es lo que prueba `realista` (r11).
`diffusion=cpu -t 8` queda como el modo de FLUX.3.

## r11 · Estilo `realista` con FLUX.3 (pastos y aullador)

Lo común a los banners de ChatGPT como estilo: profundidad por capas, bruma ámbar, paleta ocre y óxido, menos empuje
que `cine2`. **Leída (2026-10-26):** casi la misma imagen que r10 en los dos, algo más cálida y suave y con piedras
delante. Con la misma semilla, FLUX.3 compone desde la descripción de la ficha (que va primero); el párrafo de estilo
del final apenas pesa. Cardo y hulki no se generaron: la cola se paró al cambiar de objetivo.

Además, el Cuernahoja de pastos no se parece al de ChatGPT (usuaria): son diseños distintos, y la usuaria decide
(2026-10-26) que **lo que hay en las imágenes del juego es lo que se quiere igualar**, diseño incluido; lo que falte se
generará después con la plantilla ya afinada, sin referencia. Las fichas se reescriben desde los banners de ChatGPT
(campo `imagenJuego`) y lo que choca con el canon queda en sus `propuestas` para una propuesta de lore.

## r12 · Plantilla `fotorreal`: fichas desde los banners de ChatGPT

Aullador (al atardecer, como el de ChatGPT), Cuernahoja (ficha nueva), Cardo y Pastos con las fichas reescritas, el
estilo `realista` con el encuadre libre (la pose dice dónde va el sujeto) y FLUX.3 en la CPU, sin `-r`. Nombre de la
plantilla: «fotorreal» (lo de ChatGPT es *concept art* fotorrealista, de película, más que fantasía realista).


- **Aullador** (48 min, `r12-fotorreal-aullador-fotorreal/intentos/banner-s3-p16-20261026-153036.png`): el mayor
  salto del banco, ya es el mismo animal. Cabeza de zorro, colmillos de sable, cresta de placas negras con púas rojas,
  cola anillada, tierra roja agrietada, remolinos de polvo, sol bajo y la manada al fondo. La calidad (pelo, placas,
  profundidad) está a la altura. Falta: (1) **proporción**: el de ChatGPT es mucho más largo y bajo, como una
  comadreja de tres cuerpos; aquí es un zorro grande con patas de zorro; (2) la **cresta** de ChatGPT va de la nuca a
  la punta de la cola; aquí cubre solo el lomo; (3) la **manada** son hienas o jabalíes, no la misma especie en
  silueta; (4) el **color**: ChatGPT tiñe todo de rojo anaranjado con contraluz y bruma densa; aquí el cielo es
  naranja pero el suelo y el animal quedan neutros, más limpio y de render. Palancas: «three times as long as a fox»
  y «the crest runs from the nape to the tail tip» en la ficha; «the pack are more of the same creature» en la pose;
  bruma roja y contraluz en la luz del atardecer.
- **Cuernahoja** (49 min, `r12-fotorreal-cuernahoja-fotorreal/intentos/banner-s3-p16-20261026-161849.png`): de
  «no se parece en nada» a reconocible. Cuernos de hoja nervados, pelaje óxido y crema, patas de tres dedos con garra,
  desierto rojo con mesas a los lados, polvo y cielo azul: todo está. Falta: (1) el **cuello**, corto como de vicuña;
  el de ChatGPT es de jirafa, tan largo como las patas; (2) de **frente** y simétrico, casi de dibujo, frente a los
  tres cuartos de ChatGPT; (3) los **cuernos** salen curvados como de carnero; en ChatGPT son dos hojas planas hacia
  los lados; (4) la **manada** son ciervos sin cuernos de hoja: el mismo fallo que la manada del aullador. Ficha
  retocada: ancla «a slim giraffe with the head of a small deer», cuello «giraffe-long», cuernos «stick straight out
  sideways», pose en tres cuartos y «more of the same leaf-horned grazers». **Lección común**: el modelo no repite la
  especie en el fondo; la cadena de planos lo resuelve copiando el sujeto (r13).
- **Cardo y Pastos**: sin hacer. La usuaria paró la ronda (2026-10-26, 17:20) para afinar antes con las
  investigaciones ([técnicas de diseño](../investigacion-tecnicas-diseno.md), motor, LoRA y prompts de criaturas).

## r14 · Plantilla `fotorreal` de `IMG-16` en borrador y a tamaño final (`IMG-19a`, 2026-10-26)

Ronda `r14-borradores.tsv`, semilla 3, FLUX.3 Q8 en la CPU, prompt `r14-aullador-fotorreal.txt` (356 palabras).

- **Borrador 640x256 / 8 pasos** (9 min: 524 s de muestreo; mínimo libre 4,9 GB): misma composición que la de
  16 pasos. Aullador en el centro mirando a la derecha, cola a la izquierda, sol bajo a la derecha, horizonte a ~45 %,
  manada a los dos lados. **El borrador vale como anticipo de la composición** (aceptación de `19a`).
- **`--preview proj`**: escribe un PNG de 80x32 por paso; desde el paso 2 (~2 min) se leen el sujeto, la cola, la
  manada y el sol. Sirve para abortar pronto un borrador mal compuesto; no para juzgar detalle.
- **1280x512 / 16 pasos** (49,5 min; mínimo libre 5,1 GB), `r14-borradores-aullador-1280/intentos/banner-s3-p16-20261026-183902.png`,
  candidato txt2img de referencia de Fase 2. Frente a r12 arregla dos de los cuatro fallos: la **manada ya es la misma
  especie** (crestas rojas, colmillos) y la **cresta llega a la punta de la cola**. Sigue: la **proporción** (más
  largo que un zorro, pero no tres cuerpos) y la cabeza de **perfil**, no de tres cuartos; los dos los ataca el boceto
  (`19b`).
- **Medida** (`medir.sh fauna atardecer`, mediana frente a los 5 GPT): sin gradar Y 24,1 · Cb 6,2 · Cr 5,1, YAVG 97,9
  (algo por encima de la ventana 70-95); gradada con la LUT de atardecer Y 19,5 · Cb 5,8 · Cr 7,0, YAVG 84,9,
  SATAVG 28,4: dentro de la aceptación.
- De paso: `medir/stats.sh` daba STATS vacío con los PNG de sd-cli (el ffmpeg 8.1 de la Deck vuelca el tEXt largo del
  prompt con bytes nulos y grep lo tomaba por binario); arreglado con `grep -a` y test.

## r14 · Escalera de fuerza del boceto (`IMG-19b`, 2026-10-26)

Ronda `r14-boceto.tsv`, 640x256 / 8 pasos, semilla 3, `-i bocetos/<boceto>-640.png --extra-sample-args
strength_as_noise_level=true`; rejillas en `generated/banco/r14-boceto-*-rejilla*.png`. Con `-i` el muestreo se acorta:
2,5 min a 0,75, 3,5 a 0,85, 4,5 a 0,92 y 6,5 a 0,97 (frente a 9 del txt2img).

| Prueba | Fuerza | Cuerpo ≥ 3× | Cresta nuca → cola | Tres cuartos | Nota |
|---|---|---|---|---|---|
| depredador | 0,75 | sí | sí | no | copia el SVG: dibujo plano, nada fotográfico |
| depredador | 0,85 | sí | sí | no | igual de plano |
| depredador | 0,92 | sí | sí | no | plano con algo de textura y patas duplicadas |
| depredador | **0,97** | **sí** (~4×) | **sí** | no | **fotorreal**: pelo, placas, polvo y manada de la misma especie; mira a la izquierda como el boceto |
| depredador, boceto blando (gblur 4 + grano) | 0,92 | sí | sí | no | el grano se queda en la imagen: descartado |
| herbívoro | **0,97** | – | – | casi | fotorreal, cuello largo, manada igual entre mesas; los cuernos salen como cuatro hojas finas |
| herbívoro | 0,95 | – | – | no | clava los dos cuernos-hoja planos y las patas de ave, pero el suelo plano del boceto se cuela como franja lisa |

- **El boceto sirve como mando a 0,95-0,97** (no a 0,85 como estimaba la investigación: por debajo de ~0,95 FLUX.3
  copia el relleno plano). Fuerza de partida: **0,97**; 0,95 cuando un rasgo del boceto (los cuernos) pesa más que el
  fondo.
- **Tres cuartos: no**, en ninguna fuerza, porque los dos bocetos dibujan la cabeza de perfil; el modelo sigue al
  boceto. Para el tres cuartos hay que redibujar la cabeza en el SVG (decisión de la usuaria: los bocetos ya tienen
  su sí).

## r14 · Planos en pequeño y armonización (`IMG-19c`, 2026-10-26)

`RONDA=r14 planos.sh 1|2|3`, 640x256 / 8 pasos, semilla 3; imágenes en `generated/banco/r14-planos/intentos/` y
rejilla (montaje, `-i` 0,5, `-i` 0,7, `-r`) en `generated/banco/r14-planos/rejilla-armonias.png`.

- **Plancha** `r14-plancha` (412 s) y **sujeto** `r14-sujeto` sobre `bocetos/depredador-verde-512.png` a 0,97 (254 s):
  el sujeto sale fotorreal, con colmillos de sable, cresta de la nuca a la punta y cuerpo ~4×; cabeza de perfil, como
  el boceto.
- **El verde no sale croma**: FLUX.3 pinta un verde de estudio apagado y en degradado (#4f7b3c → #83a454), y el
  `chromakey` de `montar.sh` por el color de la esquina se llevaba también el pelaje oscuro (caja 103x50, montaje sin
  animal). `montar.sh` recorta ahora por **dominancia del verde** (fondo si el verde pasa en más de `UMBRAL`=12 al rojo
  y al azul, apertura de 1 px): caja 428x159, el animal entero. Sirve igual con el verde croma puro de r13.
- **Montaje** (`HERO=50:246:520`, tres copias con volteo y escala): composición limpia, la manada se lee como la misma
  especie. Sin armonizar ya da mediana Cb 5,2 · Cr 7,6, pero se nota pegado (borde nítido, sin luz de contorno).

| Armonización | Tiempo | EMD Y · Cb · Cr | Mediana Cb · Cr | SATAVG | SSIM con el montaje | A ojo |
|---|---|---|---|---|---|---|
| **`-i` 0,5** | **72 s** | **13,7 · 2,4 · 2,2** | 6,6 · 5,7 | 28,4 | 0,73 | **gana**: integra la luz cálida y el polvo; silueta, cresta y colmillos intactos; la manada se queda |
| `-i` 0,7 | 121 s | 16,1 · 3,7 · 1,2 | 5,3 · 6,3 | 30,0 | 0,66 | más integrado (la copia de la derecha pasa a dos animales); cresta algo menor y pelaje más amarillo |
| `-r` (ref) | 638 s | 13,0 · 13,7 · 20,3 | 16,7 · 23,1 | 10,5 | 0,88 | **arranca en la Deck** (mínimo libre 4,4 GB) y conserva el montaje, pero vira a un crepúsculo azul desaturado: fuera de la gradación |

- **Decisión 5 cerrada por `-i` a 0,5** (menor EMD sin perder la silueta, y la más barata); 0,7 queda de recurso si el
  montaje a 1280 se nota pegado. `-r` cuesta ×9 y estropea el color: descartada para armonizar.
- **Coste real de la cadena en borrador**: ~25 min (plancha 7 + sujeto 4 + armonía 1-2), frente a los 35-50 estimados.

## r14 · Sujetos v2/v3 cotejados con GPT (`IMG-21`, 2026-10-27)

`r14-sujetos.tsv` (512x192, 8 pasos, semilla 3; boceto a 0,97 el depredador y 0,95 el herbívoro). Rejillas junto al
banner en `generated/banco/r14-sujetos-rejilla.png`, `r14-sujetos-rejilla-v3.png`, `r14-bocetos-v2.png` y
`r14-pies.png`.

- **Bocetos v2**: cabeza a tres cuartos (dos ojos, dos orejas) con el cuerpo de perfil, como los dos banners; el
  prompt solo no la gira si el boceto la dibuja de perfil (el boceto manda).
- **Cuernahoja**: cuernos color hueso con vetas («bone grey… veined»), de ~½ de la altura del animal, a 0,95; a 0,97
  pierden el color. Los pies de ave grandes no se pueden juzgar a 512 px.
- **Aullador v3**: la cresta estrecha y continua («no wider than a hand… unbroken from the nape») iguala al banner; el
  torso sigue más grueso que la «cinta» del banner pese a «long, slim».
- El candidato a 1280 se paró: la usuaria reorienta el plan a pautas en borrador ([`pautas.md`](../pautas.md)).

## r15 · Ocho planes corporales con prompts de un agente (`IMG-21`, 2026-10-27)

`r15-sujetos.tsv`: un agente barato escribió los 8 prompts solo con [`pautas.md`](../pautas.md) v1 y el banner delante
(sin boceto; 512x192, 8 pasos, semilla 3; ~375 s cada uno, memoria libre mínima 2,8 GB). Rejilla junto al banner en
`generated/banco/r15-sujetos-<especie>/rejilla.png`; la lista de forma de cada especie, en
[`r15-forma.md`](r15-forma.md). Nota de forma: sí = 1, parcial = ½, no = 0, sobre 7.

| Especie | Plan | Ancla | Forma | Se lee como | Lo que falla |
|---|---|---|---|---|---|
| corretolvas | ave corredora | correcaminos | 6,5/7 | el banner | cresta más baja y echada atrás |
| guchapo | anfibio redondo | rana toro | 5/7 | el ancla | rana gorda, no la masa del banner; lengua de una punta (se pidieron tres); sin venas rosas |
| nuente | cuadrúpedo con ala | lechuza + lamprea (de partes) | 5/7 | a medias | cara de lechuza tierna, no máscara de piedra; ala de polilla sin dedos; pelaje a rayas, no a mechones |
| cruzavientos | ave en vuelo | águila real + placas de pangolín | 5/7 | otro animal | sale un águila calva: placas blancas como plumas; cuerpo de plumas, no escamado; vuela de frente, no a la izquierda |
| morvasa | serpiente | anaconda + cobra | 4,5/7 | a medias | la S alta no cabe en 512x192; sin cresta de púas ni cola en cuerno; venas en una raya |
| espina-del-viento | artrópodo | escorpión + «como una cochinilla» | 4,5/7 | otro animal | el cuerpo entero sale cochinilla; ~10 placas (se pidieron 7); dos ojos (se pidieron cuatro) |
| jusha-esmeralda | pez | black bass | 4,5/7 | el ancla | un black bass tal cual: ni hocico romo ni dientes planos ni brillo azul |
| gargantua-de-ceniza | cuadrúpedo acorazado | rinoceronte + caparazón de armadillo | 3,5/7 | el ancla | rinoceronte con losas planas encima, como un disfraz; sin púas ni placas en la cabeza; cola de rinoceronte |

- **El ancla gana a su diferencia** (F6 se queda corta): «only thicker» o «only with a heavier head» casi no cambian
  la silueta. Acierta cuando el ancla ya es la silueta del banner (correcaminos) y falla cuando la diferencia es lo que
  define al animal (bass, rinoceronte, rana).
- **El ancla de una parte contagia al todo**: «como una cochinilla» para las placas hace cochinilla el cuerpo entero;
  placas blancas en la cabeza de un águila la vuelven águila calva.
- **Un material comparado con un objeto se pinta como objeto encima** («plated like the shell of an armadillo» → losas).
- **Las cuentas no se cumplen**: 7 placas, 4 ojos, lengua en 3 puntas: ninguna de las tres.
- **La pose de P1 solo vale para cuadrúpedos**: en el ave corredora y el pez el banner pone la cabeza de perfil; en el
  nuente los dos ojos de frente sí salen. La dirección pedida en vuelo no se respeta.
- **Las formas altas se aplastan** a 512x192 (la S de la serpiente); las alas abiertas de frente sí caben.
- **Criaturas verdes y fondo verde**: el recorte por dominancia (P4) agujerea el pez y el cuello de la serpiente
  (`generated/banco/r15-recorte-verdes.png`).
- **La nota por puntos es generosa**: el cruzavientos saca 5/7 y se lee como otro animal. La columna «se lee como»
  (el banner, el ancla, otro animal) es la que separa lo que vale.
- **Canon frente a banner**: el agente siguió el banner en cinco especies y lo dejó dicho; es la regla que se adopta.

## r16 · Los remedios de r15 en las seis que fallaron (`IMG-21`, 2026-10-27)

`r16-sujetos.tsv`: un agente barato reescribió los 6 prompts con [`pautas.md`](../pautas.md) v2 (F6b-F9, P6-P8) y el
banner delante; el razonamiento de cada uno, en [`r16-forma.md`](r16-forma.md). Misma semilla (3) y pasos que r15;
512x192, salvo morvasa a 384x320 (P7); jusha sobre magenta y morvasa sobre azul (P6). ~375 s cada uno, memoria libre
mínima 3,2 GB. Rejilla r16 / r15 / banner en `generated/banco/r16-sujetos-<especie>/rejilla.png`.

| Especie | Remedio | Forma | Se lee como | Lo que pasa |
|---|---|---|---|---|
| gargantua-de-ceniza | sin ancla; placas que crecen de la piel (F8) | 4,5/7 | a medias | ya no es un rinoceronte: bestia acorazada con púas y placa en la cabeza; las placas siguen siendo losas encima, no el blindaje nudoso del banner |
| morvasa | cobra real; lienzo alto (P7); fondo azul | 5/7 | el ancla | la S se alza entera y las venas magenta sobreviven al recorte; cuerpo en un lazo plano, no la pila alta del banner, y la cola en el suelo |
| cruzavientos | otra ancla (harpía); placas de hueso (F7) | 5/7 | el ancla | harpía con cresta de púas de marfil: el ancla trae su cresta de plumas; el cuerpo, escamado a medias; el banner tiene la cabeza gris oscura y el prompt pidió marfil |
| guchapo | sin ancla; «half-sphere» | 5/7 | el ancla | sigue siendo un sapo de cabeza alzada: los ojos saltones y la lengua bastan para llamarlo; la lengua sale en dos puntas |
| espina-del-viento | sin cochinilla; bandas descritas (F7) | 4,5/7 | otro animal | sigue saliendo cochinilla: «broad, overlapping bands… rounded shield» es la forma de la cochinilla dicha con otras palabras; cuernos de marfil, rojizos en el banner |
| jusha-esmeralda | otra ancla (mero); fondo magenta | 4,5/7 | otro animal | un black bass casi idéntico al de r15 sin nombrarlo: «freshwater fish, deep body» y «3 veces más largo que alto» (copiado de r15; el banner mide ~4,5) lo llaman |

- **Quitar el ancla funciona si lo que queda no es la firma de otro animal**: el gargantúa deja de ser rinoceronte
  con un plan corporal genérico («barrel-shaped body, pillar-like legs»); el guchapo sigue siendo sapo porque ojos
  saltones y lengua son la firma del sapo, y el pez de río hondo es el black bass por defecto.
- **Otra ancla trae sus propios rasgos**: la harpía quita el águila calva y pone su cresta.
- **Describir la parte con la forma del animal que contaminaba lo vuelve a traer**: las bandas anchas solapadas con
  escudo redondo son una cochinilla aunque no se nombre.
- **Los colores y los números salieron del texto o de la ronda anterior, no del banner**: marfil donde el banner es
  gris oscuro o rojizo; la proporción del pez, copiada de r15. Es lo que más aleja tres de los seis.
- **Con la misma semilla, la composición casi no se mueve**: jusha, guchapo y espina repiten encuadre y pose de r15;
  solo cambia cuando cambia la clase del sujeto (gargantúa, que además camina hacia el otro lado sin pedirlo: P8).
- **P6 y P7 funcionan**: magenta y azul recortan sin agujeros (`generated/banco/r16-recorte-magenta-azul.png`, con el
  filtro de `montar.sh`); el lienzo alto alza la S.
- **Se lee como el banner: ninguna de seis** (gargantúa, a medias). Por prompt solo, las formas raras tocan techo con
  esta guía; lo que queda es medir en el banner (F10) y, donde la silueta no sale, el boceto (F5, `IMG-24`).

## r17 · F10 (medir en el banner) y dos semillas en las seis de r16 (`IMG-21`, 2026-10-27)

`r17-sujetos.tsv`: un agente barato reescribió los 6 prompts con [`pautas.md`](../pautas.md) v3 (F6c, F7b, F10) y el
banner medido en píxeles y en medias de color con ffmpeg; el razonamiento y las medidas, en [`r17-forma.md`](r17-forma.md).
Semillas 3 y 7 (R1), 8 pasos, 512x192 salvo morvasa 384x320; fondos como en r16. 375-423 s cada una (sampling ~360 s,
`--backend diffusion=cpu -t 8`), memoria libre mínima 2,8 GB; las doce, ~80 min. Rejilla r17 s3 / r17 s7 / r16 / banner en
`generated/banco/r17-sujetos-<especie>/rejilla.png`.

| Especie | Qué cambió el prompt | Se lee como | Frente a r16 | Lo que pasa |
|---|---|---|---|---|
| guchapo | vista frontal del banner (no la pose de la tabla); 2,1 de ancho/alto; bolsa de garganta | **su banner** (las dos semillas) | mejora clara | sapo de frente, aplanado, lengua partida en puntas y bolsa pálida; los ojos salen demasiado grandes |
| morvasa | sin ancla; pila de tres lazos del grosor del cuello; bulbo con cuerno; aletas de hoja | **su banner** (s7 más) | mejora clara | cuerpo enroscado en pila, cresta tras la cabeza, venas rosas, cola con bulbo y gancho; s7 apila los lazos, s3 los tiende |
| espina-del-viento | 4 largo/alto; surcos en vez de bandas; colores medidos (granate, óxido, cuerno rojo y marfil) | **su banner** en silueta | sale de la cochinilla | escorpión: pinzas largas y finas, cuerpo segmentado y estrecho, cola en arco; el aguijón es un bulbo rojo sin pinza, y el acabado es de juguete (plástico, sin textura) |
| jusha-esmeralda | sin ancla ni «freshwater, deep body»; 4 veces; banda azul; cabeza larga y roma | a medias | mejora | más alargado, dorsal espinosa, dientes y banda azul; la silueta sigue siendo de perca (cabeza corta, cuerpo alto) |
| gargantua-de-ceniza | losas de canto en cresta; flancos acanalados; colores crema y gris | el ancla de r16 | **igual** (2.ª ronda) | la misma bestia acorazada de r16 con las losas lisas como baldosas; ni la cresta de canto ni la roca nudosa del banner; con s3 repite el encuadre de r16 |
| cruzavientos | envergadura 3,5; cabeza 2/3 del torso; hueso gris en vez de marfil; cuerpo umbra | el ancla de r16 | **igual** (2.ª ronda) | águila con cresta pálida en las dos semillas; la cabeza oscura acorazada del banner no aparece, y las medidas no cambian la silueta del ancla |

- **F10 funciona cuando la medida cambia la clase o la vista**: el guchapo sale al pedir la vista del banner (frontal)
  y no la de la tabla de pose; la morvasa, al describir la pila con grosores medidos; la espina, al sustituir la forma
  de la cochinilla por lo que mide el banner (estrecho, en cuña, surcos). Tres de seis se leen como su banner (r16: cero).
- **F10 no mueve una silueta que ya es la del ancla**: gargantúa y cruzavientos repiten r16 con otras cifras y otros
  colores; con la misma semilla, hasta el encuadre. Dos rondas sin mejora: los dos salen del banco por prompt y pasan al
  boceto por plan corporal (`IMG-24`, R2). Es la señal de que en estas dos la forma es trabajo del boceto, no del texto.
- **Dos semillas sí enseñan algo**: en morvasa la s7 apila y la s3 tiende; en el resto las dos semillas coinciden en la
  clase, así que el veredicto no depende de la semilla (R1 ✅).
- **El color medido con la luz descontada acierta** (espina, morvasa, guchapo): sin «marfil», sin el naranja del
  atardecer; entra como F10b. **La vista del banner manda sobre la tabla de pose** cuando no es de perfil: F10c.
- **Lo que queda en las tres que se leen como su banner es acabado, no forma**: ojos grandes del guchapo, el aguijón de
  la espina y su acabado plástico. Eso no es trabajo del banco (R3): queda para la interfaz (`IMG-25`) o la receta final.
- **Las diez dificultades de [`r17-forma.md`](r17-forma.md)**: 1 y 2 entran como F10b y F10c; 3 (qué denominador),
  4 (qué cifras distingue el modelo), 5 (cuándo parecer el animal por defecto vale), 7 (contar hasta 3-4) y 9 (dos
  materiales en una pieza) van a «Abierto» de `pautas.md`; 6, 8 y 10 ya estaban.
- **Siguiente (R2): r18 solo con jusha** (mejora, pero no llega), y espina si se quiere afinar el aguijón; con cuatro
  de seis se cierra `IMG-21` (R3). Gargantúa y cruzavientos esperan a `IMG-24`.

## r18 · Solo jusha, con ancla de cabeza roma y perfil de profundidad (`IMG-21`, 2026-10-27)

Primera ronda con R2: una sola especie, la única de r17 que mejoraba sin llegar. `r18-sujetos.tsv`: un agente barato
reescribió el prompt con [`pautas.md`](../pautas.md) v4 y el banner medido ([`r18-forma.md`](r18-forma.md)): cabeza tan
honda como el cuerpo y en una sola línea hasta el hocico (F10), ancla bowfin por la cabeza roma (F6b/F6c: lucio,
barracuda y gar traen hocico puntiagudo), huso con pedúnculo a un tercio de la profundidad, dorsal espinosa en la mitad
del lomo, colores de r17 (la media del banner, a luminancia ~20/255, no distingue verde de azul: F10b no llega ahí).
Semillas 3 y 7, 374-375 s cada una, memoria libre mínima 3,4 GB (con el narrador de Ollama descargado). Rejilla
r18 s3 / r18 s7 / r17 s7 / banner en `generated/banco/r18-sujetos-jusha-esmeralda/rejilla.png`.

| Semilla | Se lee como | Frente a r17 | Lo que pasa |
|---|---|---|---|
| 3 | **su banner** | mejora clara | huso con cabeza larga y roma que baja en una línea al hocico, dientes, banda azul, dorsal de púas altas en la mitad del lomo, pedúnculo estrecho; más esbelto que el banner, que es más macizo y rugoso |
| 7 | a medias | mejora de silueta | el mismo huso y la misma cabeza, pero la dorsal sale blanda y corta, al final del lomo (la del bowfin, que `r18-forma.md` ya daba como riesgo): un salmón con dientes |

- **La cabeza se movió por la medida y el ancla a la vez**: «as deep as the body, one smooth line to the snout» más
  el bowfin quitan la perca en las dos semillas. Con una sola ronda no se sabe cuál de las dos lo hizo (dificultad 4 de
  `r18-forma.md`); no hace falta saberlo para la pauta: F6b + F10 juntas.
- **El ancla deja su firma en una de dos semillas** (R1 sirvió para verlo): la dorsal larga y blanda del bowfin sale
  en la s7 aunque el prompt mida la dorsal espinosa. Un ancla con un rasgo que la referencia no tiene es una apuesta
  por semilla; entra como nota en F6c.
- **Cuatro de seis se leen como su banner** (guchapo, morvasa, espina, jusha): se cierra `IMG-21` (R3). Lo que
  queda no es del banco: gargantúa y cruzavientos, al boceto por plan corporal (`IMG-24`); el acabado de las cuatro
  (ojos, aguijón, plástico, masa del pez), a la interfaz (`IMG-25`) y a la receta final.
