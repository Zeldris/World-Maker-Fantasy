# Investigación: cómo trabaja un diseñador de concept art fotorreal y qué traducir al generador

Fecha: 2026-10-26. Rama `claude/plan-imagenes`. Encargo: sacar prácticas del flujo de ilustradores y *matte painters*
aplicables a `sd-cli` + FLUX.3 Klein Q8 en la Deck (IMG-15). Se cita solo lo que se leyó en la fuente; lo que no se
encontró en fuente primaria se marca **[sin fuente primaria]**. Las cifras de coste y de `--strength` son hipótesis de
trabajo a probar, no resultados.

## 1. Resumen

- Los diseñadores no pintan «la escena con la criatura» de una vez: resuelven **primero composición y valores en
  pequeño** (miniaturas, estudio tonal), **después** forman, luz y color por planos, y **al final** unifican con una
  gradación común. El orden es la práctica, no un truco.
- Nuestro síntoma (fondo bueno solo, fondo peor con criatura) cuadra con que hoy una sola pasada reparte la atención
  del modelo entre sujeto y paisaje; FLUX da prioridad a lo que va primero en el prompt (guía de BFL) y la ficha pone
  el sujeto primero.
- La traducción más barata es **separar capas**: una plancha de fondo (reutilizable por región y hora), un sujeto
  aislado, el montaje con ffmpeg (sombra de contacto, bruma, bordes, grano, gradación: 0 pasadas) y, como mucho, una
  pasada corta de armonización por img2img.
- Las 6 prácticas que más prometen: plancha de fondo sin sujeto y reutilizable; sujeto aislado sobre croma; miniaturas
  baratas para elegir composición; montaje con sombra de contacto, bruma y bordes en ffmpeg; gradación final común;
  armonización con `--strength` bajo (a probar).
- Lagunas: no se halló fuente primaria citable de Mullins, Feng Zhu ni Jurabaev sobre estos pasos concretos, ni del
  grano como práctica; la parte de bordes y punto focal se apoya en Gurney (algo indirecto).

## 2. El flujo del diseñador por fases, con citas

