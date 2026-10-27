# Pautas de prompt y receta, medidas contra las referencias (`IMG-21`, `IMG-22`)

**Qué es** (usuaria, 2026-10-27): el objetivo del trabajo con el generador es **juntar pautas y estándares** para que,
por prompt, el resultado se acerque lo más posible a las imágenes de referencia (los banners de ChatGPT del juego),
no sacar imágenes finales. Cada prueba deja aquí una pauta con su evidencia; la imagen final llega cuando la receta
esté afinada y la gestione la interfaz de creación continua (`IMG-25`). Este archivo es la capa **genérica** (sirve
para cualquier mundo y pasará al repo del generador en `IMG-26`); lo propio de Tarkor sigue en
[`guia-visual-mundo.md`](guia-visual-mundo.md) y las reglas mecánicas del prompt, en
[`plantilla-prompt.md`](plantilla-prompt.md) (sin negaciones, sin nombres propios, palabras vetadas).

**Cómo se lee:** cada pauta lleva su estado, ✅ medida (con la ronda de [`banco/resultados.md`](banco/resultados.md)
que la sostiene) o 🔬 por medir, y los ejemplos dicen de qué elemento salen. Motor: FLUX.3 Image Klein Q8 en la CPU
de la Deck (sd-cli), sin LoRA.

## 1. Estructura del prompt

