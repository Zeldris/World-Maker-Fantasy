# r17: aplicación de F10 (medir en el banner) a los seis fallos de r16 (`IMG-21`, `IMG-22`)

Prompts `prompts/r17-sujeto-<especie>.txt` (261-278 palabras), escritos solo con [`pautas.md`](../pautas.md) (con F10),
la [plantilla](../plantilla-prompt.md), [`r16-forma.md`](r16-forma.md), [`r15-forma.md`](r15-forma.md) y el banner, que
se miró y se midió (ancho 1983x793; medidas en píxeles del banner, a ojo sobre la imagen y con medias de color en
recortes con ffmpeg). Sin generar. `r17-sujetos.tsv` no lleva columna de semilla: las dos (3 y 7, R1) las pone quien
lance la tanda. Lienzo 512x192, salvo morvasa 384x320. Fondo verde; jusha magenta; morvasa azul.

**Cómo se midieron los colores.** Las medias de recorte (p. ej. placas del gargantúa `#553c30`, caparazón de la espina
`#5c231b`) vienen teñidas por la luz del banner (atardecer naranja en cuatro, subacuático oscuro en jusha); se usaron
como pista y se decidió el color del material a ojo, **bajando el naranja de la luz** («cream-beige», no el
`#9a7054` que da la media). Esto es dificultad nueva 1.

## cruzavientos

- **Medidas:** envergadura ~1750 px frente a torso (pecho a base de cola) ~480: **~3,5 torsos**; cabeza (coronilla a
  pico) ~280 = **~0,6 del torso**; cuerda del ala ~350 frente a cuerpo hondo ~230 = **~1,5**. Eje del cuerpo en picado
  ligero, cabeza baja, patas colgando adelante, alas en V hacia arriba.
- **Colores por material:** placas de cabeza y hombros **gris hueso y crema apagado** (no «marfil»), cara y cuello
  oscuros; pico gris pálido; vientre y muslos **pardo umbra oscuro, escamas de cuero**; plumas de vuelo **negras, las
  bajas con borde rojo oscuro**; garras negras.
- **Ancla:** se mantiene el águila harpía (r16 dio silueta de ancla, 5/7, y lo que falló fue el color). Su cresta de
  púas coincide con la del banner, así que no contamina. F6b.
- **Cambia frente a r16:** envergadura 3,5 y no 3; cabeza 2/3 del torso (antes 1/3); «marfil» fuera, hueso gris;
  cuerpo umbra oscuro; borde rojo solo en las plumas bajas; picado dicho («tilted in a shallow dive»).

## espina-del-viento

- **Medidas:** cuerpo (cabeza a final del caparazón) ~740 px por ~190 de alto: **~4 largo/alto**, no 3; estrecho en
  cuña hacia la cabeza; cola ~igual de larga que el cuerpo, sube desde atrás en un arco y cuelga el bulbo sobre el
  centro del cuerpo; pinzas-cuerno ~400 = **~0,55 del cuerpo**; el cuerpo va alzado sobre patas largas; 6-7 secciones.
- **Colores:** caparazón **granate oscuro** (`#5c231b`) con filo rojo anaranjado; patas rojo pardo con articulaciones
  oscuras; cola **óxido anaranjado** con púas negras; bulbo **rojo anaranjado translúcido**; cuernos **rojo anaranjado
  la primera mitad y marfil la punta** (no marfil entero); cuatro ojos negros brillantes en la cuña de la cabeza.
- **Ancla:** escorpión una vez (el arco de cola lo define y el banner lo comparte), pero se sacó de F7b lo que traía
  la cochinilla: fuera «broad overlapping bands» y «rounded shield»; ahora **«six shallow grooves» sobre un caparazón
  liso y una cuña de cabeza puntiaguda**, que es lo que mide el banner (alargado y estrecho, no ovalado y abovedado).
- **Cambia:** 4 y no 3; colores del banner (r16 pedía caparazón rojo pardo y cuernos de marfil); pinzas con
  «pincer at its base» (el banner las tiene) y hoja larga; ojos 4 (aunque F9 diga que no se cumple, ahora solo «four»
  junto a «all eyes showing»); espinas solo en la mitad trasera.

## jusha-esmeralda

- **Medidas:** longitud total ~1180 px, profundidad máxima ~290: **~4 veces** (3,5 hasta la base de la cola; la r16
  decía 3 y la nota de r16 ~4,5; el valor real depende de si se incluye la cola); cabeza (hocico a opérculo) ~365 =
  **1,25 veces la profundidad**; cola ~240 de alta (~0,85 de la profundidad), con pedúnculo estrecho; espinas de la
  dorsal ~1/5 de la profundidad (en r16 ~1/4); dorsal desde detrás de la cabeza hasta el pedúnculo; pectoral grande en
  abanico detrás de la agalla.
