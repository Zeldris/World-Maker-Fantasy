# Helek Sirik — motor y producto

Vocabulario del motor del juego y del producto. El lore canónico vive en `docs/rpgtarkor/` y no se
redefine aquí: los términos de lore se enlazan.

## El mundo de una partida

**Catálogo**:
El mundo tal como está escrito, del que parte cada partida; nunca cambia jugando.
_Evitar_: mundo compartido

**Mundo de la partida**:
La copia viva del catálogo que pertenece a una sola partida y evoluciona solo con lo que pasa en ella.
_Evitar_: mundo global

**Reino**:
La facción que funda la jugadora; la única de su partida que no procede del catálogo.

## Libro de Sucesos

**Suceso**:
Algo que ha pasado en una partida y queda escrito en su Libro, con sus actores y sus causas.
_Evitar_: evento, log

**Efecto**:
Un cambio concreto del mundo de la partida de una lista cerrada, que registra su propio suceso.

**Reacción**:
Lo que ocurre de inmediato a raíz de un suceso, en cuanto se cierra el turno o el día.

**Consecuencia aplazada**:
Algo que un suceso deja pendiente y que ocurre más tarde, cuando se cumple su disparo.
_Evitar_: evento programado

**Disparo**:
La condición que hace ocurrir una consecuencia aplazada: pasar días, llegar a una región, cruzarse con alguien u ocurrir otro suceso.

**Deuda de vida**:
Consecuencia de perdonar a alguien: más adelante, en otra región, vuelve para agradecerlo.

**Testigo**:
NPC con nombre que estaba en escena cuando ocurrió una muerte.

**Vengador**:
Testigo de la misma facción que la víctima que vuelve a buscar a quien mató.

**Escisión**:
Cuando una facción sin líder se parte y nace otra de ella; la nueva se nombra según las costumbres de su pueblo.
_Evitar_: disidentes

## El mundo que cambia solo

**Narrador de fondo**:
Lo que decide, una vez por día de ficción, si en el mundo de la partida pasa algo sin que la jugadora intervenga.
_Evitar_: director, generador de eventos

**Presupuesto de tensión**:
Cuánto puede pasar en el mundo de la partida: crece cada día según el ritmo del mundo y lo gasta cada suceso de fondo según su importancia.

**Ritmo del mundo**:
Lo que elige la jugadora para su partida (Tranquilo, Equilibrado, Caótico): cuánto pasa en el mundo por sí solo.
_Evitar_: estilo del narrador, dificultad

**Cadena**:
Un suceso de varios pasos que avanza con el tiempo y puede cortarse si deja de tener sentido; el conflicto Serhu es la primera.
_Evitar_: agenda, misión

**Noticia**:
Lo que la jugadora llega a saber de un suceso del mundo, en el canal «El mundo».
_Evitar_: log de mundo

**Rumor**:
Noticia de la que la jugadora solo sabe una parte, que le llega de oídas («Se dice que…») y sigue siéndolo hasta que se confirma.
_Evitar_: noticia lejana

**Conocimiento**:
Lo que el personaje de la jugadora sabe de un suceso, desde cuándo y cómo lo supo (lo vio, de oídas, confirmado); lo que sabe una región o un NPC no se apunta, se deduce.
_Evitar_: lo que sabe el jugador, visibilidad

**Alcance**:
Hasta dónde llega por sí sola la noticia de un suceso según su importancia: solo los testigos, su región, las vecinas o todo Berig.

**Confirmar**:
Pasar un rumor a hecho sabido, porque la jugadora lo ve, va donde pasó o se lo cuenta alguien que lo sabe de primera mano.

**Leyendas**:
La crónica de la partida tal como la conoce el personaje: solo sucesos de los que tiene conocimiento.
_Evitar_: libro de sucesos (ese lo contiene todo)

**Rastro**:
La huella visible que un suceso reciente deja en una región (humo, barro, animales que llegan) y que aparece en la ambientación.

**Oportunidad**:
Algo que una noticia deja hacer durante unos días en un lugar concreto (un campo de batalla, una caravana, un encargo); si nadie va, se pierde.
_Evitar_: misión, evento

**Encargo**:
Misión de entregar materiales a alguien de una facción a cambio de su favor; quien la encarga es el único que no es compañero al que se le pueden entregar objetos.

## Las personas del mundo

**Alguien que destaca**:
Un adulto joven de una facción que empieza a tener nombre propio en la partida; no es un nacimiento.
_Evitar_: nacimiento notable

**Nacimiento**:
Un bebé que nace en la partida de una pareja con nombre de su facción; crece y hereda de sus padres.

**Huella**:
El atributo más alto de un progenitor que pasa a su hijo por encima de la media de los dos.
_Evitar_: gen, rasgo

**Madurez**:
La edad a la que alguien de un pueblo puede trabajar, combatir y liderar; los orcos, a los 10 años ([clanes-orcos.md](docs/rpgtarkor/lore-mundo/clanes-orcos.md)).
_Evitar_: mayoría de edad

**Vejez**:
Los años que alguien vive más allá del 80 % de la esperanza de vida de su pueblo: pierde fuerza, destreza y constitución, y puede morir de viejo.

**Etiqueta**:
Un título que gana la jugadora por lo que ha hecho (Clemente, Carnicero…), con el suceso que lo dio; algunas dan un pequeño bono o malus.
_Evitar_: logro, rasgo

