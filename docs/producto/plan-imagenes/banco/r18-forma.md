# r18: jusha-esmeralda, F10 con perfil de profundidad y la ancla de la cabeza (`IMG-21`, `IMG-22`)

Prompt `prompts/r18-sujeto-jusha-esmeralda.txt` (279 palabras), escrito solo con [`pautas.md`](../pautas.md) v4 (F6b, F6c,
F10, F10b), la [plantilla](../plantilla-prompt.md), [`r17-forma.md`](r17-forma.md) y el veredicto de r17 (mejora, pero la
silueta sigue siendo de perca: cabeza corta y alta, cuerpo alto). Banner `jusha-esmeralda-macho-banner.png` (1983x793),
medido sobre una versión aclarada con rejilla de 100 px (`ffmpeg crop,eq,drawgrid`), a ojo sobre la rejilla (error de
unos 10-15 px) y con medias de color de recortes. Sin generar. `r18-sujetos.tsv` no lleva columna de semilla: las dos (3
y 7, R1) las pone quien lance la tanda. Lienzo 512x192, fondo magenta (P6), como en r17.

**Convención de medida** (cita el «Abierto» del denominador de `pautas.md`): longitud total de hocico a punta de cola;
profundidad máxima del cuerpo **sin** espinas de la dorsal ni aletas del vientre.

## jusha-esmeralda

### Medidas en el banner (píxeles)

| Qué | Píxeles | Relación |
|---|---|---|
| Hocico (x≈1495) a punta de cola (x≈312) | 1183 | **~4,1 de largo/hondo** |
| Profundidad máxima (lomo y≈250, vientre y≈540, hacia x≈1000-1100) | ~290 | 1 |
| Hocico a borde del opérculo (x≈1130) | ~365 | **1,25 de profundidad = 0,31 del largo total** |
| Profundidad de la cabeza en el borde del opérculo | ~255-290 | **≈ la del cuerpo**: la cabeza no es más estrecha, el lomo baja en una sola línea hasta el hocico (sin escalón ni cuello) |
| Punta del hocico (y≈445) | 0,67 de la profundidad bajando desde el lomo | **por debajo de la línea media** (y≈395): hocico bajo, cúpula roma |
| Boca (y≈485, de x≈1270 a 1465) | ~195 de largo = 0,67 de la profundidad | corta, baja, casi recta; dientes cuadrados claros |
| Ojo (centro ≈1288,387) | ~40 de diámetro = **0,14 de la profundidad** | pequeño, alto en la cabeza, **sobre la comisura de la boca**; a 0,57 de la cabeza desde el hocico |
| Pedúnculo (x≈550) | ~80 de hondo = **0,28 de la profundidad** | estrecho |
| Perfil de profundidad por x | 290 (1000-1100), ~235 (750), ~165-190 (650), ~80 (550) | **huso: lo más hondo justo detrás de la cabeza**; el vientre queda llano y el lomo baja en línea larga; el estrechamiento a pedúnculo es rápido (~100 px) |
| Cola (x 312-480) | 235 de alta (0,8) por ~170 de larga | abanico ancho, borde casi recto, **no ahorquillada** |
| Dorsal espinosa (x 560-1130) | ~570 = 0,48 del largo total; espinas más altas ~60 = **0,2 de la profundidad** sobre los hombros (x≈900-1000) | **única aleta del lomo**; empieza en la nuca y **termina ~80 px antes del pedúnculo**; espinas inclinadas hacia atrás, bajas en los dos extremos |
| Pectoral (x 945-1085, y 450-525) | 140 x 80 = **0,5 de la profundidad** de largo | mediana, en abanico, **baja** tras la agalla |
| Ventrales y anal | ventral ~110 x 75 bajo el vientre; anal ~125 x 80 hacia x 585-710 | pequeñas y oscuras |

### Colores por material (F10b)

Las medias de recorte salen casi negras y teñidas de verde agua (dorso `#223f44`, mejilla `#1b2c21`, hocico `#394c4a`,
banda azul `#061616`, fondo de agua `#030b0d`), con luminancia ~20/255: ninguna cuenta en un prompt. Se aclaró el
banner, se quitó la dominante y se decidió a ojo, igual que en r17 (esos colores acertaron):

- dorso **verde oliva musgo** con brillo azulado en el flanco alto; **banda azul cobalto oscuro** por la mitad del flanco;
  vientre **gris verdoso oscuro**; escamas **grandes** y solapadas (r17 decía «small»: el banner las tiene gruesas y bien marcadas);
- cabeza **moteada oliva y gris azulado pálido** (liquen sobre piedra), con motas oscuras; **hocico gris verdoso pálido**;
  dientes **marfil**; aletas **verde azulado oliva oscuro**.

### Ancla: sí, bowfin (y no lucio, barracuda ni gar)

El problema de r17 es una cabeza y una silueta que el modelo rellena con el pez por defecto (perca) cuando no hay ancla
(F6b: la silueta la da el ancla). Se pidió una ancla de **cabeza larga y roma, cuerpo en torpedo y cola en abanico**. Se
comparan cuatro:

