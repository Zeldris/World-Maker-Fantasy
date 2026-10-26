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