Orden fijo, en frases completas (decisión 1 del [plan](plan-fotorreal.md#marco-las-ocho-decisiones-no-se-reabren-aquí)):

1. **Encuadre**: plano y lente por tipo de elemento (fauna, lateral a media distancia; lugar, gran angular por capas).
2. **Sujeto**: qué es, un **ancla** real que dé la silueta («a maned wolf, only gaunter») y la **proporción
   estructural** con números relativos.
3. **Rasgos de forma**, en el orden en que se leen (de la cabeza a la cola, de arriba abajo).
4. **Pose**.
5. **Compañía** (manada, jinete, escala humana).
6. **Entorno** por capas: suelo → media distancia → horizonte.
7. **Luz y momento**.
8. Línea fija `Style: … Mood: …`.

## 2. Pautas de forma

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| F1 | **Proporción con medidas del propio cuerpo**, no con adjetivos: «horns each about as long as its head», «a ridge no wider than a hand». Los adjetivos solos («long, slim, low») no adelgazan un torso. | ✅ / 🔬 | r14 v3: la cresta estrecha del aullador iguala al banner; el torso sigue más grueso que la «cinta» del banner pese a «long, slim» |
| F2 | **Un rasgo continuo dice dónde empieza y dónde acaba**: «runs unbroken along the spine from the nape to the fan of spines at its tail tip». | ✅ | r12, cresta solo en el lomo; r14, cresta entera |
| F3 | **El color, por material**: «bone grey with darker veins», no «grey» ni «pale». | ✅ | r14: cuernos del cuernahoja color hueso, como el banner |
| F4 | **Un rasgo pequeño necesita sitio en la imagen**: a 512 px de ancho del sujeto, unos pies o unos ojos no se pueden juzgar. Se pide «clearly visible» y se juzga en un recorte o a tamaño final. | 🔬 | r14: los pies de ave del cuernahoja no se leen a 512 |
| F5 | **Para forma rara, plantilla de boceto** como `--init-img` a 0,95-0,97 con `strength_as_noise_level=true`; por debajo de ~0,92 el resultado sale plano como el dibujo. **El boceto manda sobre el prompt**: si dibuja la cabeza de perfil, el prompt de tres cuartos no la gira. | ✅ | `IMG-19b` (escalera 0,75-0,97) y bocetos v2 |
| F6 | **El ancla se nombra una vez, con su diferencia** («only gaunter and wilder»); si no, el modelo pinta el animal real (zorro, carnero). | ✅ | r12 |

## 3. Pautas de pose y composición

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| P1 | **Cuerpo de perfil, cabeza a tres cuartos hacia quien mira**, dicho explícito: «both eyes and both ears showing». El perfil da la silueta legible, y los tres cuartos dan profundidad y presencia. | ✅ | Banners GPT del aullador y del cuernahoja; guías de diseño de criaturas (decisión del 2026-10-27) |
| P2 | **La manada no se pide en el prompt**: el modelo pone otra especie (hienas, ciervos). Se monta con copias del sujeto (`montar.sh`), con escala, volteo, oscurecido y bruma por copia. | ✅ | r12, `IMG-19c` |
| P3 | **Composición por planos**: plancha sin sujeto + sujeto sobre verde + montaje + armonización. Separa lo que el modelo mezcla mal (fondo y criatura). | ✅ | `IMG-19c` |
| P4 | **El fondo verde no sale croma**: «chroma-key green» da un verde de estudio apagado y en degradado. Se recorta por dominancia del verde (`UMBRAL`=12 en `montar.sh`), no por el color de la esquina. | ✅ | r14 |
| P5 | **La luz del sujeto es la de la plancha**: el prompt del sujeto nombra la dirección («daylight from the left»), para que el montaje no se vea pegado. | ✅ | r14 |

## 4. Receta

| Paso | Valores | Coste en la Deck | Estado |
|---|---|---|---|
| Borrador | 640x256, 8 pasos; `--preview proj` se lee desde el paso 2 | ~7 min | ✅ `IMG-19a`: anticipa la composición de 1280x512 a 16 pasos |
| Sujeto sobre verde | 512x192, 8 pasos; boceto a 0,95-0,97 (F5) | ~4 min | ✅ `IMG-19b` |
| Montaje | `montar.sh` (`HERO`, `MANADA`) | segundos | ✅ `IMG-19c` |
| Armonización | `-i` del montaje a 0,5 con `strength_as_noise_level=true` (0,7 si se ve pegado); `-r` descartada (×9 y vira a azul) | ~1-2 min | ✅ `IMG-19c` |
| Gradación | `gradar.sh <img> <momento>` (LUT por momento) | segundos | ✅ `IMG-17` |
| Final | 1280x512, 16 pasos, solo cuando la receta ya pasa en borrador | ~49 min (tanda de noche) | 🔬 `IMG-23` |

## 5. Criterio de parecido con la referencia

Una imagen se juzga **contra la referencia de ese elemento** (en Tarkor, el banner de GPT, `imagenJuego` de la ficha),
siempre en una rejilla lado a lado (`medir/rejilla.sh`):

1. **Color**: `medir.sh <img> <tipo> <momento>`; mediana del EMD Cb ≲ 6 y Cr ≲ 7,5, y falla por encima de 11,4 / 13,5
   (`estilo/gradacion.json`). YAVG y SATAVG, dentro de la ventana del momento.
2. **Forma**: lista de comprobación con una nota por punto (sí / parcial / no):
   - proporción (cuántas veces más largo que alto, cuello, patas);
   - cada rasgo de la ficha presente, en su sitio y de su tamaño;
   - pose (P1);
   - compañía de la misma especie (P2);
   - luz y momento.
3. **Silueta conservada** entre pasos de la cadena (montaje → armonía): SSIM en gris ≳ 0,7. Entre la imagen y la
   referencia no sirve, porque el encuadre difiere.

Una pauta pasa a ✅ cuando acerca la nota de forma o el EMD en al menos dos elementos distintos.

## 6. Abierto (lo que mide la tanda de `IMG-21` y `IMG-22`)

- Si F1 adelgaza un torso con una medida («body no thicker than its head is long») o hace falta la plantilla de boceto.
- Si las pautas se pueden seguir **sin retoque a mano**: el prompt de cada elemento de la tanda lo escribe un agente
  barato con esta guía y su referencia delante; lo que no sabe escribir es una pauta que falta.
- Otros planes corporales (ave, reptil, artrópodo, acuático…) y otros tipos (flora, lugar, objeto, raza).
- Plantillas de boceto genéricas por plan corporal en vez de un SVG por criatura (`IMG-24`).