**Aprobación**:
Lo que un compañero con mente piensa de la jugadora, de 0 a 100, según cuánto chocan sus actos con sus valores; los animales no tienen aprobación, tienen felicidad.
_Evitar_: lealtad, afinidad

**Valores**:
Lo que le importa a un compañero (piedad, honor, codicia, lealtad al clan, crueldad, prudencia), cada uno con un peso de −2 a +2.

**Recuerdo**:
Lo que un NPC guarda de alguien a raíz de un suceso, con un sentimiento de −10 a +10; los leves se desvanecen y los graves quedan.
_Evitar_: memoria (es la del narrador)

**Superviviente**:
Un NPC que salió vivo de un combate con la jugadora; vuelve más fuerte y lo recuerda.

**Hilo**:
Una historia que el motor reconoce en el Libro (venganza, ascenso, caída, deuda, rivalidad, redención) y que sigue abierta hasta su desenlace.
_Evitar_: trama, misión

**Súbdito**:
Una persona que vive en el Reino de la jugadora, con nombre, pueblo, edad, padres y linaje; la población del Reino es cuántos hay.
_Evitar_: poblador (solo para el que aún está llegando), aldeano

**Linaje**:
Una familia que el motor sigue a través de generaciones (Ketg, Koh, Marn…): actor del Libro, hereda venganzas y deudas.
_Evitar_: clan (es la facción), dinastía

**Rastro**:
El linaje de los Faerus: una pequeña manada dentro de la gran manada que los suyos reconocen por los sentidos; se escribe «Tasko, del rastro Veyra».
_Evitar_: apellido (los Faerus no tienen)

**Informante**:
Un NPC convencido para seguir en su facción y pasar a la jugadora lo que sabe; si lo descubren, lo pierde.

## Las facciones que deciden

**Decisión de facción**:
Lo que una facción del mundo de la partida elige hacer por sí misma (mandar una expedición, pactar, declarar la guerra, pedir la paz, reclamar un territorio), según la Inteligencia de su líder.
_Evitar_: IA de facción, acción de facción

**Carencia**:
Lo que le falta a una facción para sostenerse (comida, bebida, Goirnos, soldados frente a sus enemigos) y que la empuja a decidir.
_Evitar_: necesidad, déficit

**Disposición**:
La inclinación de una facción (belicosa, mercantil, recelosa…) que pesa en sus decisiones cuando tiene varias opciones.
_Evitar_: personalidad, temperamento

## Las misiones

**Misión**:
Lo que la jugadora acepta hacer para alguien: queda en su diario con objetivo, quién la encarga, plazo y recompensa, y fallarla o abandonarla tiene consecuencias.
_Evitar_: quest, tarea, oportunidad

**Misión secundaria**:
Misión que el motor crea a partir de lo que pasa en el mundo de la partida, con una plantilla cerrada por tipo (entregar, cazar, eliminar, explorar, ayudar, combatir).
_Evitar_: misión generada, misión de la IA

**Tablón de avisos**:
Edificio de una ciudad donde una facción cuelga sus misiones; cada pueblo le da su propio nombre.
_Evitar_: tablón de misiones, tablón de encargos

## Combate y comercio (Fase G del 0.2)

**Moral**:
Tirada de Voluntad con la que un NPC con mente decide si sigue peleando; la hace el líder por su grupo.
_Evitar_: miedo, valor

**Retirada**:
Huida de un NPC del combate tras fallar la moral: si escapa, sale de la zona vivo y vuelve a su hogar.
_Evitar_: huida (reservada a la del personaje)

**Desbandada**:
Retirada sin orden de un grupo, cada uno por su lado; la provoca la caída o la huida de su capitán.

**Capitán**:
NPC de Inteligencia 20 o más que manda a los de su bando con menos Inteligencia en un combate.
_Evitar_: líder (ese es el de una facción)

**Comercio de volumen**:
Compraventa de recursos entre el Reino y una facción con tratado o alianza, con la riqueza del Reino y unidad a unidad.
_Evitar_: mercado (ese es el del personaje con sus Goirnos)

**Orden permanente**:
Regla de compra o venta que la jugadora deja en el Mercado del Reino y que sus caravanas cumplen solas.

**Caravana**:
Grupo que lleva mercancía entre dos lugares por días, visible en el mapa según lo que sabe el personaje y expuesto a asaltos.


## Ganadería y comida (Fase D del 0.3)

**Ganado**:
Animales domesticados que viven en un corral del Reino o de una facción para producir, criar o sacrificarse; no acompañan a nadie.
_Evitar_: rebaño (como término del motor), compañero animal

**Ganadero**:
Oficio, propio de cada pueblo y región, de quien cuida el ganado; sin ganadero el ganado no produce.
_Evitar_: domador (el Domador es una especialización de combate, no un oficio)

**Corral**:
Edificio del ganadero que guarda animales de una sola especie, con plazas según su escalón.

**Etapa**:
Momento de la vida de un animal (cría, joven, adulto, vejez) que decide qué come, si produce y si cría; depende de su categoría de fauna y de su porte.

**Forraje**:
Reserva de alimento de los herbívoros del ganado, aparte de la comida de la gente.

**Comida cruda**:
Lo comestible tal como sale del ganado, la caza o la recolección; alimenta según su valor, sin multiplicar.

**Plato**:
Lo que sale de una receta de cocina; alimenta más que la suma de sus ingredientes, tanto más cuanto más alto el escalón de la cocina.

**Comida pasiva**:
Comida que aparece sin que nadie la produzca (por trabajador o por edificio); se retira a favor de la comida por oficios.
