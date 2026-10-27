# r15: listas de forma y dificultades con la guía (`IMG-21`, `IMG-22`)

Prompts escritos solo con [`pautas.md`](../pautas.md), el banner y el canon de cada especie, sin retoque. Cada lista
se juzga contra el banner (sí / parcial / no). Las dificultades son lo que la guía no supo resolver.

Dificultades comunes (se repiten en las ocho):

- **Canon y banner no coinciden y la guía no dice cuál manda.** Se siguió el banner (la prueba es igualarlo), pero
  Morvasa (venas magenta, cola con bulbo), Guchapo (ojos arriba, no bajo la boca) y Nuente (máscara de piedra, boca
  redonda) añaden lo que el canon no dice o lo contradice.
- **P1 solo está pensada para cuadrúpedos de perfil.** Para ave en vuelo, pez, serpiente y sapo agazapado hubo que
  inventar la variante («cuerpo de perfil, cabeza a tres cuartos» se mantuvo, pero con otro cuerpo).
- **F1 pide «medidas del propio cuerpo» pero no dice con qué referencia medir** en un cuerpo sin cabeza clara
  (artrópodo, serpiente, sapo): se inventó la unidad (placas, cabezas, «ocho cabezas de largo»), sin saber si el
  modelo la respeta.
- **Fondo verde sobre criaturas verdes** (Jusha, Morvasa, Guchapo en parte): P4 no dice cómo evitar que el recorte
  por dominancia del verde se coma el sujeto; se dejó el prompt y se apunta como riesgo de recorte.
- **Encuadre 512x192 contra sujetos de forma extrema** (ala a ala, serpiente en pie): la guía no dice cuándo
  cambiar el aspecto del sujeto (F4 solo habla de rasgos pequeños).
- **Sin pauta de textura** (escamas, placas, verrugas, pelaje): F3 da color por material, pero la textura que sale
  en el banner (piel traslúcida, venas bajo la piel) se escribió a ojo.

## corretolvas (banner: ave corredora con cresta)

Lista de forma:
1. Cuerpo hondo y bajo, inclinado hacia delante; cuello corto y bajado, tronco ~4,5 cabezas.
2. Cresta carmesí de plumas largas, ancha, que sube y se curva atrás desde la frente hasta la nuca; las más largas, ~1 cabeza.
3. Pico gris grueso y ganchudo, ojo ámbar redondo, cabeza pequeña.
4. Patas finas y escamosas, largas como el tronco de hondo, con tres garras negras curvas.
5. Cola larga en forma de haz de plumas, mismo color óxido y negro.
6. Plumaje de escamas rojizas con borde oscuro; pecho moteado.
7. Pose: cuerpo de perfil mirando a la derecha, cabeza a tres cuartos.

Dificultades con la guía:
- El canon solo dice «tamaño pequeño, corredora, incapaz de volar»: cresta, color y garras salen del banner. La guía no
  dice qué hacer con un canon casi vacío.
- El cuerpo cae en diagonal (cola abajo-atrás); no hay pauta para expresar una inclinación de eje, solo proporciones.
- Ancla «roadrunner» con diferencia («thicker, towering crest»): F6 vale, pero una ancla puede traer su propia cresta pequeña.

## cruzavientos (banner: rapaz en vuelo)

Lista de forma:
1. Alas muy largas y anchas, ala a ala ~3 veces el cuerpo; tramo de plumas negras con borde rojo.
2. Cabeza y hombros cubiertos de placas óseas marfil, con una corona de púas hacia atrás desde la frente.
3. Pico largo, pálido y muy ganchudo; ojo ámbar.
4. Garras negras curvas, patas colgando hacia delante.
5. Cuerpo corto y recio, de perfil, cabeza ladeada hacia abajo a tres cuartos.
6. Alas levantadas y abiertas, volando hacia la izquierda.
7. Placas marfil y plumas oscuras como los dos materiales (F3).

