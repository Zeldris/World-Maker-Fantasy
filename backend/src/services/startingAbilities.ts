export interface StartingAbility {
  name: string;
  icon: string;
  description: string;
  promptText: string;
  category: 'combate' | 'general';
}

/// Kit de habilidades "de serie" de Gorhorn — no cuentan contra el cupo por nivel
/// (docs/10-niveles-xp-reino.md § 4.3), son lo que el personaje ya sabía hacer antes de
/// empezar la partida. Las 6 primeras las diseñó un pase de Fable calibrado para el
/// clasificador (evitan nombrar atributo/dificultad, pero cargan léxico que empuja hacia el
/// atributo correcto). Las 2 últimas son acciones genéricas de utilidad (no "ataques") a
/// petición explícita de la usuaria — cosas como volver al campamento o buscar provisiones,
/// coherente con que Tarkor resuelve cualquier tipo de acción, no solo combate.
const GORHORN_STARTING_ABILITIES: StartingAbility[] = [
  {
    name: 'Furia de Maktor',
    icon: '🪓',
    description: 'Descarga toda la potencia de su hacha rota sobre un enemigo a corta distancia, como el último martillo de su clan.',
    promptText:
      'Suelto un rugido de guerra y cargo contra mi enemigo, descargando mi hacha rota como una maza con toda la potencia de mis músculos.',
    category: 'combate',
  },
  {
    name: 'Piel de Guerra',
    icon: '🩸',
    description: 'El dolor no manda sobre un Maktor: Gorhorn aguanta heridas, frío y agotamiento sin ceder terreno.',
    promptText: 'Aprieto los dientes y aguanto el dolor y el cansancio sin retroceder ni un paso, negándome a caer.',
    category: 'combate',
  },
  {
    name: 'Rompemontañas',
    icon: '🪨',
    description: 'Cuando algo bloquea el camino, Gorhorn no busca rodeo: lo mueve, lo levanta o lo parte.',
    promptText: 'Agarro el obstáculo con ambas manos, clavo los pies en el suelo y empujo con todos mis músculos para moverlo, levantarlo o partirlo.',
    category: 'general',
  },
  {
    name: 'Mirada del Domador',
    icon: '🐺',
    description: 'La comunión de Gorhorn con las bestias de las Llanuras: someterlas sin violencia, espíritu contra espíritu.',
    promptText: 'Me planto ante la bestia sin mostrar miedo, sostengo su mirada y le impongo mi espíritu hasta que agache la cabeza y me acepte.',
    category: 'general',
  },
  {
    name: 'Instinto del Viento Rojo',
    icon: '🐾',
    description: 'Lee el terreno como le enseñaron las llanuras: huellas, olores y señales que delatan lo que pasó aquí.',
    promptText:
      'Me detengo, respiro hondo y concentro todos mis sentidos en el terreno: huellas, olores en el viento, ramas quebradas, cualquier rastro que delate qué ha pasado aquí.',
    category: 'general',
  },
  {
    name: 'La Palabra del Tótem',
    icon: '🗿',
    description: 'Alza el tótem del Clan Maktor y habla desde el honor, buscando respeto y acuerdo antes que sangre.',
    promptText:
      'Alzo el tótem de mi clan, hablo con voz firme y apelo al honor para ganarme el respeto de quienes me escuchan y convencerlos de mis palabras.',
    category: 'general',
  },
  {
    name: 'Buscar provisiones',
    icon: '🌿',
    description: 'Busca comida, agua o cualquier recurso útil en los alrededores.',
    promptText: 'Recorro la zona con atención, buscando comida, agua o cualquier recurso que me pueda servir.',
    category: 'general',
  },
  {
    name: 'Volver al campamento',
    icon: '🏕️',
    description: 'Deja lo que está haciendo y regresa a un lugar seguro que ya conoce para descansar.',
    promptText: 'Dejo lo que estoy haciendo y vuelvo a un lugar seguro que ya conozco para descansar.',
    category: 'general',
  },
];

export function startingAbilitiesFor(characterName: string): StartingAbility[] {
  if (characterName === 'Gorhorn') return GORHORN_STARTING_ABILITIES;
  return [];
}
