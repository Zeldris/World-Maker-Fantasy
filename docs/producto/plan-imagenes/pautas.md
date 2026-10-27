# Pautas de prompt y receta, medidas contra las referencias (`IMG-21`, `IMG-22`)

**Versión:** 3 (r16; v1 hasta r14, v2 con r15; R2 y R3 el 2026-10-27).

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
| F6b | **El ancla se elige por silueta, porque gana a su diferencia**: «only thicker», «only with a heavier head» o «only far rounder» casi no mueven la forma. Sirve el animal que ya tiene la silueta de la referencia; si lo que define a la criatura es justo la diferencia, se busca otra ancla que la tenga o se describe el plan corporal sin ancla. | ✅ | r15: correcaminos acierta; black bass, rinoceronte y rana toro salen tal cual. r16: el gargantúa sin ancla deja de ser rinoceronte |
| F6c | **Sin ancla, lo que queda no puede ser la firma de otro animal**: el plan corporal genérico funciona («barrel-shaped body, pillar-like legs»), pero unos ojos saltones con lengua llaman al sapo y un «pez de río de cuerpo hondo», al black bass. Otra ancla de silueta trae sus propios rasgos (la harpía, su cresta). La silueta se dice con los números medidos en la referencia (F10), sin los rasgos que delatan al animal por defecto. | ✅ | r16: gargantúa sale; guchapo, jusha y cruzavientos no |
| F7 | **Una parte no se compara con otro animal**: el ancla de una parte contagia al cuerpo entero. La parte se describe con palabras de forma y material. | ✅ | r15: «como una cochinilla» hace cochinilla el escorpión; placas blancas en la cabeza vuelven el águila un águila calva |
| F7b | **Tampoco se describe con la forma del animal que contaminaba**: «broad, overlapping bands… a rounded shield» es una cochinilla sin nombrarla. Se describe la forma de la referencia (plano, bajo, alargado, con espinas en el lomo), no la del lore. | ✅ | r16: espina-del-viento sigue cochinilla |
| F8 | **Un material no se compara con un objeto**: se pinta el objeto encima, como un disfraz. Se describe su forma y textura y que crece de la piel («irregular knobbly bone plates with short spikes, growing out of the hide»). | ✅ (sin objeto) / 🔬 (que crezca de la piel) | r15: «plated like the shell of an armadillo» → losas planas sobre un rinoceronte. r16: sin el objeto salen placas con púas, pero siguen siendo losas encima |
| F9 | **Las cuentas no se cumplen por prompt**: si el número importa (placas, ojos, puntas), va en el boceto (F5, `IMG-24`); en el prompt, «a row of», «many», sin número. | ✅ | r15: 7 placas, 4 ojos y lengua en 3 puntas; ninguna sale |
| F10 | **Colores y proporciones se miden en la referencia, no se toman del texto**: el lore dice «marfil» y el banner lo pinta gris oscuro o rojizo; el número de una ronda anterior no vale (pez a «3 veces», el banner ~4,5). Sin referencia (elemento nuevo), del texto. | ✅ | r16: cruzavientos, espina y jusha se alejan por esto |

