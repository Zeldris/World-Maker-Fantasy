# Pautas de prompt y receta, medidas contra las referencias (`IMG-21`, `IMG-22`)

**Versión:** 5 (r20: flora, lugar, objeto y raza, §7-§11; v4 con r17 y r18, v1 hasta r14, v2 con r15, v3 con r16; R2 y R3 el 2026-10-27). `IMG-21` cerrada con r18: cuatro de seis se leen como su banner. `IMG-22` con r20: seis de ocho (dos por tipo) a la primera.

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

Lo que cambia por tipo (r20, [`banco/r20-tipos.md`](banco/r20-tipos.md)): en **flora**, «pose» es cómo crece y
«compañía», las otras plantas de la especie; no hay fondo liso ni montaje (P2-P6 no aplican), el borrador sale en una
pasada con el paisaje (§7). En **lugar** no hay sujeto, ancla, pose ni compañía: el prompt abre con el horizonte y
las capas en fracciones (§8). En **objeto**, bodegón sobre una superficie del mundo con el fondo desenfocado; la
orientación hace de pose (§9). En **raza**, la figura entera al tercio izquierdo; el ancla es el tipo de criatura y
la compañía, su lugar habitado al fondo (§10). Lo común a los cuatro, en §11.

## 2. Pautas de forma

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| F1 | **Proporción con medidas del propio cuerpo**, no con adjetivos: «horns each about as long as its head», «a ridge no wider than a hand». Los adjetivos solos («long, slim, low») no adelgazan un torso. | ✅ / 🔬 | r14 v3: la cresta estrecha del aullador iguala al banner; el torso sigue más grueso que la «cinta» del banner pese a «long, slim» |
| F2 | **Un rasgo continuo dice dónde empieza y dónde acaba**: «runs unbroken along the spine from the nape to the fan of spines at its tail tip». | ✅ | r12, cresta solo en el lomo; r14, cresta entera |
| F3 | **El color, por material**: «bone grey with darker veins», no «grey» ni «pale». | ✅ | r14: cuernos del cuernahoja color hueso, como el banner |
| F4 | **Un rasgo pequeño necesita sitio en la imagen**: a 512 px de ancho del sujeto, unos pies o unos ojos no se pueden juzgar. Se pide «clearly visible» y se juzga en un recorte o a tamaño final. | 🔬 | r14: los pies de ave del cuernahoja no se leen a 512 |
| F5 | **Para forma rara, plantilla de boceto** como `--init-img` a 0,95-0,97 con `strength_as_noise_level=true`; por debajo de ~0,92 el resultado sale plano como el dibujo. **El boceto manda sobre el prompt**: si dibuja la cabeza de perfil, el prompt de tres cuartos no la gira. | ✅ | `IMG-19b` (escalera 0,75-0,97), bocetos v2; r19: el boceto generado por plan (`IMG-24`) vale igual que el SVG a mano (gargantúa) |
| F6 | **El ancla se nombra una vez, con su diferencia** («only gaunter and wilder»); si no, el modelo pinta el animal real (zorro, carnero). | ✅ | r12 |
| F6b | **El ancla se elige por silueta, porque gana a su diferencia**: «only thicker», «only with a heavier head» o «only far rounder» casi no mueven la forma. Sirve el animal que ya tiene la silueta de la referencia; si lo que define a la criatura es justo la diferencia, se busca otra ancla que la tenga o se describe el plan corporal sin ancla. | ✅ | r15: correcaminos acierta; black bass, rinoceronte y rana toro salen tal cual. r16: el gargantúa sin ancla deja de ser rinoceronte. r18: el bowfin (cabeza roma) con la cabeza medida quita la perca al jusha en las dos semillas |
| F6c | **Sin ancla, lo que queda no puede ser la firma de otro animal**: el plan corporal genérico funciona («barrel-shaped body, pillar-like legs»), pero unos ojos saltones con lengua llaman al sapo y un «pez de río de cuerpo hondo», al black bass. Otra ancla de silueta trae sus propios rasgos (la harpía, su cresta). La silueta se dice con los números medidos en la referencia (F10), sin los rasgos que delatan al animal por defecto. Un ancla con un rasgo que la referencia no tiene lo cuela en alguna semilla aunque el prompt mida el rasgo bueno (r18: la dorsal blanda del bowfin en una de dos). | ✅ | r16: gargantúa sale; guchapo, jusha y cruzavientos no. r18: jusha sale con el bowfin, con su dorsal en una semilla |
| F7 | **Una parte no se compara con otro animal**: el ancla de una parte contagia al cuerpo entero. La parte se describe con palabras de forma y material. | ✅ | r15: «como una cochinilla» hace cochinilla el escorpión; placas blancas en la cabeza vuelven el águila un águila calva |
| F7b | **Tampoco se describe con la forma del animal que contaminaba**: «broad, overlapping bands… a rounded shield» es una cochinilla sin nombrarla. Se describe la forma de la referencia (plano, bajo, alargado, con espinas en el lomo), no la del lore. | ✅ | r16: espina-del-viento sigue cochinilla |
| F8 | **Un material no se compara con un objeto**: se pinta el objeto encima, como un disfraz. Se describe su forma y textura y que crece de la piel («irregular knobbly bone plates with short spikes, growing out of the hide»). | ✅ (sin objeto) / 🔬 (que crezca de la piel) | r15: «plated like the shell of an armadillo» → losas planas sobre un rinoceronte. r16: sin el objeto salen placas con púas, pero siguen siendo losas encima |
| F9 | **Las cuentas no se cumplen por prompt**: si el número importa (placas, ojos, puntas), va en el boceto (F5, `IMG-24`); en el prompt, «a row of», «many», sin número. | ✅ | r15: 7 placas, 4 ojos y lengua en 3 puntas; ninguna sale |
| F10 | **Colores y proporciones se miden en la referencia, no se toman del texto**: el lore dice «marfil» y el banner lo pinta gris oscuro o rojizo; el número de una ronda anterior no vale (pez a «3 veces», el banner ~4,5). Sin referencia (elemento nuevo), del texto. | ✅ | r16: cruzavientos, espina y jusha se alejan por esto; r17: guchapo, morvasa y espina se leen como su banner al medir; gargantúa y cruzavientos no se mueven (la medida no cambia una silueta de ancla) |
| F10b | **El color que va al prompt es el del material, no el que tiñe la luz de la referencia**: la media de un recorte del banner sale naranja al atardecer o azul bajo el agua; se toma la zona iluminada de frente y se descuenta la dominante («cream-beige», no el `#9a7054` de la media). | ✅ | r17: espina (granate y óxido), morvasa (plata y rosa) y guchapo (canela y salvia) aciertan el color; en r16 el texto («marfil») fallaba |
| F10c | **Si la referencia no es de perfil, se pide su vista, no la de la tabla de pose**: la proporción medida depende de la vista (de frente, de tres cuartos), y la vista es parte de lo que «se lee como» la referencia. La tabla de pose por plan corporal vale para un elemento sin referencia. | ✅ | r17: el guchapo de frente (2,1 de ancho/alto) se lee como su banner; de perfil (r15, r16) era un sapo con la cabeza alzada |

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
- `IMG-21` cerrada en r18 (cuatro de seis). Gargantúa y cruzavientos, dos rondas iguales, van al boceto por plan
  corporal (F5, `IMG-24`, R2); el acabado de las cuatro buenas, a la interfaz (`IMG-25`) y la receta final.