Dificultades con la guía:
- **No hay pauta para ave en vuelo.** P1 no vale: se mantuvo «perfil + cabeza a tres cuartos» por analogía, sin base.
- Un sujeto de 3 veces su cuerpo de ala a ala no cabe en 512x192 sin recortar las puntas; la guía no dice qué aspecto pedir.
- «Armadura de placas» sin ancla propia: se usó pangolín como ancla del material, cosa que F6 no prevé (ancla de rasgo, no de animal entero).
- El banner pone el cuerpo en picado (diagonal); no hay pauta de ángulo, solo de perfil.

## espina-del-viento (banner: artrópodo tipo escorpión)

Lista de forma:
1. Cuerpo plano y ancho, ~3 veces más largo que alto, de siete placas anchas solapadas (como una cochinilla).
2. Cola en un solo arco continuo sobre el lomo, anillada con púas negras, con bulbo de veneno rojo translúcido y aguijón con zarcillos.
3. Dos pinzas largas, finas, curvas, color marfil, tan largas como el cuerpo.
4. Cuatro ojos negros brillantes en fila en la placa de la cabeza.
5. Caparazón rojo pardo con bordes más claros; patas rojas con articulaciones oscuras.
6. Ocho patas articuladas visibles de perfil.
7. Pose: de perfil mirando a la izquierda.

Dificultades con la guía:
- **P1 («cabeza a tres cuartos con los dos ojos») no tiene sentido en un artrópodo**: se adaptó a «todos los ojos visibles».
- F2 sirve (cola «en un solo arco continuo»), pero la guía no dice cuántas patas ni cómo contar apéndices repetidos.
- El canon dice «un metro de altura, se entierra»: contradice el banner (cuerpo largo y bajo) y no se sabe si se pide en el prompt.
- «Seven plates» es un número que el modelo suele ignorar; no hay pauta sobre contar segmentos.

## jusha-esmeralda (banner: pez)

Lista de forma:
1. Cuerpo profundo, ~3 veces más largo que alto; cabeza larga como el cuerpo de alto.
2. Hocico romo y redondeado, boca baja y ancha con fila de dientes planos pálidos.
3. Aleta dorsal de espinas separadas, triangulares, cada una ~1/4 de la altura del cuerpo.
4. Cola grande en abanico, tan alta como el cuerpo.
5. Escamas verde musgo con brillo azul oscuro en los flancos; cabeza moteada gris verdosa.
6. Ojo grande, redondo y oscuro.
7. Pose: de perfil mirando a la derecha, flotando.

Dificultades con la guía:
- **Pez: no hay cabeza que gire ni pose**; P1 se reduce a «perfil», y los dos ojos no se ven a la vez.
- Verde musgo sobre fondo verde croma: el recorte por dominancia (P4) puede comerse el pez (riesgo, sin pauta).
- La aleta «sin membrana» del canon sale en el banner como espinas unidas por membrana fina; se siguió el banner.
- El banner es una escena oscura y subacuática; el sujeto con «daylight from the left» (P5) cambia la luz del banner
  sin que la guía diga cómo juzgar el color en ese caso.

## morvasa (banner: serpiente)

Lista de forma:
1. Cuerpo muy largo y grueso en tres lazos, el tercio delantero levantado en S alta.
2. Cabeza en cuña con aletas de piel que se abren detrás de las mandíbulas y cresta de púas desde la frente.
3. Boca abierta con dos colmillos largos y curvos que gotean.
4. Cola que acaba en punta curva en forma de cuerno con un bulbo magenta brillante.
5. Escamas verde oliva y pardo en el dorso, gris plata en los flancos, red de venas magenta brillantes.
6. Ojos pequeños, rosas.
7. Pose: enroscada, cabeza erguida a tres cuartos mirando a la derecha.

Dificultades con la guía:
- **Serpiente enroscada: la guía no dice cómo describir un lazo ni cómo medir un cuerpo sin patas**; «doce cabezas de
  largo» es invención mía.
