import type { Character, World } from '../types'

export const worlds: World[] = [
  {
    id: 'helek-sirik',
    name: 'Helek Sirik',
    tagline: '"Origen Azul" — pueblos que se creen en lo correcto, en guerra por una verdad que nadie tiene completa.',
    synopsis:
      'Dos continentes, Vaelira y Berig, separados por un estrecho envuelto en niebla. Tras generaciones de paz vigilada, la Isla Cambiante que ambos sellaron ha desaparecido, y en su lugar ha surgido algo que ninguno de los dos bandos comprende. La guerra entre la Alianza de la Rama Blanca y la Concordia de Hierro ya ha empezado — y nadie sabe todavía que lo peor no viene del otro continente, sino de lo que ha despertado en el norte.',
    tone: 'Épico y trágico: pueblos que se creen en lo correcto libran una guerra sobre una verdad que nadie tiene completa, en un mundo tan pequeño que cada muerte deja cicatriz.',
    lethality: 'media',
    factions: ['Alianza de la Rama Blanca', 'Concordia de Hierro', 'Reino oculto Kalisar', 'Clanes orcos de las Llanuras del Viento Rojo'],
    cover: 'helek-sirik',
    theme: {
      accent300: '#a8d8f0',
      accent400: '#7bc4e8',
      accent500: '#4aa8d8',
      accent600: '#3488b8',
      accent2300: '#b0bec8',
      accent2400: '#8a9aa8',
      accent2500: '#6b7d8c',
      accent2600: '#52626f',
    },
  },
]

