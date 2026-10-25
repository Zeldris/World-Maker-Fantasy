# Ciénaga Troncal

[← Áreas y geografía](../areas.md) · [Índice del mundo](../07-mundo-helek-sirik.md)

*Región de la franja central de Berig, al este de las Llanuras: Cristal Helado al norte y El Margen
Silencioso al sur · territorio
neutral · ~160 × 178 km · nombre nativo de la región: **Los Trepaderes Humededos** · **fuera del
núcleo jugable**.*

---

## Descripción

Terreno húmedo, en gran parte inhabitable, con tres pequeñas zonas llanas donde crece un tipo de
árbol de tono oscuro, el Trepador Ocaso, que ha invadido gran parte de los cenagales. Zona rica en
alimento por la variedad de especies y madera, pero con pocos recursos minerales.

**Quién vive aquí:**
- En la zona llana más amplia, las dos tribus pequeñas del **Clan Goshg** (ver
  [clanes-orcos.md § Clan Goshg](../clanes-orcos.md#clan-goshg)).
- En la explanada más pequeña, al sur, una tribu **Nabieus**, la de Keseg Prisilke, con cuerpos
  adaptados para vivir en las zonas más complicadas del pantano (ver
  [razas.md § Nabieus](../razas.md#nabieus--los-que-silencian)).

## Asentamientos

### El Cerco de los Pilotes (Silh Makut)
*Asentamiento del Clan Goshg · Catálogo: `campamento-goshg` (interior: `campamento-goshg-interior`).*

Nombre nativo **Silh Makut** ("Piel Musgo"). El mayor poblado del Clan Goshg: empalizadas de madera
oscura sobre pilotes, unidas por pasarelas y canoas. Las dos tribus se reúnen aquí en la estación de
las crecidas y casan a sus jóvenes entre sí. El interior completo es el **Goshg'lukar** (Hogar), y en
su centro, sobre pilotes como el resto del poblado, se alza el **Goshg'sedsar**, el Salón de Piel
Musgo, sede de la Terk'ikar Doshka y el Kort'ikar Dulgren.
**Talleres** *(pasada 2026-09-27; pendientes de código y sin Maestro asignado todavía)*. Los Goshg son
los mejores trabajando la madera de los tres clanes, y sus talleres lo reflejan:
- **Astillero de pilotes**: plataforma baja al nivel del agua donde se vacían canoas de fondo plano y
  se aguzan pilotes de Trepador Ocaso. Todo lo que flota o sostiene el Cerco sale de aquí.
- **Resinería**: cobertizo apartado del resto (la resina arde) donde se cuecen las resinas de
  Trepador y de Holdo. Una sirve para las antorchas que arden con lluvia; la otra, para calafatear.
  Aquí se preparan también los fardos de resina que suben por la Senda del Sílice hacia los Helsig.
- **Ahumadero**: casetas de humo sobre pilotes donde se curan la carne de Cornante y el Borbol. En la
  ciénaga, lo que no se ahúma se pudre en dos días.
- **Talla de tótems**: sin techo, junto al salón. De aquí salen los tótems de madera de ciénaga que
  los demás clanes compran o piden.

En el código existen los oficios de la Ciénaga (carpintero y cocinero incluidos), pero ningún Maestro
Goshg los enseña, y cada edificio de oficio necesita el suyo: los talleres de arriba y la **Casa de
curas** esperan a los Maestros Goshg (hito `0.5`). Falta además un oficio de resina (ver
[edificios-de-oficio.md](../../sistemas-reino/edificios-de-oficio.md) § 6).

### Jeyselt (Fin Susurrado)
*Asentamiento Nabieus · Catálogo: `conclave-keseg-prisilke` (interior: `conclave-keseg-prisilke-interior`).*

Poblado del clan **Keseg Prisilke**, en la explanada más pequeña del sur de la ciénaga. El clan nació
de la segunda huida Nabieus (ver [cronologia-mitica.md](../cronologia-mitica.md#sin-fechar-generaciones-después-de-la-caída-la-segunda-huida-nabieus)).
Vive de la caza y de la madera de los Trepadores Ocaso más que de los mensajes; la Concordia le exige
madera, como a los Goshg, con quienes comparte la Ciénaga en una convivencia práctica (intercambian
madera y noticias, no se casan entre sí). *Jeyselt* es el
nombre del poblado en su lengua; en lengua común se le llama *Fin Susurrado*, el nombre de su clan. Sus habitantes tienen cuerpos adaptados a
las zonas más difíciles del pantano, distintos de sus parientes del Margen Silencioso.

## Lugares


- **Marismas de Lodo Negro** (`marismas-lodo-negro`): marismas que se forman de la mezcla de resina
  de Holdo (árbol oscuro de resina negra), agua y fango gris. En la superficie se acumulan los restos
  más espesos de la resina, formando una capa protectora y viscosa; debajo hay una red de túneles
  sumergidos con el agua más pura y cristalina de Berig. Ver [Holdo](#holdo).
- **Túneles Musgosos** (`tuneles-musgosos`): galerías secas bajo las raíces entrelazadas de los
  Trepadores Ocaso más viejos, tapizadas de musgo, por donde se cruza la Ciénaga sin tocar el agua. Los
  cazadores de Keseg Prisilke las conocen como nadie; en las crecidas, son el refugio de medio pantano.
- **Raíces Madre Fango** (`raices-madre-fango`): el Trepador Ocaso más viejo de la Ciénaga, con unas
  raíces tan anchas que forman una isla firme y alta. Es el único suelo seco donde los Goshg pueden
  levantar sus piras: aquí queman a sus muertos y dejan sus tótems funerarios, colgados de las
  raíces.
- **Cumbre Bruma Negra** (`cumbre-bruma-negra`): la única altura de la Ciénaga, una loma de roca vieja
  que asoma sobre el dosel. Por la mañana la envuelve la niebla de las charcas, oscurecida por el humo
  de resina de las hogueras de los vigías Goshg, que desde aquí ven llegar a los Serhu.
- **Cataratas Madre Fango** (`cataratas-madre-fango`): donde el agua que rodea las Raíces Madre cae
  de golpe a un nivel más bajo del pantano, en un salto de agua marrón. Los Borboles remontan aquí en
  primavera y es la mejor pesca de la región.
- **Costa Marea Vida** (`costa-marea-vida`): marismas de marea en la costa oriental, al norte de la
  Costa Corredor, donde la mezcla de agua dulce y salada da marisco en abundancia. Los Goshg la
  recolectan en marea baja.
- **Costa Corredor** (`costa-corredor`): la costa oriental donde se entrega la madera del tributo a
  las balsas Goirntes que bajan hacia la Meseta. Es el único punto de la Ciénaga donde se ven Goirntes
  con regularidad.
- **Embarcadero Silh Makut** (`embarcadero-goshg`): el muelle propio del Cerco, del que salen las
  canoas de fondo plano hacia la Costa Corredor y hacia Jeyselt.
- **Desfiladero Esmeralda** (`desfiladero-esmeralda`): garganta de paredes cubiertas de un musgo
  verde intenso, en el borde norte de la Ciénaga. Es la salida hacia Cristal Helado, y por él pasa la
  **Senda del Sílice**: el sitio donde se cruzan las caravanas Helsig y los porteadores Goshg.

## Flora

### Trepadores Ocaso
*Veldrias · toda la región · Catálogo: `resina-trepador-ocaso`.*

Árboles oscuros de resina negra tirando a tonos dorados. Forman la mayor parte de la Ciénaga
Troncal y son el recurso principal de las tribus orcas de la zona. Su resina negra de vetas doradas
sella e impermeabiliza la madera: el mismo barniz natural que hace arder una antorcha bajo la lluvia
protege el fondo de una canoa o el pilote de una empalizada de pudrirse en el agua estancada. Su
madera oscura, densa y casi inmune a la humedad, es la que los clanes orcos prefieren para tallar
sus tótems. De ella era el gran tótem del Clan Maktor, y también el trozo que Gorhorn rescató.

### Bulbo de Turbera
*Bulvias · zonas llanas.*

Tubérculo elíptico de 15-30 cm, de piel parda y pulpa blanca y firme, que crece en el fango de turba
de las zonas llanas. Es el alimento base de Keseg Prisilke y de los Goshg cuando falla la caza de
Cornantes; se come cocido, frito o seco al humo.
**Recurso:** Bulbo de Turbera, tier 1, alimento.

### Velo de Charca
*Marelas · charcas quietas entre los pilotes.*

Láminas gelatinosas y translúcidas de 5-15 cm que cubren la superficie de las charcas quietas, bajo
los Trepadores Ocaso. Se come en sopa, y aplicada fresca sobre una quemadura **enfría y protege**: es
la cura de campo más habitual de los Goshg, que se queman a menudo con la resina de sus antorchas.
**Recurso:** Velo de Charca, tier 1, alimento y medicinal.

### Herrumbrera
*Vetrias · orillas de agua estancada.*

Arbusto de 40-70 cm de tallos gruesos con una corteza de color óxido, pesada y áspera. El fango de la
Ciénaga arrastra hierro disuelto; sus raíces lo concentran en la corteza, que con el tiempo se vuelve
una costra de herrumbre. Es el mismo principio que la Hierba del Hierro de la Meseta, pero con un
mineral mucho más pobre. **No brilla.** Explica que los Goshg tengan algo de metal pese a vivir en
una región pobre en minerales: da para puntas de lanza y clavos, no para una herrería de verdad.
**Recurso:** Corteza Herrumbre, tier 2 (10 unidades equivalen a 1 de mena de hierro pobre al fundir).

### Holdo
*Veldrias · Marismas de Lodo Negro.*

Árbol bajo y ancho, pariente del Trepador Ocaso pero sin vetas doradas, que solo crece en las
marismas. Su resina, negra y pesada, gotea al agua y flota: es la que forma la capa viscosa de las
Marismas de Lodo Negro. Esa capa sella el agua de debajo del aire y del barro de arriba, así que los
túneles sumergidos no se enturbian ni se evaporan. Por eso guardan el agua más limpia de Berig.
**Recurso:** Resina de Holdo (t2), impermeabilizante pesado con el que los Goshg calafatean el fondo
de las canoas.

## Fauna

### Cornantes
*Bestiones · nivel 3-8 · CAUTELOSO.*

Criatura de cuatro patas, corpulenta y de gran tamaño, con cornamenta ancha y ramificada. Es la
principal fuente de alimento de los orcos en la Ciénaga Troncal. Cazar un Cornante es trabajo de
grupo y de paciencia: se le acorrala hacia el agua baja, donde su propio peso lo hunde. Hay que hacerlo rápido: un Cornante hundido
atrae Tragalodos.

### Tragalodo
*Escamados · nivel 8-14 · AGRESIVO · agua baja y orillas.*

Reptil acorazado de 3-4 m, de placas pardas cubiertas de barro seco y ojos a ras de cabeza. Caza en el
agua baja, justo donde los Goshg acorralan a los Cornantes, y huele la sangre desde lejos. Por eso la
caza del Cornante es cosa de grupo y de prisa. Es el depredador grande que le faltaba a la Ciénaga.
**Recursos:** Placas de Tragalodo (t5, armadura) y Dientes de Tragalodo (t4).

### Borbol
*Nadantes · nivel 1-2 · INOFENSIVO · ACUATICO · charcas y canales.*

Pez de fondo de 30-50 cm que respira aire: cada pocos minutos sube a la superficie con un golpe de
cola. **Esa vibración es lo que leen los cazadores de Keseg Prisilke** con la pierna metida en el agua
(la escucha con la palma, llevada al agua). Carne grasa que se ahúma bien.
**Recurso:** Carne de Borbol (t1).

### Zancapilote
*Zancudos · nivel 2-5 · CAUTELOSO · pilotes viejos del Cerco.*

Ave zancuda gris de 1,5 m que anida en los pilotes abandonados del Cerco y roba pescado de las redes.
Los Goshg la toleran porque grazna en cuanto algo grande se mueve bajo el agua: es su alarma contra el
Tragalodo.
**Recurso:** Plumas de Zancapilote (t1).

## Cómo se conecta con el resto de Berig

- **Oeste, las Llanuras** (4-5 jornadas desde Karot Veku): la **Senda del Sílice** une desde hace
  siglos la madera y la resina Goshg con el hielo sílice Helsig y las pieles de las Llanuras. De aquí
  salió la madera del gran tótem Maktor. Hoy los Serhu, armados por la Concordia, empiezan a asaltar a
  los Goshg, y los Goshg responden con bajo perfil y empalizadas.
- **Norte, Cristal Helado**: el otro extremo de la Senda. Los Helsig compran resina de Trepador (sus
  antorchas no se apagan con la ventisca) y pagan en cuchillos.
- **Sur, El Margen oriental**: Jeyselt está a 1-2 jornadas del Refugio sin Nombre. Keseg Prisilke y
  Keseg Sael son parientes: se mandan noticias, no mercancías.
- **La Meseta, por mar**: la madera del tributo no baja por el Margen (nadie saca troncos de ese
  laberinto), sino por la costa oriental. Los Goshg y los Prisilke la llevan a la **Costa Corredor**,
  donde la embarcan balsas Goirntes que bajan hacia el sur.

## Huecos conocidos

- Los talleres del Cerco no tienen Maestro (ni edificio en el catálogo).

## Historial de cambios

- 2026-09-29 (decisión de Álvaro): el árbol Bolco pasa a llamarse **Holdo** (evita la confusión con el caracol Bulco de las Llanuras).
- 2026-08-05: liderazgo Goshg (Doshka y Dulgren).
- 2026-08-21: los nombres nativos (Los Trepaderes Humededos, Silh Makut) pasan del catálogo al lore.
- 2026-09-13: el interior Goshg'lukar pasa a ser jugable (solo el salón).
- 2026-09-27: la región pasa a tener fichero propio. Se documentan los lugares del catálogo que no
  tenían reflejo en el lore. Se unifica el nombre nativo del Cerco en **Silh Makut**, el del
  catálogo y el de la sección del interior (`areas.md` decía "Makut Silh" en un solo sitio).
- 2026-09-27 (pasada de conexión): Tragalodo, Borbol, Zancapilote y Bolco; familia y nivel de los Cornantes; Costa Corredor y Embarcadero descritos; sección de conexiones (Senda del Sílice, tributo por mar).
- 2026-09-27 (segunda pasada): descritos los seis lugares que solo tenían nombre (Túneles Musgosos, Raíces Madre Fango, Cumbre Bruma Negra, Cataratas Madre Fango, Costa Marea Vida, Desfiladero Esmeralda) y los talleres del Cerco.
- 2026-10-25 (QA-240): la fauna, la flora y las descripciones de los lugares ya están en el juego; se
  quitan las marcas «pendiente de código». Jeyselt: *Jeyselt* es el nombre del poblado en su lengua y *Fin
  Susurrado* el de lengua común (antes se leía al revés).
- 2026-10-25 (`QA-240`): los oficios de la Ciénaga ya existen; a los talleres Goshg les faltan los Maestros.

---

**Ver también:** [Clanes orcos](../clanes-orcos.md) · [Razas](../razas.md) · [Áreas y geografía](../areas.md) · [Flora y fauna](../flora-fauna.md)