- El banner tiene detalles que no están en el canon (venas magenta, bulbo, aletas); la guía no dice si se imitan.
- El canon dice «esbelta»; el banner es gruesa. F1 pide medida del propio cuerpo y por eso se midió el cuello en cabezas.
- «Enroscada» con una pose de tres lazos es difícil de forzar sin boceto (F5): hace falta una plantilla de serpiente.

## guchapo (banner: anfibio enorme y redondo)

Lista de forma:
1. Cuerpo en cúpula, más ancho que alto, ~1,5 veces más largo que alto.
2. Dos ojos grandes, amarillo verdosos, con pupila vertical negra, en lo alto de la cabeza.
3. Verrugas en relieve por la frente y el lomo.
4. Lengua rosa larga y brillante, partida en tres puntas, colgando de los labios.
5. Dorso moteado miel, ocre y oliva; vientre crema con venas rosas visibles.
6. Patas delanteras cortas y gruesas, apoyadas.
7. Pose: sentado, de perfil a la derecha, cabeza a tres cuartos.

Dificultades con la guía:
- **El canon (ojos bajo la boca, frente hinchada) no es lo que dibuja el banner** (ojos arriba); se siguió el banner.
- Forma redonda sin cuello ni patas: no hay pauta de «masa» (volumen) más que proporciones largo/alto.
- El banner lo muestra medio sumergido en agua con vientre abultado; sobre verde se pierde la línea de agua, y la
  guía no dice cómo tratar un rasgo que depende del entorno.
- «Macho» sin diferencia en el canon: la frase de variante («larger, plumper») es inventada.

## gargantua-de-ceniza (banner: cuadrúpedo acorazado pesado)

Lista de forma:
1. Cuerpo en barril, ~1,5 veces más largo que alto, cabeza pequeña y baja.
2. Cuatro patas gruesas como pilares con pies redondos y anchos.
3. Placas óseas irregulares, picudas, del color del hueso viejo, sobre cabeza, hombros y lomo.
4. Flancos de piel gris oscura arrugada con pliegues como costillas entre las placas.
5. Cuernos curvos oscuros: uno a cada lado de la mandíbula y uno corto en el hocico.
6. Cola corta.
7. Pose: caminando a la derecha, de perfil, cabeza a tres cuartos.

Dificultades con la guía:
- **El canon dice «reptil herbívoro del tamaño de una casa»; el banner es un mamífero cornudo**: manda el banner.
- La escala (tamaño de casa) no se puede expresar sin referencia; sin entorno el sujeto parece un animal normal.
- F2 se aplicó a las placas (principio y fin), pero la guía no dice cómo describir un rasgo irregular (placas distintas).
- Los cuernos mandibulares cruzan con el hocico: sin boceto, el modelo suele mezclarlos con colmillos de jabalí.

## nuente (banner: cuadrúpedo pequeño con alas de membrana)

Lista de forma:
1. Cuerpo agazapado, giba redondeada, ~3 cabezas de largo.
2. Cabeza como máscara de piedra pálida de lechuza, con dos orejas altas y estrechas.
3. Ojos redondos grandes que brillan azul pálido, con aros oscuros.
4. Boca circular abierta, con filas de dientes (como una lamprea).
5. Un ala de membrana plegada al hombro con huesos de dedo largos.
6. Pelaje largo y espeso blanco con mechones azul marino en patas, vientre y cola.
7. Garras negras largas en los cinco dedos; pose agazapada, de perfil a la derecha, cabeza a tres cuartos.

Dificultades con la guía:
- **El banner pone la cabeza casi de frente**, no a tres cuartos; P1 se mantuvo pero el modelo puede girarla.
- Mezcla de animales («rana, murciélago, búho, golem»): F6 pide una ancla con su diferencia y aquí hacen falta tres
  a la vez; se usó gato + murciélago, y el búho en la cabeza. No hay pauta de anclas múltiples.
- El canon dice «cuerpo de rana»; el banner dibuja un gato peludo. Manda el banner.
- «Pale stone mask» como material de cabeza dentro de un cuerpo de pelo: F3 (color por material) no cubre un cambio de
  material dentro de un mismo animal.