- **Colores:** dorso **verde musgo oliva**, **banda azul cobalto oscuro por mitad del flanco**, vientre gris verdoso
  oscuro; cabeza **moteada oliva y gris verdoso pálido, hocico gris pálido**; aletas verde azulado oscuro; boca corta,
  baja y casi recta, con dientes cuadrados pálidos en el labio inferior; ojo alto.
- **Ancla: ninguna** (F6c): ni mero ni «freshwater fish, deep body», que llamaba al black bass. Plan corporal en
  «torpedo-shaped predatory fish» + cifras. El mero de r16 no cambió la forma.
- **Cambia:** sin «freshwater» ni «deep body»; cuerpo alargado y cabeza larga y roma (el banner se parece más a un pez
  de cabeza larga y pedúnculo estrecho que a un perca); banda azul y moteado de cabeza, que r16 no tenía.

## morvasa

- **Medidas:** cuello levantado ~220 px de grosor y cabeza ~270 de larga: **cuello ~0,8 de la cabeza**, bien grueso;
  cada lazo del cuerpo ~250 de grosor (**igual que el cuello**); tres lazos apilados en pirámide baja; del lazo de
  arriba a la cabeza ~1,6 cabezas; cola sube por la izquierda hasta un **bulbo esférico** con un **cuerno en
  media luna** que cae de él; alto del conjunto ~600 frente a ancho ~700.
- **Colores:** dorso **verde oliva caqui oscuro**, flancos en **bandas anchas gris plata**, vientre y frente del cuello
  **rosa blanquecino**, **venas magenta brillantes** sobre plata y vientre, bulbo magenta brillante, ojos rosas.
- **Ancla: ninguna** (F6c). La cobra de r16 dio un solo lazo plano y la capucha; el banner no tiene capucha y sí
  **aletas foliáceas** de piel tras la mandíbula, cabeza plana en cuña y pila de lazos. Se describe el plan corporal con
  el espesor medido en lazos y cuello.
- **Cambia:** pila de tres lazos con igual grosor (r16 pidió «heavy loops piled», no lo cumplió); «twelve heads long»
  fuera; bulbo + cuerno en vez de «horn-shaped tip holding a bulb»; bandas plata en flancos (r16 «silver grey along the
  flanks» pero sin dorso oscuro); aletas en forma de hoja.

## guchapo

- **Medidas:** el banner **no es de perfil**: vista casi frontal, de tres cuartos desde delante. Cúpula de ~1270 px
  de ancho por ~590 de alto sobre el agua: **~2,1 de ancho/alto** (r15/r16: 1,5). Boca ~550 = **~0,4-0,45 del ancho**;
  ojos grandes (~130 px de diámetro) **sobre lo alto del frente, separados ~340 px**, a ras de la cúpula; **bolsa
  de la garganta pálida y abultada** bajo la boca, que es todo el frente inferior; dos antebrazos gruesos y bajos apoyados
  a los lados (~200 de ancho, ~1/6 del ancho); verrugas en racimos sobre la frente y la cúpula; lengua gruesa, brillante,
  que cuelga por debajo de la barbilla y se parte en puntas largas (**dos largas y una más fina** a ojo).
- **Colores:** dorso **canela miel moteado de oliva oscuro y pardo**; lados que **se aclaran a crema verde salvia**;
  garganta y vientre **marfil cremoso con venas rosas finas** bajo la piel; lengua **rosa lila**; ojos amarillo verdoso
  con pupila vertical negra; miembros pardo oliva moteado.
- **Ancla: ninguna**, pero el cambio es de **pose y vista**, no de palabras: de «sentado de perfil con la cabeza
  girada» a «vista de frente, un poco desde la derecha, ojos a ras de la cúpula, sin cuello» (el sapo de r16 salía con
  la cabeza alzada porque el prompt la nombraba como parte aparte). Se quitó «half-sphere» y «frog-like».
- **Cambia:** vista; 2,1 y no 1,5; bolsa de garganta (no existía); boca recta y larga en el frente; fuera la
  descripción de la cabeza como un bulto distinto.

## gargantua-de-ceniza

- **Medidas:** cuerpo ~640 px (grupa a pecho) por ~360 de hondo (del lomo sin púas al vientre): **~1,75**, no 1,5; con
  púas y patas hasta el suelo el conjunto mide 820x590 (1,4); cabeza ~330 = **~0,5 del cuerpo**; patas gruesas, ~180 de
  ancho (~**1/2 de la profundidad**) y arrugadas como las de un elefante; cuerpo acostado hacia delante, cabeza baja.
