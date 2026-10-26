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