**Fase 1: miniaturas y estudio de valores (escala de grises).**
- Dylan Cole recomienda practicar estudios de valor en gris antes del color, para «composición y diseño básico», y
  avisa de que resolver diseño y color a la vez es difícil (CG Channel, entrevista a Cole, 2013, resumen de la
  sesión de Gnomon: <https://www.cgchannel.com/?p=57646>).
- Gurney resuelve el diseño tonal en dos o tres valores como paso aparte antes del color; en *Dinotopia* hace una
  miniatura a lápiz «antes de conseguir modelos y fotografiar referencia» y tarda una semana en total
  (<http://gurneyjourney.blogspot.com/2013/02/dinotopia-painting-step-by-step.html>; <http://gurneyjourney.blogspot.com/2011/03/value-planning.html>,
  esta última solo vista en el listado de búsqueda).
- Feng Zhu (Gnomon): decenas de miniaturas y siluetas, luego crítica y elección de la mejor antes de refinar
  (descripción del catálogo de Gnomon en <https://www.awn.com/news/gnomon-workshop-releases-seven-new-training-dvds>;
  es nota de prensa, no la lección). **[sin fuente primaria del propio Zhu]**

**Fase 2: masas de valor y punto focal.**
- Gurney, «Linking Darks»: unir las pequeñas sombras en unidades grandes simplifica la organización de valores; las
  oscuras forman una masa que enmarca las luces, y concentrar la luz en una zona «lleva la atención» a la cara
  (<http://gurneyjourney.blogspot.com/2013/12/linking-darks.html>). Lo llama *shapewelding*, *notan* o *massing*.
- Cole: «pozas de luz» (Bierstadt, Church) para guiar el ojo por el cuadro (misma entrevista de CG Channel).
- Gurney (sombra en primer plano): una sombra proyectada en primer plano «invita al espectador a pasar de la sombra
  moteada del primer término a la zona iluminada del plano medio» y describe los cambios de plano del suelo
  (<http://gurneyjourney.blogspot.com/2014/11/cast-shadow-in-foreground.html>).

**Fase 3: fondo, medio y primer plano, perspectiva atmosférica.**
- Gurney: con la distancia lo oscuro se aclara y enfría («the dark colors in the extreme distance are lightened and
  cooled»); su hipótesis: «un escalón más claro cada dos millas», quizá geométrica y no lineal; la saturación es una
  pista de profundidad, con la excepción de fuentes como el sol poniente, que se saturan con la distancia
  (<https://gurneyjourney.blogspot.com/2013/07/atmospheric-distance-and-value.html>). Hay casos de «perspectiva
  atmosférica inversa» con la escena más cálida al fondo
  (<https://gurneyjourney.blogspot.com/2007/09/reverse-atmospheric-perspective.html>): relevante, porque nuestros
  banners de ChatGPT son de contraluz cálido.
- Nota de curso de matte painting (no es un artista famoso, es una guía didáctica; la usamos como indicio): la bruma
  crece con la distancia, los colores tienden al color del cielo ambiente y el contraste y el detalle bajan
  (resultado de búsqueda sobre guías de *matte painting*, p. ej. <https://www.therookies.co/blog/matte-painting-tips-for-camera-mapping-3d-projection-and-element-integration-with-nuke/>;
  esa página, leída entera, solo trata color, calidez y curvas, no la bruma por distancia). **[bruma-con-distancia
  como regla de matte painting: sin cita primaria más allá de Gurney]**

**Fase 4: luz y sombra del sujeto (clave, contraluz, luz de borde, sombra de contacto).**
- Gurney, maquetas: una luz de borde fuerte más una frontal débil, comprobadas con los reflejos del ojo
  (<http://gurneyjourney.blogspot.com/2012/01/really-rough-maquettes.html>); la sombra no es negra: la rellenan luces
  débiles y, en exteriores, el azul del cielo tiñe los planos en sombra
  (<http://gurneyjourney.blogspot.com/2010/02/light-and-form-part-2.html>); la luz dura da sombras proyectadas
  nítidas y la difusa, sin borde definido (<http://gurneyjourney.blogspot.com/2013/09/hard-and-soft-light.html>).
  Estas tres citas vienen de fragmentos de búsqueda, no de la lectura completa.
- «Sombra de contacto» como término: no encontré una fuente primaria que lo desarrolle; es práctica común de
  composición. **[sin fuente primaria]**

**Fase 5: integración del sujeto (luz, color, nitidez, grano) y *photobashing*.**
- Flujo de integración de un elemento en un plano (Rookies, Etienne Vittani): primero la herramienta de igualar color
  «que puede bastar para integrar el elemento»; luego una capa cálida de opacidad muy baja (~5 %) para dar calidez
  general «sin cambiar los colores originales de cada elemento»; al final una curva de contraste para «un aspecto más
  cinematográfico» (<https://www.therookies.co/blog/matte-painting-tips-for-camera-mapping-3d-projection-and-element-integration-with-nuke/>).
  No habla de grano.
- Igualar grano, nitidez y espacio de color entre lo pintado y lo fotografiado: aparece en guías de matte painting
  vistas solo en resultados de búsqueda; **[sin fuente primaria leída]**. Gnomon lista cursos de *photobashing* (Ryan
  Hawkins, «Photo Collage Prototyping»: quitar ruido y distorsión de lente e igualar luz;
  <https://www.cgchannel.com/?p=65028>, solo el titular del curso).

**Fase 6: control de bordes y gradación final.**
- Bordes: Zhaoming Wu, citado por Gurney, quiere «un carácter de bordes perdidos y encontrados para mostrar atmósfera y
  profundidad» y va «suavizando y definiendo bordes de principio a fin»
  (<https://gurneyjourney.blogspot.com/2013/04/zhaoming-wu-demo.html>; nota: la cita es de Wu, a través de Gurney).
- Gradación común: ver Rookies arriba (calidez por capa de baja opacidad + curva). Que un velo de color común unifique
  (glaseado) lo dicen guías de pintura tradicional en resultados de búsqueda, con la advertencia de que un exceso
  vuelve el cuadro «cohesivo y sin vida» (no es fuente primaria de concept art). **[sin fuente primaria]**

## 3. Prácticas aplicables

Convenciones: «pasada» = una ejecución de `sd-cli`. Referencia de coste: banner 1280x512 a 16 pasos ≈ 49 min. El coste
del muestreo es aproximadamente proporcional a píxeles x pasos (por confirmar con una medida); img2img con
`--strength` s corre ≈ s x pasos.

| # | Qué hace el diseñador | Traducción al generador | Coste | Prio. |
|---|---|---|---|---|
| 1 | Pinta el fondo como plano propio, sin el personaje (fase 3). | Ficha de «plancha»: solo `lugar`, `entorno`, `luz`, sin `sujeto`; pedir en `entorno` «espacio libre en el tercio izquierdo/derecho, sendero». txt2img 1280x512. | 1 pasada (49 min) | **Alta** |
| 2 | Reutiliza planos (la base del *photobashing*). | Biblioteca de planchas por región x hora (`lugar` + `luz`); una plancha sirve a muchas criaturas; `hflip` la duplica. Amortiza #1. | 0 extra por criatura | **Alta** |
| 3 | Pinta el personaje aparte, con su luz decidida (fase 4). | Pasada de sujeto: ficha con `sujeto`, `ancla`, `cuerpo`, `rasgos`, `pose`, y `entorno` = «fondo liso verde croma uniforme», `luz` idéntica a la de la plancha (misma dirección y color). Tamaño reducido (p. ej. 704x512 ≈ 55 % de píxeles). | 1 pasada (~25-30 min) | **Alta** |
| 4 | Recorta y pega con bordes controlados (fase 6). | `chromakey` + `despill` + `alphamerge`; erosionar el alfa 1 px y `gblur` 0,8-1,5 px al alfa para el borde suave; más blando cuanto más lejos esté el sujeto. | 0 | **Alta** |
| 5 | Ancla al sujeto con sombra de contacto y sombra proyectada (fase 4). | Máscara del sujeto → aplanar y `hflip`/desplazar → `gblur` fuerte → oscurecer con `eq` o `colorchannelmixer` y componer con `overlay` bajo el sujeto; color de la sombra = azul/ámbar del cielo de la plancha, no negro. | 0 | **Alta** |
| 6 | Perspectiva atmosférica sobre el sujeto lejano (fase 3). | Velo del color de la bruma de la plancha sobre el sujeto con opacidad creciente con la distancia, bajando contraste (`eq=contrast`) y saturación. En contraluz cálido, velo cálido (Gurney, inversa). | 0 | Media |
| 7 | Luz de borde de contraluz (fase 4). | En la ficha de sujeto, `luz`: «luz de borde del color del cielo desde atrás». Si falla: contorno del alfa dilatado − alfa, `gblur`, `overlay` con color del sol. | 0-1 | Media |
| 8 | Primer plano que tapa los pies y da profundidad (fase 3). | Recortar una franja inferior de la plancha (o su `hflip`), desenfocarla y colocarla delante de las patas con `alphamerge` degradado. | 0 | Media |
| 9 | Miniaturas y estudio de valores antes de pintar (fase 1). | txt2img pequeño (p. ej. 320x128, 4-8 pasos) con varias semillas para elegir encuadre. Hipótesis a probar: que luego sirva de `--init-img` a `--strength` alto (0,8-0,9) para fijar la composición. Alternativa 0 pasadas: dibujar la masa de valor con `geq`/`drawbox`. | ~2-4 min cada una | **Alta** |
| 10 | Masas de valor y punto focal (fase 2). | En la ficha: «sujeto oscuro a contraluz sobre bruma clara» (o inverso) y una «poza de luz» cerca del sujeto; en el montaje, viñeta suave (`vignette`) para concentrar luz. | 0 | Media |
| 11 | Gradación final común (fase 6, Rookies). | Sobre el montaje: igualar con `colorbalance`/`curves`, capa cálida de opacidad ~5 % (`overlay` de color plano), curva de contraste, y velo de bruma sobre todo el conjunto para fijar el color. | 0 | **Alta** |
| 12 | Igualar nitidez y grano (fase 5). | `gblur` leve al sujeto hasta igualar la plancha y `noise` temporal igual a todo el montaje (grano común). Sin fuente primaria. | 0 | Media |
| 13 | Pintar encima del montaje para fundir (*paintover*). | Pasada de armonización: `--init-img` = montaje, `--strength` bajo, prompt = ficha completa (sujeto primero). A medir 0,20 / 0,30 / 0,40. Riesgo: que repinte el sujeto. | s x 49 min, p. ej. 0,3 ≈ 15 min | **Alta** (a probar) |
| 14 | *Paintover* solo donde se junta (borde del sujeto). | Misma pasada con `--mask` (máscara = costura del sujeto dilatada y suavizada), `--strength` 0,4-0,6, para no tocar el resto. | como #13 | Media |
| 15 | Rehacer el sujeto dentro del fondo con luz propia del fondo. | Variante «inpainting»: plancha + silueta tosca pegada como `--init-img` y `--mask` sobre el sujeto, `--strength` 0,85-0,95. Preserva el fondo fuera de la máscara. | 1 pasada (49 min) | Media |
| 16 | Usar referencias con rol claro. | `-r plancha.png -r sujeto.png` con prompt que dice el rol de cada una (BFL: «sujeto de la imagen 1, estilo de la imagen 2»). `--ref-image-args "preset=flux2"` es el preset automático. En r9 `-r` casi duplicó el tiempo y solo ayudó a la paleta. | ~2x | Baja |
| 17 | Composición panorámica, sujeto bajo y ancho con mucho paisaje (diagnóstico de r9). | Con montaje, el encuadre lo decide la posición y escala del sujeto en ffmpeg (control exacto, no el modelo). | 0 | **Alta** (efecto de #3-#5) |

Notas de sustento:
- #3, #13: la guía de BFL dice que FLUX.2 «pone más atención a lo que viene primero», recomienda sujeto → acción →
  estilo → contexto, prompts medios de 30-80 palabras y evitar negativos; para varias referencias, describir el rol de
  cada una (<https://docs.bfl.ai/guides/prompting_guide_flux2>). La página cubre pro/max/flex/dev, **no menciona
  Klein**: extrapolamos.
- #13-#16: la documentación de stable-diffusion.cpp leída (`docs/flux2.md`) solo documenta `-r` para editar con Klein
  (distilled: cfg 1,0, 4 pasos; base: cfg 4,0, 20 pasos) y no menciona `--strength`; `docs/edit.md` documenta
  `--ref-image-args` (presets, `ref_index_mode`, `resize_before_vae`); `docs/image_preprocessing.md` documenta
  `--image-preprocess` (`target=init|mask|ref`, `mode=fit-pad|crop-resize|stretch`, la máscara hereda la geometría
  del init). **`--init-img`, `--strength` y `--mask` no salen en esas páginas: comprobar con `sd-cli -h` antes de
  fiarse.** Fuentes: <https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux2.md>,
  <https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md>,
  <https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/image_preprocessing.md>.
- Los rangos de `--strength` de la tabla **no vienen de ninguna fuente**: son una escalera de prueba. Ninguna fuente
  leída da cifras de «armonización» para FLUX.

## 4. Propuesta: cadena de planos para un banner con criatura

Objetivo: banner 1280x512 con criatura (p. ej. aullador al atardecer). Entradas: ficha de la criatura y ficha de
la región. Fija la **luz** una vez (dirección, color del sol, color del cielo/bruma) y repítela literalmente en las
tres fichas.

0. **Miniaturas (#9), opcional.** 4 miniaturas 320x128 de la plancha con semillas distintas; elegir encuadre.
   Si funciona, la elegida (escalada a 1280x512) va de `--init-img` de la plancha con `--strength` 0,8-0,9.
1. **Plancha de fondo (#1, #2).** txt2img 1280x512, 16 pasos, sin sujeto; `entorno` con «espacio libre» y un camino de
   luz hacia el punto focal; bruma de color ámbar en el fondo. Guardar en la biblioteca por región x hora.
2. **Sujeto aislado (#3).** txt2img ~704x512, fondo verde croma plano, misma luz que la plancha, luz de borde pedida
   en el texto. Varias semillas si hace falta; es la pasada más barata de repetir.
3. **Montaje con ffmpeg (#4-#8, #10, #11, #12, #17).** En este orden:
   1) `chromakey` + `despill` del verde, `alphamerge`; 2) erosión 1 px y `gblur` 1 px del alfa; 3) escalar y colocar
   el sujeto bajo y a un tercio (la proporción larga y baja la fija la escala/anamorfosis en ffmpeg, no el modelo);
   4) sombra de contacto + sombra proyectada coloreada con el cielo; 5) velo de bruma sobre el sujeto con opacidad
   según distancia; 6) franja de primer plano reciclada de la plancha delante de las patas; 7) igualar
   nitidez (`gblur`) y grano (`noise`) al conjunto; 8) gradación final: calidez ~5 % en `overlay`, curva de contraste,
   viñeta suave. Sin pasadas.
4. **Armonización (#13, #14).** img2img sobre el montaje, ficha completa con el sujeto primero. Probar 0,20 / 0,30 /
   0,40 sobre la misma semilla y quedarse con el menor que funda la costura sin repintar el sujeto; con la
   máscara de la costura (#14) se puede subir a 0,4-0,6. Si repinta la anatomía, volver al montaje (paso 3).
5. **Ampliado** con Real-ESRGAN a 5120x2048 como ya probado (`calidad.sh`).

Coste de la primera criatura de una región: 49 (plancha) + ~28 (sujeto) + ~15 (armonización a 0,3) ≈ 90 min, frente a
49 hoy; desde la segunda criatura con la misma plancha, ~43 min (sujeto + armonización). Lo que se gana: el fondo no
compite con el sujeto, y composición, escala, sombra y bruma quedan bajo control exacto y repetible.

Qué probar primero (orden): (a) pasos 1-3 sin armonización, mirando si la costura se lee; (b) #13 con tres valores
de `--strength`; (c) miniaturas como `--init-img`; (d) `-r` solo si lo anterior no iguala la paleta.

## 5. Fuentes

Leídas (página abierta y citada):
- Gurney Journey, «Atmospheric distance and value», 2013: <https://gurneyjourney.blogspot.com/2013/07/atmospheric-distance-and-value.html>
- Gurney Journey, búsqueda «atmospheric perspective» (lista incl. «Reverse Atmospheric Perspective», «Warm Colors in the Distance»): <https://gurneyjourney.blogspot.com/search?q=atmospheric+perspective>
- Gurney Journey, «Dinotopia painting, step by step»: <http://gurneyjourney.blogspot.com/2013/02/dinotopia-painting-step-by-step.html>
- Gurney Journey, «Linking Darks»: <http://gurneyjourney.blogspot.com/2013/12/linking-darks.html>
- Gurney Journey, «Cast Shadow in the Foreground»: <http://gurneyjourney.blogspot.com/2014/11/cast-shadow-in-foreground.html>
- Gurney Journey, «Zhaoming Wu Demo» (bordes perdidos y encontrados; vía búsqueda): <https://gurneyjourney.blogspot.com/2013/04/zhaoming-wu-demo.html>
- CG Channel, Dylan Cole / Gnomon (valores primero, pozas de luz): <https://www.cgchannel.com/?p=57646>
- The Rookies, integración de un elemento (match color, calidez a ~5 %, curva): <https://www.therookies.co/blog/matte-painting-tips-for-camera-mapping-3d-projection-and-element-integration-with-nuke/>
- Black Forest Labs, guía de prompts de FLUX.2: <https://docs.bfl.ai/guides/prompting_guide_flux2>
- stable-diffusion.cpp: <https://github.com/leejet/stable-diffusion.cpp> (README), `docs/flux2.md`, `docs/edit.md`, `docs/image_preprocessing.md` (enlaces arriba).

Solo vistas en fragmentos de búsqueda (no leídas enteras; ver los originales antes de citar en un documento final):
- Gurney Journey: <http://gurneyjourney.blogspot.com/2012/01/really-rough-maquettes.html>, <http://gurneyjourney.blogspot.com/2010/02/light-and-form-part-2.html>, <http://gurneyjourney.blogspot.com/2013/09/hard-and-soft-light.html>, <http://gurneyjourney.blogspot.com/2011/03/value-planning.html>, <https://gurneyjourney.blogspot.com/2007/09/reverse-atmospheric-perspective.html>
- Gnomon / Feng Zhu (nota de prensa): <https://www.awn.com/news/gnomon-workshop-releases-seven-new-training-dvds>; curso de Hawkins: <https://www.cgchannel.com/?p=65028>

No encontrado en fuente primaria: flujo de Craig Mullins (hay entrevistas en Schoolism y Bonexpose, no leídas),
Jama Jurabaev (entrevista de The Art Department y KitBash3d, no leídas), lecciones de Feng Zhu (FZD / Design Cinema),
*Color and Light* y *d'artiste Matte Painting* como libros (solo reseñas), y cualquier cifra de `--strength` para
armonizar con FLUX.
