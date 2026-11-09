# Receta para llegar a la calidad de los banners de referencia (`IMG-54`)

**Estado (2026-11-09):** hipótesis de trabajo sacada del [estudio por categorías](estudio-categorias.md) (34 reglas,
klein 4B) y de una tanda de Finales con tres motores (múrgol, acantilados, goirnte; una semilla). Contrastada con una
lectura independiente (subagente Fable) que llegó a lo mismo por su lado; donde discrepamos se dice. **Poca evidencia:**
3 elementos y 1 semilla por Final. Cada punto marcado *(sin probar)* es un experimento de la lista final.

## La idea en una línea

La calidad se decide en **P1**: composición, escala, clave de luz y paleta. Las fases siguientes solo cambian una cosa
cada una, y el Final solo añade resolución y textura. Ninguna fase posterior arregla lo que P1 trae mal.

## 1. Cómo escribir el prompt

Las 34 reglas del estudio, resumidas, y lo que los banners tienen y nuestras imágenes no:

1. **Desde el lore, no desde el prompt de la base**: la base cambia el sujeto (lugar → bloques, múrgol → toro,
   goirnte → gólem) y pega el paisaje de la región y la luz de atardecer a todo.
2. **Cada rasgo raro, con el objeto real al que se parece y su forma** («like dreadlocks», «like an old stag's»).
   La forma la decide la analogía, no el adjetivo.
3. **Solo lo que se ve**: ni usos, ni reglas de estilo («pale healed streaks» se pinta), ni «red streaks» (sale sangre).
4. **El color de cada material, con su suciedad.**
5. **Encuadre por tipo**: lugar como paisaje con izquierda/derecha; fauna con el rebaño; personas de muslos o rodillas
   arriba; objeto en su sitio de uso con objetos vecinos.
6. **La luz como exposición, no como posición del sol** (Fable): los banners son contraluz o clave baja (cuerpos
   oscuros, bordes iluminados); los nuestros salen iluminados de frente aunque el prompt diga «the low sun rims the
   wool». Escribir qué queda en sombra y qué está claro. *(sin probar)*
7. **Paleta limitada**: los banners son casi monocromos con un acento; los nuestros, rojo + amarillo + azul + rosa.
   Pedir «a limited, muted palette of X and Y with a single accent of Z» y quitar «rich natural colour». *(sin probar)*
8. **Capas de distancia y escala del entorno**, no solo del sujeto: «the coastline recedes for miles», «the city
   sprawls tiny below». Sin ellas sale un diorama. *(sin probar)*
9. **Nada pequeño en P1**: con cfg 1 y sin negativo, cada sustantivo se pinta grande (el nido de los acantilados, del
   tamaño de una tienda). Lo pequeño se añade en una edición. *(sin probar)*
10. **Tamaños en números, no** (klein 4B no los sigue): la escala, por comparación con lo que hay en la imagen.
11. **P1 corto** (≤150 palabras): sujeto y disposición, capas, luz, paleta.
12. **Palabras que arrastran un estilo**: «orc» trae orcos de videojuego; «a film still of an actor in realistic
    prosthetic makeup» empuja a fotográfico.

## 2. Fases

| Fase | Para qué | Cómo |
|---|---|---|
| **P1** | composición, escala, luz y paleta: el 80 % de la calidad | 2-4 semillas a 480x192; se elige a ojo con la hoja |
| **P2…Pn** | **un cambio cada una**: identidad (cuernos, colmillos), luego detalles pequeños, luego luz si hace falta | el prompt nombra **solo** el cambio |
| **Final** | resolución y textura (pelo, grano de piedra) | el último P aceptado como referencia |

**Lo que se nombra en una edición, se rehace; lo que se protege, se congela entero.** En Gistera, «a young woman's
face, smooth skin» le quitó lo orco a la cara; «keep the same heavy face» conservó también el bigote. Una edición pide
el cambio por su nombre (*remove the moustache*) y no protege la parte donde está.

**El truco de la usuaria para mujeres no femeninas vale en dos pasos**: P1 sin palabras femeninas (sale fuerte), P2
que añade el pecho. El cuerpo sale bien; la cara pide su propia edición o un editor dedicado *(sin probar)*.

**El Final no es una fase de calidad**: hereda exactamente la composición y la luz de P1 en los tres motores. Esperar
de él lo que no hizo P1 es pagar 33 minutos por nada.

### Boceto por capas (idea de la usuaria, 2026-11-09)

Dibujar primero y pintar después, como un dibujante: P1 **solo la criatura** en blanco y negro, P2 el entorno, P3 los
detalles, y al final la pintura. Probado con klein 4B en múrgol y goirnte (variantes `capas` y `lapiz`; hojas
`sueltas-capas-p{1,2,3}-1.png`, `sueltas-capas-pint-1.png` y `sueltas-lapiz-p{1,2}-1.png`):

- **Una cosa por paso funciona**: el entorno entra sin tocar la criatura (rebaño, ciudad con grúas) y una edición
  arregla lo que falta (cuernos y rastas del rebaño). La identidad sale mejor que pidiéndolo todo junto: el goirnte,
  gris y no humano. Cuesta 40 s por paso.
- **El estilo del boceto pasa a la pintura.** «Black ink line drawing… concept artist's layout» lo dibuja como un
  libro de colorear, y la pintura sale de dibujos animados: lana blanca, ojos de juguete, todo de frente.
- **«A realistic graphite pencil study by a wildlife illustrator: accurate animal anatomy…»** da anatomía de animal,
  y **«turn this pencil study into a wildlife photograph»** da una foto en clave baja: la cara en sombra, el borde
  iluminado y las rastas grises. Es el más cercano al banner del múrgol hasta ahora. Le queda algo de figura de
  juguete, y sale de frente donde el banner va a tres cuartos (lo pedía el prompt).
- **Lápiz por capas a tres cuartos** (variante `lapcap`; hojas `sueltas-lapcap-{p1,p2,b,m}-1.png`) es **lo mejor
  hasta ahora** en los dos:
  - goirnte: de espaldas sobre la muralla, la ciudad en llamas abajo, la piel gris y la luz del fuego solo en los
    bordes. Con «a film still… prosthetic makeup» tiene la composición y la clave del banner.
  - múrgol: a contraluz, oscuro contra un cielo rojo, con el rebaño al fondo.
  - Les queda algo de render 3D (rastas como tiras de goma).
- **En una edición a lápiz, «keep X exactly» no basta**: klein redibujó el múrgol pequeño. Funciona «draw only on the
  empty white paper around it… stays the same size, in the same place».
- **Las ediciones de lápiz pierden lo que solo se dice del sujeto**: el rebaño sale sin cuernos aunque el prompt diga
  «the same kind». Repetirlo en el paso a foto arregla («the two small beasts have the same antlers…»).
- Prompts: el prefijo de P1 es «A realistic graphite pencil study on white paper by a wildlife illustrator (o a film
  concept artist): accurate anatomy and true proportions, careful hatching for form and texture, no colour»; el paso a
  foto, «Turn this pencil study into a wildlife photograph taken with a long lens at dusk (o a film still…), keeping
  every shape, pose and position exactly», seguido de la paleta limitada y la luz como exposición (reglas 6 y 7).
- **El Final con FLUX.3 sobre la foto** (hoja `sueltas-lapcap-final-1.png`, ~33 min cada uno) apenas cambia: más
  nitidez, el mismo aire de render y el múrgol algo más claro. El aspecto de render se arregla antes del Final.
- **Lo que dicen las búsquedas en la web y en repositorios** (2026-11-09, sin probar todavía): referencia a tamaño de
  salida (`--ref-image-args`, quizá la causa del sujeto encogido: `fase.py` la limita a 262144 píxeles), la P1 como
  segunda `-r` contra la deriva, cámara y película en el paso a foto («Kodak Portra 400, natural grain»), contraluz
  con palabras concretas, `--mask` para editar solo una zona, y fundir solo lo cambiado sobre el original.
- **Goirnte, correcciones de la usuaria** (variantes `lapcap2`…`lapcap5`; hojas `sueltas-lapcap{2,3,4,5}-p*-1.png`):
  el del banner es mucho más ancho y alto, está **delante** del parapeto (no metido en el muro) y su ciudad es de
  **torres negras cuadradas y simétricas**, no de castillos con agujas. Lo aprendido:
  - «corpulent», «barrel», «built like a bull», «strongman» → **gordo** con barriga. Nombrar el vientre («flat
    stomach») → lo enseña (abdominales de superhéroe). Funciona: «as wide as two men, heavy and solid, all muscle and
    heavy bone under his armour… armour covers his chest, stomach and arms completely, no skin showing below the neck».
  - El muro: «a low stone parapet running behind him at the height of his waist; he is in front of the parapet, his
    whole body visible and nothing of the wall over him».
  - La ciudad: «towers and spires» → gótico; «many storeys, rows of windows» → **rascacielos modernos**. Funciona:
    «an ancient fortress city of forges… massive square towers of huge cut black stone blocks… flat battlemented tops,
    only a few narrow slit windows, no glass… symmetrical rows».
  - La piel (lore: casi mineral y quitinosa, gris, brillo metálico, ojos de obsidiana): con analogías («matte ash-grey
    like slate, fused with plates like a beetle's shell… sheen like pewter… eyes like polished obsidian») salen la
    pizarra y los ojos negros (como agujeros, parece máscara), pero las placas no se leen a 480 px: la cara pide una
    edición propia a más resolución (recorte o `--mask`).
  - «90% of the frame in deep shadow» se pasa: la ciudad desaparece.
- **Orden propuesto**: P1 la criatura a lápiz → P2 el entorno a lápiz → P3 la foto con color y luz → Final. Falta
  probarlo con los acantilados y el resto de categorías.

### Plantilla por capas y plan de estudio (usuaria, 2026-11-09)

**Método, no elemento:** un elemento por categoría, lo mejor posible, y de ahí reglas que valgan para todos. Pasos:

1. **Plantilla** ✅: bloque `capas` de la ficha (`fichas/<tipo>/<slug>.json`) y `scripts/capas.py`, que monta los
   prompts (P1 sujeto a lápiz, P2 entorno a lápiz en el papel vacío, P3 paso a foto; F4 con `--final <motor>`) y con
   `--generar` encadena `fase.py` con una semilla por fase, sin elegir a mano. Campos de forma (`sujeto`, `tamano`,
   `forma`, `viste`, `pose`, `entorno`) sin color; `color`, `paleta`, `luz` y `repetir` solo en la foto. Las
   palabras que ya fallaron (gordo, vientre, agujas, ventanas en filas, sombra al 90 %, tinta, ancla de raza de
   fantasía) paran el script con el motivo y la alternativa. Ejemplo hecho: `raza/goirntes-meseta`.
2. Fichas `capas` de los siete de estudio a mano desde el lore: acantilados-partidos, múrgol macho, cardo-brújula,
   amuleto de hueso, ayuntamiento, Gistera Koh, goirnte macho.
3. Pasada automática de los siete, juzgada contra el banner con una lista fija: rasgos de identidad, tamaño y
   proporción, encuadre, ni dibujo ni render, luz.
4. Se corrige solo la plantilla (reglas generales), como mucho tres rondas; lo que no salga se apunta como límite
   del modelo.
5. Prueba a ciegas con siete elementos no tocados (uno por categoría): porcentaje que sale bien a la primera.
6. Paso al generador y a las pautas de OpenCode (`IMG-50`); con la usuaria, si hace falta una descripción visual
   aparte del lore.

## 3. Motor por fase

| Fase | Motor | Por qué |
|---|---|---|
| P1 y ediciones | **klein 4B** (40 s/paso) | 4 semillas por el precio de un paso de 9B; el estudio muestra que puede si el prompt es bueno |
| Final, escena oscura o a contraluz | **FLUX.3** (~33 min) | el único que respeta la clave baja y no deriva el color: goirnte cb 2.3/cr 2.7/y 31.9 frente a y 61 de klein; múrgol y 12.2 frente a 25 |
| Final, escena clara | **klein 4B** (~3 min) o FLUX.3 | acantilados: klein 4B mejor en luminancia (y 9.2) y ssim; FLUX.3 mejor en croma (cb 3.9) y conserva el suelo rojo. Discrepancia abierta: Fable prefiere klein 4B, a ojo yo FLUX.3 |
| Ediciones que klein rompe (caras) | qwen-edit o longcat (~7 min/paso) | sin datos todavía |

- **klein 9B, fuera** por ahora: no gana a 4B en ninguno de los tres, al doble de tiempo.
- **klein en el Final aclara todo**: lana crema, cielo gris azulado, piel tostada; ignora «keeping its light and its
  colours». Es el patrón más sólido de los números.
- **La medida EMD sirve para la luz** (canal y), no para composición ni escala; el ssim a esta resolución es casi ruido.
  P1 se juzga a ojo con la hoja de contacto.

## Dónde tiene que acabar todo esto (usuaria, 2026-11-09)

Cuando la receta esté clara, lo aprendido se lleva a tres sitios:

1. **El generador de prompts de OpenCode** (`IMG-50`): sus pautas escriben los prompts por fase con estas reglas
   (lápiz por capas, paso a foto, luz como exposición, paleta limitada, encuadre por tipo).
2. **El generador de imágenes**: fases, motor por paso y opciones de sd-cli que salgan de los experimentos.
3. **El lore, si hace falta**: si la descripción de un elemento no basta para un buen prompt, se valora una
   **descripción visual aparte**, solo para generar el prompt (rasgos con su analogía y su color, sin usos ni
   historia). Se decide con la usuaria cuando la receta de prompts esté cerrada; el canon lo cambia solo Álvaro.

## 4. Experimentos siguientes (por valor)

1. **Luz y paleta en P1** (klein 4B, múrgol, 3 variantes × 2 semillas, ~5 min): la luz como exposición, capas de
   neblina, paleta limitada sin «rich natural colour». Decide si la clave baja sale por prompt o es límite del modelo.
2. **Sin atrezo pequeño en P1, y P2 que lo añade** (acantilados, ~3 min). Decide si vuelve la vista panorámica.
3. **Cambiar la luz por edición** (P2 sobre el P1 del múrgol). Si funciona, P1 puede ocuparse solo de la composición.
4. **FLUX.3 en P1 en vez de en el Final** (goirnte y múrgol, 480x192): si da la luz y la escala y klein 4B reescala en
   3 min, el orden actual está al revés.
5. **Cara de Gistera con qwen-edit**, y Final con FLUX.3 a 960x384 frente a 1280x512 (¿basta la mitad de coste?).

Hojas de contacto: `generated/banco/hojas/sueltas-rec3-{murgol,acant,goirnte}-1.png` (banner, P1, Final klein 4B,
klein 9B, FLUX.3) y `sueltas-recgis2-1.png` (Gistera: P1 y tres ediciones).
