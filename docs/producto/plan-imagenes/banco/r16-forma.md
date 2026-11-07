# r16: aplicación de pautas.md v2 a los seis fallos de r15 (`IMG-21`, `IMG-22`)

Prompts `prompts/r16-sujeto-<especie>.txt` (220-280 palabras), escritos solo con [`pautas.md`](../pautas.md) v2, la
[plantilla](../plantilla-prompt.md), el banner y [`r15-forma.md`](r15-forma.md) (la lista de forma de cada especie sigue
valiendo). Sin generar todavía: el veredicto, contra el banner en rejilla, entra en `resultados.md` cuando corra la
tanda. Lienzo 512x192, salvo morvasa 384x320 (P7). Fondo verde, jusha en magenta y morvasa en azul (P6).

## cruzavientos

- **Ancla: águila harpía en vuelo** (silueta: cuerpo recio y corto, alas anchas y cortas de envergadura, cabeza con
  cresta). Es de silueta porque lo que falló en r15 no era la silueta, sino lo que la acompañaba (águila real con
  placas de pangolín); la harpía ya trae cuerpo pesado y cresta erguida en la cabeza.
- F7: las placas de la cabeza ya no se comparan con el pangolín: «thick, ridged, ivory bone plates with rough edges
  that grow out of the skin» y una corona de «horn-like» púas. Sin «feathers» en la cabeza.
- F8: la armadura crece de la piel; las placas son hueso, no un objeto.
- Cuerpo escamado como el banner: «small, overlapping, dark brown scales with a leathery sheen» en cuerpo y muslos,
  sin comparar con un reptil (F7); las plumas quedan solo en las alas.
- P8: sin dirección de vuelo; «the body is seen from the side». Se voltea en el montaje.
- Dificultades nuevas: la harpía añade cuerpo de plumas y cresta de plumas, así que el prompt tiene que luchar contra
  su propio ancla (plumas vs. escamas); la guía no dice si una ancla con rasgos que no se quieren compensa (y no hay
  ancla de rapaz escamada). El «pico ganchudo bajo, cabeza hacia abajo» del banner (casi en picado) no tiene pauta:
  P8 dice que no se controla la dirección, pero la inclinación del eje tampoco.

## espina-del-viento

- **Ancla: escorpión** (silueta: cuerpo bajo, cola en arco sobre el lomo, ocho patas). De silueta porque la cola
  arqueada con aguijón es justo lo que define al animal y el banner la comparte; las pinzas, que el banner dibuja como
  cuernos de marfil, se describen aparte y no con el ancla (F7).
- F7: nada de cochinilla; el caparazón son «a row of broad, overlapping bands that curve over the body, each wider than
  the one behind», con la primera banda «shaped like a rounded shield».
- F9: sin «seven plates» ni «four eyes»: «a row of» glossy black eyes.
- Pinzas: «long, slender, curved ivory horns... like polished tusks», sin la palabra pincer (el ancla ya trae pinzas
  de cangrejo).
- Dificultades nuevas: el escorpión del ancla trae pinzas gordas de escorpión de verdad y la pauta no dice cómo anular
  una parte del ancla sin negarla (no hay negaciones); se resolvió llamando «horns» a las pinzas. Para un artrópodo
  tampoco hay pauta de cuántas patas (se dejó «eight jointed legs», sabiendo que F9 dice que no se cumple).

## jusha-esmeralda

- **Ancla: mero gigante** (silueta: cabeza grande y roma, cuerpo hondo, dorsal espinosa continua, cola en abanico). Es
  de silueta porque el mero ya tiene el hocico romo y bulboso que el black bass no tenía; no lleva diferencia (F6b:
  la diferencia no pesa), así que no hay «only».
- F9: se quitó el «row of separate spines» contado; queda una hilera con membrana fina, como el banner.
- P6: fondo magenta liso, porque el pez es verde musgo.
- Pose: perfil lateral puro, sin cabeza girada (tabla de pose, pez).
- Dificultades nuevas: el banner es subacuático y oscuro; el prompt dice «daylight from the left» (P5) y la guía no
  dice cómo juzgar color y brillo azul de un sujeto que en el banner está a oscuras. Los dientes planos pálidos son un
  rasgo pequeño (F4) a 512 px; sin pauta para reforzarlos sin repetir ni negar. El mero real tiene labio grueso y es
  marino y moteado: puede contagiar lo moteado de la cabeza.

## gargantua-de-ceniza

- **Sin ancla** (F6b): el rinoceronte ganó a su diferencia en r15 y la armadura es lo que define a la criatura; se
  describe el plan corporal («huge, heavy, four-legged armoured beast with a barrel-shaped body... pillar-like legs»).
  Un hipopótamo habría dado la silueta de barril, pero su piel lisa es justo lo contrario de las placas.