- Cómo se elige el ancla cuando ningún animal común tiene la silueta entera (cabeza larga *y* roma): en r18 se hizo una
  tabla «trae / choca» a ojo y se pagó el rasgo de más (la dorsal) con una medida; falta la regla y saber si el modelo
  la sigue (en r18, en una semilla no).
- Un cuerpo sin una sola profundidad (pez en huso): si se pide el perfil, el máximo o la forma («deepest just behind
  the head, narrowing to a third»); en r18 forma más dos números funcionó.
- Cuándo se aísla una variable (A/B del ancla con el mismo prompt, ~25 min) y cuándo se acepta el paquete: R2 limita
  las rondas, no los cambios por ronda; r18 cambió ancla, cabeza y aletas a la vez y acertó sin saber cuál lo hizo.
- F10b con una referencia muy oscura (luminancia ~20/255): la media no distingue verde de azul; r18 se quedó con el
  color ya validado en r17. Falta decir con qué se aclara y hasta dónde fiarse.
- Qué denominador se mide (F10) en un pez o un ave en vuelo: longitud total o estándar, profundidad con o sin aletas; r16
  y r17 dan 3, 4 y 4,5 sobre el mismo banner según dónde se corte. Hay que fijar uno por plan corporal.
- Qué cifras distingue el modelo: no se sabe si «one and a half» y «twice» salen distintos; medir con un mismo prompt y
  solo la cifra cambiada.