## 3. Pautas de pose y composición

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| P1 | **La pose sale de la referencia de su plan corporal** (tabla de abajo). En el cuadrúpedo, cuerpo de perfil y cabeza a tres cuartos, dicho explícito: «both eyes and both ears showing»; el perfil da la silueta legible y los tres cuartos, presencia. | ✅ | Banners GPT; guías de diseño de criaturas (decisión del 2026-10-27); r15 |
| P2 | **La manada no se pide en el prompt**: el modelo pone otra especie (hienas, ciervos). Se monta con copias del sujeto (`montar.sh`), con escala, volteo, oscurecido y bruma por copia. | ✅ | r12, `IMG-19c` |
| P3 | **Composición por planos**: plancha sin sujeto + sujeto sobre verde + montaje + armonización. Separa lo que el modelo mezcla mal (fondo y criatura). | ✅ | `IMG-19c` |
| P4 | **El fondo verde no sale croma**: «chroma-key green» da un verde de estudio apagado y en degradado. Se recorta por dominancia del verde (`UMBRAL`=12 en `montar.sh`), no por el color de la esquina. | ✅ | r14 |
| P5 | **La luz del sujeto es la de la plancha**: el prompt del sujeto nombra la dirección («daylight from the left»), para que el montaje no se vea pegado. | ✅ | r14 |
| P6 | **El fondo del sujeto, de un color que el sujeto no tenga**: con criaturas verdes el recorte por dominancia del verde las agujerea. Verde para lo demás, magenta para lo verde y azul para lo verde con magenta (`montar.sh` con `FONDO=verde|magenta|azul`). | ✅ | r15: pez y serpiente con agujeros (`generated/banco/r15-recorte-verdes.png`); r16: jusha en magenta y morvasa en azul, limpios (`r16-recorte-magenta-azul.png`) |
| P7 | **Las formas altas no caben en 512x192** (la S de una serpiente, un cuello alzado): el sujeto se genera en un lienzo más alto, 384x320, y se escala en el montaje. Las alas abiertas de frente sí caben. | ✅ | r15: morvasa aplastada; cruzavientos cabe. r16: a 384x320 la S se alza entera |
| P8 | **La dirección del sujeto no se controla por prompt** («flying to the left» sale de frente); se voltea en el montaje (`montar.sh` ya voltea copias). | ✅ | r15: cruzavientos; r16: el gargantúa cambia de lado sin pedirlo |

**Pose por plan corporal** (de los banners de GPT, el estándar de la casa; vista lateral del pez, convención de la
ilustración científica). El ✅ es de la pose; si la especie se lee como su banner, en [`resultados.md`](banco/resultados.md):

| Plan | Pose | Estado |
|---|---|---|
| Cuadrúpedo (corredor, pesado, pequeño) | Cuerpo de perfil, cabeza a tres cuartos, los dos ojos | ✅ aullador, cuernahoja, nuente |
| Ave corredora | Todo de perfil, también la cabeza | ✅ corretolvas |
| Ave en vuelo | Alas abiertas y levantadas, de frente o a tres cuartos; el cuerpo, corto | ✅ cruzavientos (cabe; la dirección, P8) |
| Pez | Perfil lateral, flotando | ✅ jusha |
| Serpiente | Enroscada, el tercio delantero levantado en S, cabeza a tres cuartos; lienzo alto (P7) | ✅ la S (morvasa r16) / 🔬 la pila de lazos |
| Artrópodo | Perfil bajo o tres cuartos desde delante; «all eyes visible» en vez de «both eyes» | 🔬 espina-del-viento |
| Anfibio | Sentado, de perfil, cabeza a tres cuartos | ✅ guchapo |

## 4. Receta

| Paso | Valores | Coste en la Deck | Estado |
|---|---|---|---|
| Borrador | 640x256, 8 pasos; `--preview proj` se lee desde el paso 2 | ~7 min | ✅ `IMG-19a`: anticipa la composición de 1280x512 a 16 pasos |
| Sujeto sobre fondo liso (P6) | 512x192 (384x320 lo alto, P7), 8 pasos, dos semillas (R1); boceto a 0,95-0,97 (F5) | ~375 s por semilla | ✅ `IMG-19b`, r15, r16 |
| Montaje | `montar.sh` (`HERO`, `MANADA`) | segundos | ✅ `IMG-19c` |
| Armonización | `-i` del montaje a 0,5 con `strength_as_noise_level=true` (0,7 si se ve pegado); `-r` descartada (×9 y vira a azul) | ~1-2 min | ✅ `IMG-19c` |
| Gradación | `gradar.sh <img> <momento>` (LUT por momento) | segundos | ✅ `IMG-17` |
| Final | 1280x512, 16 pasos, solo cuando la receta ya pasa en borrador | ~49 min (tanda de noche) | 🔬 `IMG-23` |