- F8: sin armadillo: «thick, irregular, knobbly plates of pale, pitted, bone-coloured armour grow straight out of the
  hide, each a different size... a short, pointed spike on its edge».
- Placas también en la cabeza: «one heavy, spiked shield over the top of the head and the brow», que r15 no tenía.
- F2: las placas dicen dónde empiezan y acaban (hombros a base de la cola; cabeza aparte).
- Dificultades nuevas: sin ancla no hay ninguna silueta de la que partir y la guía no dice qué se pierde (escala,
  paso, anatomía de las patas); un rasgo irregular («each plate a different size») no tiene fórmula en la guía, solo
  F2 para lo continuo. Los cuernos mandibulares siguen mezclándose con colmillos de jabalí. La escala («tamaño de
  casa») no cabe sin entorno.

## guchapo

- **Sin ancla** (F6b): la rana toro ganó a «far rounder» en r15; lo que define al guchapo es la masa, así que se
  describe «one smooth, heavy, round mass shaped like a half-sphere resting on the ground» con la cabeza fundida en el
  cuerpo y las patas como muñones. Se probó mentalmente una tortuga como ancla de cúpula, pero trae caparazón.
- F9: la lengua no pide «tres puntas»: «splits into long, slender tips».
- Venas rosas: «fine pink veins beneath the translucent skin» en el vientre (faltaban en r15).
- Se quitaron la frase del vientre abultado y «larger, plumper male» para no pasar de 280 palabras; el «plumper» se
  cubre con la masa en sí.
- Dificultades nuevas: «masa» no tiene vocabulario en la guía; «half-sphere» es un objeto geométrico, no un animal,
  y no se sabe si F8 lo permite (se usó por ser forma, no material). El banner depende del agua (medio sumergido) y
  sobre fondo plano se pierde la línea de contacto; no hay pauta para un rasgo que depende del entorno.

## morvasa

- **Ancla: cobra real alzada** (silueta: tercio delantero erguido; cola y cuerpo en lazos aparte). Es de silueta
  porque en r15 la anaconda daba los lazos y la cobra el cuello alzado, y la S alzada es lo que falta; se nombra la
  cobra entera una vez (F7: no «con el cuello de una cobra»), sin diferencia.
- P7: lienzo 384x320 en el TSV y «a tall S-curve» en el prompt.
- F9: sin cuentas de lazos («heavy loops piled on the ground»); se mantienen «twelve heads long» (F1) y las dos aletas
  de piel.
- P6: fondo azul liso (lo cambió la sesión principal: el magenta se comería venas y bulbo).
- Dificultades nuevas: **el fondo magenta choca con el sujeto**: venas y bulbo de la morvasa son magenta brillante y
  el recorte por dominancia de rojo+azul se los comería; P6 pide un color que el sujeto no tenga y la guía no dice
  qué hacer cuando es verde y además magenta (¿cian? ¿azul?). Se siguió el encargo (magenta) y se apunta como riesgo.
  La cobra del ancla trae capucha y la serpiente del banner no la tiene: se intentó compensar con «keeps the same
  girth» (quitado por longitud). La cola en cuerno con bulbo sigue sin tener forma de pedirse más que describiéndola.

## Las dificultades más importantes con la guía

1. **No hay regla para anular un rasgo del ancla sin negarla** (plantilla: sin «no»): cruzavientos (plumas de la
   harpía), espina (pinzas del escorpión), morvasa (capucha de cobra). F6b dice «otra ancla o ninguna», pero un ancla
   limpia casi nunca existe; falta una pauta que diga cuánto pesa lo que se hereda y cómo contrarrestarlo en positivo.
2. **«Sin ancla» deja sin silueta y sin escala** (gargantua, guchapo). La guía no dice qué vocabulario sustituye al
   ancla: se improvisó «barrel-shaped», «half-sphere», «pillar-like». Falta un repertorio de formas de plan corporal.
3. **P6 se contradice con sujetos que tienen el color del fondo en detalles** (morvasa, venas magenta): hace falta
   decir cómo elegir el color de fondo por el conjunto de colores del sujeto, no solo su color dominante.
4. **Un rasgo irregular o de masa** (placas distintas, cuerpo en cúpula) no tiene fórmula: F2 es para lo continuo,
   F1 para medidas; no hay pauta de «cada placa distinta» ni de volumen sin patas ni cuello.
5. **Pequeños rasgos y entorno-dependientes** (dientes planos, venas, línea de agua, luz subacuática): F4 solo dice
   juzgarlos en un recorte; no cómo reforzarlos en el prompt sin repetirlos.
6. **Presupuesto de palabras**: con ancla única, medidas, material, color, pose y fondo, 220-280 palabras exigen
   recortar rasgos del banner (guchapo perdió «macho más grande»); la guía no dice qué rasgo sacrificar primero.