- Cuándo vale parecer el animal por defecto (F6c): el guchapo es un sapo en la cara y la espina un escorpión en la cola, y
  eso es el banner. Criterio provisional (r17): la firma vale si el banner la tiene; se quita solo la parte que no.
- F9 y las cuentas pequeñas: seis surcos, cuatro ojos, tres lazos salieron bien en r17; distinguir «contar hasta 3-4» de
  «contar 7» antes de aflojar F9.
- Dos materiales en una pieza (cuerno rojo con punta de marfil, cabeza de hueso sobre cara oscura): F3 no cubre el
  degradado dentro de una parte; en r17 salió a medias (espina).
- Cómo hacer que un material crezca de la piel (F8) y la pila de lazos de la serpiente.
- F1 sin cabeza ni patas como unidad (serpiente, pez, artrópodo): longitud del cuerpo en grosores.
- Si las pautas se pueden seguir **sin retoque a mano**: en r15 un agente barato escribió los 8 prompts con esta guía y
  la referencia; solo uno de los 8 se lee como su referencia, y lo que no supo escribir entró como F6b-F9 y P6-P8. En
  r16, con esas pautas, ninguno de los seis restantes; las que faltaban entraron como F6c, F7b, F10 y R1. En r17, con
  F10, tres de los seis (guchapo, morvasa, espina); lo que faltaba entró como F10b y F10c. En r18, jusha: cuatro de seis
  con la guía tal cual, sin retoque a mano; es el cierre de `IMG-21`.
- Otros planes corporales (ave, reptil, artrópodo, acuático…). ~~Otros tipos (flora, lugar, objeto, raza)~~ ✅ r20,
  §7-§11.
- **La línea fija `Style` frente a una luz fría u oscura** (T1): r20b mide si quitar la cláusula de luz de la línea
  deja ganar a la luz del cuerpo; si sí, la línea de `mundo.json` se parte en acabado (fijo) y luz (del momento y el
  clima del elemento), y es decisión de la usuaria (`IMG-23`).
- Las pautas de tipo con un solo elemento a favor (FL3-FL5, O8, R-Z5-R-Z7) y la segunda semilla de r20 (R1).
- Qué fracción del ancho sigue el modelo: el objeto sale mayor que la pedida (O2); no se sabe si pedir menos la baja.
- Acabado `porTipo.item` (50 mm, O6) y la comparación con 85 mm, para `IMG-23`.
- ~~Plantillas de boceto genéricas por plan corporal en vez de un SVG por criatura (`IMG-24`)~~ ✅ 2026-10-27:
  `image-generator/bocetos/plantilla.py`, seis planes; r19 lo confirma con el gargantúa.

## 7. Flora