**R1 · Una pauta se prueba en dos semillas.** Con la misma semilla, un prompt reescrito repite encuadre y pose casi
igual (r16: jusha, guchapo y espina, como en r15); sirve para comparar un cambio pequeño, pero un remedio que no
cambia la clase del sujeto no se ve. ✅ r16.

**R2 · Parada por especie** (usuaria, 2026-10-27): una especie que no mejora en dos rondas seguidas sale del banco
por prompt y pasa al boceto por plan corporal (`IMG-24`); no se le reescribe el prompt una tercera vez. Cada ronda
lleva solo las especies que aún fallan (media ronda, ~40 min, se juzga el mismo día), no las seis.

**R3 · Cierre de `IMG-21`**: se cierra cuando la mayoría de las especies del banco «se lee como» su banner, no todas;
las que quedan son trabajo de `IMG-24` o de la interfaz, no del banco. El objetivo son pautas reutilizables
([`objetivo`](plan-fotorreal.md)), no una imagen final por especie.

## 5. Criterio de parecido con la referencia

Una imagen se juzga **contra la referencia de ese elemento** (en Tarkor, el banner de GPT, `imagenJuego` de la ficha),
siempre en una rejilla lado a lado (`medir/rejilla.sh`):

1. **Color**: `medir.sh <img> <tipo> <momento>`; mediana del EMD Cb ≲ 6 y Cr ≲ 7,5, y falla por encima de 11,4 / 13,5
   (`estilo/gradacion.json`). YAVG y SATAVG, dentro de la ventana del momento.
2. **Forma**: primero, **se lee como** el elemento de la referencia, como el ancla o como otro animal: la nota por
   puntos sola es generosa (r15: 5/7 y se lee como un águila calva). Después, la lista con una nota por punto
   (sí / parcial / no):
   - proporción (cuántas veces más largo que alto, cuello, patas);
   - cada rasgo de la ficha presente, en su sitio y de su tamaño;
   - pose (P1);
   - compañía de la misma especie (P2);
   - luz y momento.
3. **Silueta conservada** entre pasos de la cadena (montaje → armonía): SSIM en gris ≳ 0,7. Entre la imagen y la
   referencia no sirve, porque el encuadre difiere.

Una pauta pasa a ✅ cuando acerca la nota de forma o el EMD en al menos dos elementos distintos.

**Referencia frente a canon**: en lo visual manda la referencia (el banner); si contradice el texto del lore, se sigue
la referencia y la contradicción se apunta para la revisión del lore, sin pedirla en el prompt.

## 6. Abierto (lo que mide la tanda de `IMG-21` y `IMG-22`)

- Si F1 adelgaza un torso con una medida («body no thicker than its head is long») o hace falta la plantilla de boceto.
- r17: los seis de r16, con F10 (colores y proporción medidos en el banner) y dos semillas
  (R1). Lo que siga sin salir por prompt, al boceto por plan corporal (F5, `IMG-24`): en r16 ninguna de seis se lee
  como su banner.
- Cómo hacer que un material crezca de la piel (F8) y la pila de lazos de la serpiente.
- F1 sin cabeza ni patas como unidad (serpiente, pez, artrópodo): longitud del cuerpo en grosores.
- Si las pautas se pueden seguir **sin retoque a mano**: en r15 un agente barato escribió los 8 prompts con esta guía y
  la referencia; solo uno de los 8 se lee como su referencia, y lo que no supo escribir entró como F6b-F9 y P6-P8. En
  r16, con esas pautas, ninguno de los seis restantes; las que faltaban entraron como F6c, F7b, F10 y R1.
- Otros planes corporales (ave, reptil, artrópodo, acuático…) y otros tipos (flora, lugar, objeto, raza).
- Plantillas de boceto genéricas por plan corporal en vez de un SVG por criatura (`IMG-24`).