- **Colores:** losas **beige crema y gris** (no «bone-coloured with grey-brown stains»: eso salió amarillo);
  flancos, vientre y patas **marrón umbra grisáceo oscuro**; cuernos **marrón grisáceo oscuro**, base más clara.
- **Forma:** las losas **están de canto a lo largo del espinazo y miran hacia arriba y atrás** (cresta dentada), con
  losas menores apiladas sobre hombros y caderas como tejas, y una **lámina grande acampanada y espinosa** sobre la cabeza
  (la r16 las puso «layered thickly over the whole back»: losas planas encima, el fallo F8 sin resolver); **flancos
  acanalados** en estrías verticales paralelas, como pared de chapa ondulada.
- **Ancla: ninguna** (F6b/F6c, lo único de r16 que se acercó). Cuernos: uno a cada lado de la mandíbula inferior y uno
  largo en el hocico (r16 «shorter horn»; el banner lo tiene largo).
- **Cambia:** losas de canto en cresta en vez de capas encima; flancos acanalados; patas ~1/2; 1,75; colores más claros
  y menos amarillos; pata levantada («one front foot lifted») para el paso.

## Dificultades nuevas (lo que la guía no dijo cómo hacer)

1. **El color medido está teñido por la luz del banner y la guía no dice qué hacer.** F10 pide medir colores, pero la
   media de un recorte es «naranja de atardecer» en cuatro de los seis y «azul oscuro» en jusha. Hace falta una pauta de
   medir el **color propio del material** (la zona más iluminada de frente, o restar la dominante de la luz) y decir que
   el prompt lleve ese y no el aparente; aquí se hizo a ojo.
2. **Qué medir cuando el banner no es de perfil.** F10 habla de «largo frente a alto», pero el guchapo está de
   frente y el gargantúa, de tres cuartos con escorzo. La proporción medida depende de la vista; falta decir si se
   pide la vista del banner (frontal) en vez de la del plan corporal de la tabla de pose (sentado de perfil).
   Aquí se cambió la pose del guchapo para igualar el banner, contra la tabla.
3. **Qué medida se cuenta en un pez o un ave en vuelo.** «4 veces» sale con o sin cola, o con o sin plumas de punta
   de ala; la r16 y la nota de resultados dan 3 y 4,5 sobre la misma imagen. F10 no dice si el denominador es la
   longitud total, la estándar o la profundidad máxima con o sin aleta.
4. **La guía no dice cuánto pesa cada medida para el modelo.** Con numeros relativos («one and a quarter times»), «about»,
   «twice», no se sabe si el modelo distingue 1,5 de 2,1. Hay que añadir qué números distingue (por ejemplo, entre
   «a half», «twice», «four times»).
5. **Cómo describir una forma que es dos animales comunes a la vez** sin llamarlos: el guchapo es un sapo (no se puede
   no parecer sapo en la cara), la espina un escorpión con segmentos de crustáceo. F6c dice evitar la firma, pero a veces
   la firma **es** el banner. No hay criterio para decidir cuándo parecer el animal por defecto es aceptable (aquí: sapo
   sí en la cara, no en la pose elevada).
6. **Una pose que depende del entorno** (guchapo medio hundido en agua, jusha en agua oscura): sobre fondo liso la
   línea de contacto o el agua se pierden; la guía no dice cómo sustituirla. Se usó «squatting on the ground» y se
   quitó por palabras (queda «forelimbs rest flat on the ground»).
7. **Rasgos ornamentales que se repiten pero que F9 no deja contar** (seis surcos, cuatro ojos, tres lazos, dos
   aletas): aquí se contaron igual por ser pocos y se anota como riesgo. F9 debería distinguir «contar hasta 3-4» de «contar
   7».
8. **Una escala de palabras fija** (261-278 palabras) obliga a sacrificar rasgos pequeños (dientes del pez, cola con cuerno,
   tendrils); la guía sigue sin criterio de qué sacrificar (ya estaba en r16, punto 6).
9. **Parte del cuerpo con dos materiales** (cuerno rojo la primera mitad y marfil la punta; cabeza de hueso sobre cara
   oscura): F3 no cubre un degradado de color dentro de una pieza.
10. **El fondo azul con un sujeto verde y plata** (morvasa) y el magenta con un pez verde y azul (jusha) funcionan en
    r16, pero P6 sigue sin una regla por colores del sujeto; ahora se mantiene lo de r16.