export const pregeneratedCharacters: Character[] = [
  {
    id: 'char-gorhorn',
    name: 'Gorhorn',
    archetype: 'Guerrero superviviente del clan Maktor (Orco)',
    origin: 'Único superviviente de un clan orco de escasa relevancia, aniquilado como carne de cañón por el mando Goirntes en una de las primeras escaramuzas de la Concordia de Hierro.',
    motivation: 'Que la muerte de su clan signifique algo, y restaurar el nombre de los Maktor — aunque eso implique romper el juramento que lo ata a un bando que ya no respeta.',
    attributes: { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 },
    isPregenerated: true,
    portraitInitial: 'G',
    introCharacterText:
      "Gorhorn reposa sentado, ojos cerrados, cobijado por la sombra del gran acantilado de la Hondonada del Eco. El mismo sueño regresa una vez más. El recuerdo de la caída de los Maktor. La pérdida de su clan. La sangre. La guerra. El dolor. Pero esta vez hay algo distinto, algo que tira de él hacia el horizonte. Por un instante, la imagen se aclara. Se ve a sí mismo alzando el estandarte de los Maktor sobre una colina, con una gran ciudad extendiéndose a sus pies. Y mientras sostiene esa visión fugaz, una voz indescriptible susurra desde las sombras: 'Honor... gloria... Maktor.' El sueño se desgarra. El viento golpea con furia las rocas de la hondonada, arrancándolo de su trance. Gorhorn se pone en pie de un salto, los dedos rozando el asta de su arma, la mirada escudriñando el horizonte. En su mente, una sola certeza arde con la intensidad de la forja: Recuperar el honor de los Maktor. Ha llegado la hora. El viaje comienza.",
    introWorldText:
      'Amanece sobre Helek Sirik. Te encuentras en las Llanuras del Viento Rojo, al este del continente de Berig, donde el sol baña la tierra arcillosa y los vientos irregulares dibujan patrones en el polvo. Hoy, sin embargo, hay algo diferente. Una calma extraña se ha posado sobre la llanura, un silencio tenso que apenas se sostiene bajo el rugir lejano del viento. Porque en estas tierras, la calma nunca es eterna, y el viento siempre regresa. Pero hoy, en este instante de quietud, todo parece posible. El polvo se suspende en el aire, los ecos se apagan y el horizonte parece aguardar, conteniendo el aliento. Es un comienzo prometedor para la aventura que está a punto de comenzar.',
  },
  {
    id: 'char-sael',
    name: 'Sael Vhorn',
    archetype: 'Tallador de cristal (Kelife)',
    origin: 'Hijo de talladores de una casa Kelife menor; vio venir la ruina de su propio taller a través de una grieta que nadie más pudo ver, y nadie le creyó a tiempo.',
    motivation: 'Entender lo que de verdad puede hacer con su don de leer tensiones antes de que se rompan, ahora que ya no tiene taller al que volver.',
    attributes: { fuerza: 6, destreza: 12, constitucion: 11, inteligencia: 11, voluntad: 15, carisma: 7, magia: 9 },
    isPregenerated: true,
    portraitInitial: 'S',
  },
  {
    id: 'char-dessa',
    name: 'Dessa Kaltrenn',
    archetype: 'Desertora de la guardia (Goirntes)',
    origin: 'Soldado rasa de Berig que escoltaba el sello de contención de la Isla Cambiante la noche en que la facción radical lo rompió por su cuenta.',
    motivation: 'Encontrar una forma de exponer la verdad que vio esa noche sin que el propio orden que juró proteger la destruya primero.',
    attributes: { fuerza: 13, destreza: 12, constitucion: 6, inteligencia: 6, voluntad: 15, carisma: 9, magia: 5 },
    isPregenerated: true,
    portraitInitial: 'D',
  },
  {
    id: 'char-ithren',
    name: 'Ithren Vosk',
    archetype: 'Espía de la Costa del Azabache (Kalisar)',
    origin: 'Criado desde niño para el espionaje, al servicio de un reino oculto y minoritario que no puede permitirse que nadie se niegue.',
    motivation: 'Conseguir que alguien crea la verdad que descubrió infiltrado en Berig — aunque nadie quiera escuchar a un Kalisar.',
    attributes: { fuerza: 7, destreza: 15, constitucion: 17, inteligencia: 17, voluntad: 9, carisma: 8, magia: 4 },
    isPregenerated: true,
    portraitInitial: 'I',
  },
  {
    id: 'char-amonir',
    name: 'Amonir Thess',
    archetype: 'Agricultor sin tierra (Jusaly)',
    origin: 'Su aldea y los campos que su familia cultivó durante generaciones fueron arrasados por la magia salvaje liberada tras la ruptura de la Isla Cambiante.',
    motivation: 'Encontrar algo, alguien o algún conocimiento capaz de revertir lo que le hicieron a su tierra.',
    attributes: { fuerza: 11, destreza: 8, constitucion: 6, inteligencia: 6, voluntad: 16, carisma: 7, magia: 12 },
    isPregenerated: true,
    portraitInitial: 'A',
  },
  {
    id: 'char-yerin',
    name: 'Yerin Slaad',
    archetype: 'Mensajero silencioso (Nabieus)',
    origin: 'Entregaba correspondencia sellada entre facciones Goirntes menores sin hacer preguntas — hasta que una de esas cartas resultó ser mucho más de lo que parecía.',
    motivation: 'Averiguar si fue cómplice sin saberlo del sabotaje que desató la guerra.',
    attributes: { fuerza: 6, destreza: 11, constitucion: 17, inteligencia: 17, voluntad: 14, carisma: 6, magia: 6 },
    isPregenerated: true,
    portraitInitial: 'Y',
  },
  {
    id: 'char-riko',
    name: 'Riko',
    archetype: 'Cazador de la Manada Rota (Faerus)',
    origin: 'Volvió de una cacería larga para encontrar su territorio arrasado por la misma oleada de magia salvaje que corrompió tierras al otro lado del mundo. Su manada, dispersa o muerta.',
    motivation: 'Seguir cualquier rastro, olor o señal que lo lleve de vuelta a los suyos, vivos o no.',
    attributes: { fuerza: 12, destreza: 16, constitucion: 13, inteligencia: 13, voluntad: 9, carisma: 5, magia: 5 },
    isPregenerated: true,
    portraitInitial: 'R',
  },
  {
    id: 'char-cassia',
    name: 'Cassia Von-Thair',
    archetype: 'Archivista censurada (Ilvenar)',
    origin: 'Aprendiz de archivista enviada a documentar los daños de la ruptura; al tocar el sello roto, percibió la huella de una tercera presencia que no era ni de Vaelira ni de Berig.',
    motivation: 'Sacar a la luz un informe que ninguno de los dos bandos quiso firmar.',
    attributes: { fuerza: 5, destreza: 9, constitucion: 8, inteligencia: 8, voluntad: 16, carisma: 10, magia: 12 },
    isPregenerated: true,
    portraitInitial: 'C',
  },
]

// Las partidas guardadas, sus logs y los hechos de mundo ya no viven aquí — son datos reales
// en Postgres (Save/WorldState/LogEntry), servidos por el backend (ver src/lib/api.ts).
