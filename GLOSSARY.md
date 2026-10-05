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