| Ancla | Trae | Choca con el banner | Veredicto |
|---|---|---|---|
| Lucio | hocico plano en pico de pato, dorsal retrasada junto a la cola, cola ahorquillada | hocico puntiagudo frente a cúpula roma; dorsal a mitad del lomo; cola de abanico | no |
| Barracuda | hocico en punta, colmillos grandes, dos dorsales separadas, cola ahorquillada | las tres cosas | no |
| Gar | hocico de aguja, escamas de rombo, dorsal retrasada | la cabeza es lo contrario de una aguja | no |
| **Bowfin** | **cabeza ancha, roma y redondeada; torpedo; cola de abanico redondeado; dientes; cabeza moteada de verde oliva; pectorales en abanico** | dorsal larga y blanda (el banner, la mitad del lomo y espinosa); ocelo en la cola; sin pedúnculo marcado | **sí** |

Los tres peces de hocico largo traen **justo lo que el banner contradice** (F6c): una cabeza puntiaguda donde el
banner tiene una cúpula, y como F6b dice que el ancla gana a su diferencia, «only with a blunt snout» no la giraría. El
bowfin trae el rasgo que falta (la cabeza roma y honda) y los rasgos que sobran (dorsal larga, ocelo, sin pedúnculo) los
cubre el resto del prompt, que los dice con medida: dorsal espinosa solo en la mitad del lomo, pedúnculo a un tercio,
cola en abanico de borde recto. Es el único cambio de ancla de la ronda; **si sale una dorsal corrida hasta la cola o
una cola redonda sin pedúnculo, es el ancla** y se vuelve a no llevar ninguna (R2: no hay tercera ronda). F7: el ancla
es del animal entero, no de una parte, para que no contagie solo la cabeza al cuerpo.

### Cambia frente a r17

- **Cabeza** (la causa de la perca): «tan honda como el cuerpo» y «el lomo baja en una sola línea hasta el hocico» (r17
  decía «long, blunt head» y salió con la cabeza corta y alta, según su veredicto); hocico bajo («set low»); la cifra 1,25 se mantiene, y se
  añade su equivalente respecto al largo total en el banner (0,31) como comprobación, no en el prompt.
- **Ojo**: pequeño y sobre la comisura (r17 decía «large»); en el banner mide 0,14 de la profundidad.
- **Cuerpo**: huso, lo más hondo tras la cabeza, lomo que baja y vientre llano, pedúnculo a **un tercio** de la
  profundidad (r17 «narrow», sin número) y cola de **borde recto** (r17 dijo «broad fan tail» y salió abierta y algo escotada).
- **Aletas**: una sola dorsal, espinosa, en la mitad del lomo, la más alta sobre los hombros (r17 «to the tail stalk»:
  corría hasta el pedúnculo y en las dos semillas salió una aleta blanda delante de las espinas); pectoral **mediana y baja** (r17 «big»).
- **Se mantiene** lo que funcionó: 4 veces, dorsal espinosa de 1/5 de la profundidad, banda azul cobalto, dientes
  cuadrados, colores por material, fondo magenta y luz desde la izquierda. Sale lo de «predatory fish with a long, blunt
  head» (la ancla lo dice mejor), «freshwater» sigue fuera, y «small» de las escamas pasa a «large».

## Dificultades nuevas (lo que la guía no dijo cómo hacer)

1. **Qué ancla vale cuando la referencia es de cabeza larga *y roma*.** F6b dice elegir por silueta y F6c, que no traiga
   rasgos de más, pero no da un método para ordenar candidatos: los peces de cabeza larga más conocidos (lucio, barracuda,
   gar) la tienen puntiaguda, lo contrario del banner, y el que casi acierta (bowfin) trae una dorsal que el banner no
   tiene. Se hizo una tabla «trae / choca» a ojo; falta una regla (p. ej. que el rasgo medido en el banner decida y los
   rasgos extra se «paguen» con una medida explícita en el prompt) y comprobar si el modelo la sigue.
2. **Un cuerpo que no tiene una sola profundidad.** F10 y el «Abierto» del denominador piden un número; un pez en huso
   necesita un **perfil** (290, 235, 165, 80 px según x) y la guía no dice si se pide el perfil, el máximo, o la forma
   («deepest just behind the head, narrowing to a third»). Aquí se dijeron la forma y dos números (4 veces, un tercio en
   el pedúnculo), y la cabeza se midió también en fracción del largo total sin ponerla en el prompt: no se sabe si decir la
   misma medida de dos maneras ayuda o confunde.
3. **Una cabeza «sin escalón» en positivo.** La regla de la plantilla (sin negaciones) obliga a decir «the head is as deep
   as the body» y «one smooth line», en vez de «no neck, no step»; no hay forma de saber antes de generar si el modelo
   lo entiende, y la guía no recoge cómo probar una frase de continuidad.
4. **Cambiar varias cosas a la vez impide saber cuál movió la forma.** R1 pide dos semillas por pauta, pero esta ronda
   cambia ancla, cabeza, ojo, aletas y cuerpo juntos (como las demás de la serie). Si mejora no se sabrá si
   fue el bowfin o la profundidad de la cabeza; si empeora, tampoco. Falta una regla de cuándo se aísla una variable (un
   A/B del ancla con el mismo prompt y las dos semillas cuesta ~25 min más) y cuándo se acepta el paquete (R2 limita las
   rondas, no las variables por ronda).
5. **Medir el color con una luminancia ~20/255.** F10b dice «descontar la dominante», pero a ese nivel de luz la media
   de un recorte no distingue un verde de un azul (dorso `#223f44`, banda azul `#061616`); hizo falta aclarar el banner
   a ojo. La guía no dice con qué aclarar ni hasta dónde fiarse, ni que el color de r17 (ya validado) valga como base
   cuando la medida no discrimina.