La planta en su paisaje a 50 mm, no macro ni sujeto aislado: los banners son una escena de tres capas con el sujeto
repartido (una fila de ejemplares, una masa reptante). Medidas y razonamiento en [`banco/r20-tipos.md`](banco/r20-tipos.md#flora).

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| FL1 | **La planta se pide en su paisaje, con cada capa en fracciones de la imagen** («cliff fills the right half», «sky slot a seventh wide»); sin fondo liso ni montaje, en una pasada. | ✅ | r20: cardo y salvia salen con sus capas y su pared |
| FL2 | **La proporción se da entre las partes de la planta y contra un objeto de escala de la escena** (capullo 2/3 del tallo y 2 x su ancho; hoja 2,5 x larga que ancha, 2 x la piedra), no con adjetivos. | ✅ | r20: capullos y hojas con la forma del banner en los dos |
| FL3 | **El tamaño del sujeto se dice como fracción de la imagen y la fila de ejemplares, por tamaños y no por número** («a diagonal row… the largest three quarters of the image tall, the last a tiny speck»), por F9. | 🔬 | r20: cardo a favor (la fila mengua hacia la izquierda); falta otro elemento |
| FL4 | **Ancla vegetal solo para el capullo o la flor, una vez y con su diferencia**; la planta entera sin ancla. | 🔬 | r20: la alcachofa da el capullo sin traer su verde (cardo); un elemento |
| FL5 | **Una planta sin silueta común se describe por forma de hoja, tallo y recorrido, sin ancla** («lance-shaped, climbing the wall in thin strands»). | 🔬 | r20: salvia a favor; un elemento |
| FL6 | **El color de hoja y flor se mide en el banner descontando la luz** (F10b); en escena oscura se aclara el recorte y se decide a ojo. | ✅ | r20: carbón y plata del cardo, azul pizarra con motas de la salvia; el color acierta aunque la luz falle |

## 8. Lugar

Gran angular por capas a 24 mm, cámara baja; no hay sujeto ni ancla: el lugar es el sujeto
([`r20-tipos.md`](banco/r20-tipos.md#lugar)).

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| L1 | **El horizonte (o el labio) y las capas se dicen en fracción del alto, y los elementos grandes en fracción del ancho; el prompt abre con ellas.** | ✅ | r20: 1/4 → 0,26 (pastos) y 0,22 (cataratas); la meseta a la derecha y la caída a ~0,37 del ancho |
| L2 | **Tres capas nombradas** (foreground, middle distance, horizon o far layer), cada una con su material y su fracción; en un lugar vertical, la caída es el plano medio y el río alto, la capa lejana. | ✅ | r20: los dos |
| L3 | **La luz se dice por dirección y posición de la fuente** (fuera de cuadro a la izquierda, contraluz detrás de la caída). La dirección sale; **el sol fuera de cuadro no**: pinta el disco. | ✅ dirección / 🔬 sin disco | r20: pastos y cataratas con la luz del banner; pastos y cardo con el disco |
| L4 | **El color por material se mide aclarando el banner y descontando la dominante del cielo**: la hierba y el agua tienen su color aunque la luz los tiña. | ✅ | r20: hierba oliva con puntas de paja, agua café con leche y espuma crema |
| L5 | **Sin ancla de lugar**: nombrar un paisaje real arrastra su fauna y su flora (F6c); se describe por capas y materiales. | 🔬 | r20: los dos sin ancla se leen como su banner; sin A/B con ancla |
| L6 | **Huella humana mínima solo si el banner la tiene** (red, poste, senda), una frase y en su sitio. | ✅ | r20: la red en su poste, la senda a la derecha |

## 9. Objeto

Bodegón: el objeto entero sobre una superficie del mundo, cámara baja a tres cuartos, fondo desenfocado que dice de
dónde es; lente 50 mm propuesta (`mundo.json` no tiene `porTipo.item`). [`r20-tipos.md`](banco/r20-tipos.md#objeto).

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| O1 | **El objeto entero, en bodegón**, apoyado en una superficie descrita (tablón, arcilla mojada) con el fondo en capas desenfocado. | ✅ | r20: cuchillo y odre |
| O2 | **La fracción del ancho se pide como la del banner o algo mayor (F4), y el modelo la agranda** (1/2 → 3/4, 2/5 → 55 %); no se controla fino. | ✅ | r20: los dos salen mayores que lo pedido |
| O3 | **Las proporciones se miden en la referencia con la unidad del propio objeto** (hoja frente a mango, cuerpo frente a cuello, correa frente a cuerpo); el canon da cifras que el banner contradice. | ✅ | r20: hoja ~2 x mango, bolsa 1,9 de largo/ancho |
| O4 | **Un material emblemático se describe por forma y textura, sin objeto ni material real** (F8): «translucent, colourless mineral, rippled, hand-chipped, web of fine fracture lines». | ✅ | r20: el hielo sílice se lee como el del banner sin decir hielo ni vidrio; el cuero curtido, igual |
| O5 | **Color por material descontando la luz del banner** (fría y apagada, o naranja rasante). | ✅ | r20: hoja incolora gris azulada, hueso crema, cuero tostado |
| O6 | **Lente `item`: 50 mm**, el término medio de los dos banners; deja leer el fondo. | 🔬 | r20: a favor en los dos; sin A/B con 85 mm (`IMG-23`) |
| O7 | **Un banner con muchos objetos se reduce a uno**; los demás, al fondo desenfocado en una frase. | 🔬 | r20: cuchillo a favor; un elemento |

## 10. Raza

Figura entera a 85 mm en 2,5:1: GPT la pone en el tercio izquierdo, a casi toda la altura, de tres cuartos hacia
dentro y en postura baja, con el entorno abierto a su derecha. [`r20-tipos.md`](banco/r20-tipos.md#raza).

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| R-Z1 | **La figura entera ocupa el tercio izquierdo y casi toda la altura** («full-length… filling the whole height of the frame on the left side»); el entorno se abre a la derecha por capas. | ✅ | r20: orco y faerus |
| R-Z2 | **La postura baja (agachado, encorvada) hace que quepa en 2,5:1**; se dice la flexión («crouched», «torso tilted forward at forty-five degrees»). | ✅ | r20: los dos |
| R-Z3 | **La cámara a la altura del pecho** («taken at chest height») y el horizonte en fracción del alto. | ✅ | r20: orco (0,42 → 0,44); el faerus no tiene horizonte |
| R-Z4 | **Las proporciones se miden en cabezas** (alto, hombros, brazos, piernas) con la unidad fijada (con pelo o cresta) y dicha en el prompt. | ✅ | r20: hombros de 2,9 cabezas salen macizos; brazos hasta la rodilla y 3 cabezas con cresta, encorvada |
| R-Z5 | **Una raza humanoide sin animal usa el tipo de criatura («orc») como ancla, con color, ropa y medidas dichos**: el modelo trae su verde y su armadura por defecto. | 🔬 | r20: orco arcilla tostada, sin verde; un elemento |
| R-Z6 | **La persona disfrazada se evita con rasgos que un humano no tiene** (colmillos inferiores, quijada, orejas, hombros de 2,9 cabezas). | 🔬 | r20: orco a favor; un elemento |
| R-Z7 | **El simio se evita con un ancla de postura («like a bear rearing up»), hocico corto con medida y cresta, no melena**; la cara no se compara con otro animal (F7). | 🔬 | r20: faerus sin simio ni oso; un elemento |
| R-Z8 | **La ropa y el equipo se dicen como material con forma** (capa de plumas, falda de tiras de cuero, vendas de cuerda), sin compararlos con otro objeto (F8); el arma lleva su tamaño relativo a la figura. | ✅ | r20: los dos |

## 11. Común a los tipos (r20)

| # | Pauta | Estado | Evidencia |
|---|---|---|---|
| T1 | **La línea fija `Style` gana a la luz del cuerpo cuando chocan**: con «soft golden-hour rim light, warm atmospheric haze» en la línea, un prompt que pide nublado o dosel cerrado sale a hora dorada. Remedio por medir: la línea sin la cláusula de luz, y la luz solo en el cuerpo. | ✅ el choque / 🔬 el remedio | r20: salvia y faerus a medias solo por esto, el cuchillo a medias; r20b mide el remedio |
| T2 | **Las fracciones del alto se siguen, y se dice desde qué borde** («a quarter of the way down from the top»); «a third of the way up» es ambigua. | ✅ | r20: 1/4 → 0,26 y 0,22; 0,42 → 0,44; el cardo a 0,4 por la ambigüedad |
| T3 | **La referencia manda sobre el canon en los cuatro tipos** (§5): los ocho prompts siguieron el banner donde contradice al texto (violeta, mata baja, volcanes, pantano, 18/10, músculo largo, ojos oscuros) y se leen como su banner. | ✅ | r20: los ocho; las contradicciones, en `r20-tipos.md` |
| T4 | **Un agente barato escribe un prompt de cualquier tipo con esta guía y el banner medido, sin retoque a mano**: seis de ocho a la primera. | ✅ | r20 (en fauna, r15 dio uno de ocho con la v1) |
