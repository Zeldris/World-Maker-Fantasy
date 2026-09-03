import type { StartingAbility } from './startingAbilities.js';
import { ENERGY_COST_BASICA } from './energy.js';

/// Categorías de raza de fauna (2026-09-02, sistema paralelo — NO reutilizar — a `Clase` de
/// personaje/NPC humanoide, decisión explícita de la usuaria: "eso mezclaría conceptualmente
/// fauna salvaje con clases pensadas para personajes jugables"). Mismo mecanismo técnico que
/// `classAbilityUnlocksForClase` (array con `level`, filtrado por nivel en `npcCombatAbilitiesFor`)
/// pero su propio catálogo, `Npc.faunaCategoria` en vez de `Npc.clase`.
///
/// Las 13 categorías agrupan por "Semilla" creadora (docs/rpgtarkor/genesis.md) — puro sabor
/// narrativo/organizativo, no cambia nada mecánico:
/// - Ferios ("El que Nace", instinto/caza, creador de la mayoría de fauna salvaje de Berig):
///   GUELISES (depredadores de jauría), ACECHANTES (depredadores solitarios de emboscada),
///   CORVENES (aves de presa/carroñeras), ZANCUDOS (aves terrestres/de charca), BESTIONES
///   (grandes herbívoros/bestias de manada), RONDINES (pequeños mamíferos omnívoros).
/// - Florial ("El que Brota", crecimiento lento/paciente): QUITINOS (insectos/artrópodos
///   acorazados), ESCAMADOS (reptiles/anfibios), NADANTES (peces/fauna acuática).
/// - Goirme (orden/simetría): ORDENADOS — sin fauna real asignada todavía, solo el TIPO definido
///   (tema simetría/orden/geometría) para uso futuro.
/// - Kroj (sigilo/noche): UMBRIAS — sin fauna real asignada todavía, solo el TIPO definido (tema
///   sigilo/noche/silencio) para uso futuro.
/// - Tarkor (magia Salvaje derramada tras el Estallido): MUDOS_SALVAJE (fauna EXISTENTE mutada
///   por la magia — animales reales del catálogo con algo imposible/mítico ya en su bio) y
///   ROKRATS_ESTALLIDO (seres nacidos DIRECTAMENTE de la magia salvaje, sin animal base real —
///   igual que los Orcos nacieron directos de la magia, no son "humanos mutados" — sin fauna real
///   asignada todavía, solo el TIPO definido para contenido futuro).
export type FaunaCategoria =
  | 'GUELISES'
  | 'ACECHANTES'
  | 'CORVENES'
  | 'ZANCUDOS'
  | 'BESTIONES'
  | 'RONDINES'
  | 'QUITINOS'
  | 'ESCAMADOS'
  | 'NADANTES'
  | 'ORDENADOS'
  | 'UMBRIAS'
  | 'MUDOS_SALVAJE'
  | 'ROKRATS_ESTALLIDO';

/// Progresión de categoría de fauna (2026-09-02, diseño cerrado con la usuaria salvo el patrón
/// exacto de niveles, dejado "a tu criterio, documentando el motivo"): "empieza con 3 habs a
/// nivel 1, de cada tipo... y cada 4 niveles una nueva" simplificado a "categorías con 7 habs y
/// solo añadir 3 específicas por cada fauna" — 7 de categoría (compartidas por TODA la fauna de
/// esa categoría) + 3 específicas por animal (worldCatalog.ts `habilidadesRaciales`), cobertura
/// combinada hasta nivel ~32.
///
/// Distribución elegida: la CATEGORÍA da sus 3 primeras (1 ataque + 1 defensa + 1 utilidad) YA A
/// NIVEL 1 — cumple sola la regla dura ("a nivel 1 el animal ya tiene mínimo 1 ataque + 1 defensa
/// + 1 utilidad") sin depender de las específicas del propio animal, que podrían estar aún sin
/// diseñar para una categoría nueva. Las 4 restantes de categoría llegan de 8 en 8 (niveles 8/16/
/// 24/32) — ritmo deliberadamente más lento que el de clase (4 en 4, clases.md), porque aquí las
/// 3 específicas de CADA animal rellenan los huecos intermedios (niveles 4/12/20,
/// worldCatalog.ts): categoría y animal nunca desbloquean el mismo nivel, así un vistazo a
/// "qué nivel tiene esto" ya dice de qué lista sale. Recuento: 7 (categoría) + 3 (animal) = 10
/// habilidades por animal, niveles 1×3, 4, 8, 12, 16, 20, 24, 32 — mismo techo aproximado
/// (nivel ~32-40) que pedía el diseño original de "10 habilidades por plantilla, hasta nivel 40".
export const FAUNA_CATEGORIA_LEVELS = [1, 1, 1, 8, 16, 24, 32] as const;
export const FAUNA_ESPECIFICA_LEVELS = [4, 12, 20] as const;
/// Hueco extra de nivel 36 (2026-09-02, retoque PROVOCACION) — SOLO en las categorías donde
/// encaja narrativamente una fauna robusta/de mucha constitución que reta a que la ataquen a ella
/// (GUELISES/BESTIONES/QUITINOS/MUDOS_SALVAJE/ROKRATS_ESTALLIDO): una 8ª habilidad de categoría,
/// en vez de sustituir ninguna de las 7 ya diseñadas/testeadas. 36 es el único hueco libre entre
/// 32 (última de categoría) y 40 (techo real de nivel, ver progression.ts "cada 4 niveles...
/// 24/28/32/36/40"). El resto de categorías (ACECHANTES/CORVENES/ZANCUDOS/RONDINES/ESCAMADOS/
/// NADANTES/ORDENADOS/UMBRIAS) se quedan en 7 — su tema (sigilo/velocidad/huida) no encaja con
/// "plantarse a que te ataquen para proteger al resto", así que no reciben esta 8ª habilidad.

export interface FaunaCategoriaAbilityUnlock {
  level: number;
  categoria: FaunaCategoria;
  ability: StartingAbility;
}

/// Solo los efectos de `AbilityEffect` (schema.prisma) con motor real hoy (2026-09-02, mapa
/// verificado a mano leyendo turnResolution.ts/combatExchange.ts/combateMultipleOrquestacion.ts,
/// NO el resumen de cabecera de classAbilities.ts que quedó desactualizado en algún punto):
/// ATAQUE/ATURDIMIENTO/INTIMIDACION/AGUANTE/ANALISIS (pasada original) + CONTROL/CONTRA/
/// REFRACTAR/RECUPERACION/COMPANERO (2026-08-26) + CONVERSION + LIMITADA (modificador, no efecto
/// en sí, se combina con `maxUsesPerCombat`) + MULTIPLE (2026-08-27, Fase 3 § 3b — verificado real
/// en `combateMultiple.ts:636`/`combateMultipleOrquestacion.ts:613-648`, PERO gateado ÚNICAMENTE a
/// la combinación `ATAQUE`+`MULTIPLE`, nunca junto a ningún otro efecto — no se usa aquí porque
/// ninguna habilidad de fauna necesita "el mismo golpe alcanza a un segundo combatiente").
///
/// `PROVOCACION` (antes `ATENCION`, decisión de la usuaria 2026-09-02: "sí quiere PROVOCACION
/// añadido donde encaje... en las que sean robustos y tengan mucha constitución") — CONFIRMADO
/// SIN motor real hoy (el nombre del enum en Postgres cambió de ATENCION a PROVOCACION en la
/// migración `20260902100000_ability_effect_atencion_to_provocacion`, puro renombrado de drift
/// schema↔DB, 0 resultados de grep en los 3 archivos de motor citados arriba — verificado TRES
/// veces en esta misma sesión, la última tras pedir explícitamente combinarlo con MULTIPLE) — se
/// usa igualmente, por decisión explícita, en las habilidades marcadas más abajo con el comentario
/// "PROVOCACION sin motor real todavía" — efecto de diseño ya fijado, sin comportamiento mecánico
/// hasta que se implemente. NUNCA combinado con MULTIPLE (la usuaria lo sugirió, pero MULTIPLE solo
/// tiene motor real junto a ATAQUE, nunca junto a PROVOCACION — combinarlos hoy no haría nada
/// distinto a PROVOCACION sola, así que se deja sin combinar hasta que MULTIPLE también soporte
/// esta combinación). NUNCA usar AUMENTO/DEBILIDAD/INVOCACION/LETAL/DESVIAR/OCULTACION/RETIRAR/
/// CANALIZAR/CURAZION/REFLEJAR/EXPULSAR/PURIFICAR aquí.
const FAUNA_CATEGORIA_ABILITIES: FaunaCategoriaAbilityUnlock[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // GUELISES — depredadores de manada/jauría (Ferios). Tema: coordinación de grupo, presión
  // constante, nunca cazan solos si pueden evitarlo.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'GUELISES',
    ability: {
      // Reescrita 2026-09-02 (auditoría "narrativa de jauría/manada en 1v1", petición explícita de
      // la usuaria) — antes dependía de "el resto de la jauría cubre mi espalda", incoherente en
      // un combate 1v1 donde no hay compañeros reales en la escena (`chooseNpcAbility` nunca
      // comprueba si hay otros presentes). Ahora describe el instinto de caza en jauría, propio
      // del animal, funcionando igual de bien solo. Mismo `effects`/`rol`/`preferredAttribute`.
      name: 'Dentellada de jauría',
      icon: '🐺',
      description: 'Cierra las fauces sobre el primer punto débil que deja ver, con el mismo instinto de caza en jauría que usaría rodeado de los suyos.',
      promptText: 'Cierro las fauces sobre el punto débil que deja ver, con el mismo instinto de caza en jauría de siempre, aunque hoy cace sola.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'GUELISES',
    ability: {
      // Reescrita 2026-09-02 (mismo motivo que "Dentellada de jauría") — antes dependía de "el
      // ángulo que deja libre el resto de la manada". Ahora describe el mismo movimiento
      // instintivo de flanqueo, ejecutado en solitario.
      name: 'Flanqueo instintivo',
      icon: '🌀',
      description: 'Se desplaza en un giro brusco, el mismo movimiento de flanqueo que aprendió cazando en jauría, aguantando el golpe que no puede esquivar del todo.',
      promptText: 'Me desplazo en un giro brusco, el mismo flanqueo que aprendí cazando en jauría, y aguanto el golpe que no puedo esquivar del todo.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'GUELISES',
    ability: {
      // Reescrita 2026-09-02 (mismo motivo que arriba) — antes dependía literalmente del número
      // de la jauría presente ("avanza al unísono con el resto"). Ahora la propia presión viene
      // del gruñido y el avance directo del animal, sin necesitar compañeros en escena.
      name: 'Presión de caza',
      icon: '😨',
      description: 'Gruñe bajo y avanza sin dudar, con la misma seguridad de manada que hace dudar a cualquier presa aunque cace sola.',
      promptText: 'Gruño bajo y avanzo sin dudar, con la misma seguridad de manada que me da hacer dudar al rival.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'GUELISES',
    ability: {
      // Reescrita 2026-09-02 (mismo motivo que arriba) — antes dependía de que "otro miembro de
      // la jauría" distrajera al rival. Ahora el propio animal crea la distracción con un
      // amago antes del golpe real, sin necesitar a nadie más.
      name: 'Aturdir por el flanco',
      icon: '💥',
      description: 'Amaga por un lado y golpea de verdad desde el flanco desprotegido, aprovechando el instinto de caza que confunde a la presa sobre dónde llegará el golpe.',
      promptText: 'Amago por un lado y golpeo de verdad desde el flanco que ha dejado desprotegido al dudar de dónde llegaría mi golpe.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'GUELISES',
    ability: {
      name: 'Contragolpe de colmillos',
      icon: '🦷',
      description: 'Deja que el golpe caiga primero y responde con los colmillos apenas nota la abertura.',
      promptText: 'Dejo que el golpe caiga primero y respondo con los colmillos en cuanto nota la abertura.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'GUELISES',
    ability: {
      // Reescrita 2026-09-02 (mismo motivo que arriba) — antes dependía de que hubiera "resto de
      // la jauría" a quien el rival dejara de mirar. Ahora el aullido roba la atención del rival
      // por sí solo, sin necesitar que exista nadie más al que estuviera mirando antes.
      name: 'Aullido de acoso',
      icon: '📢',
      description: 'Un aullido largo, propio de jauría, que arrastra al rival a fijarse solo en quien lo lanza, ignorando cualquier otra cosa un instante.',
      promptText: 'Lanzo un aullido largo, propio de jauría, que lo arrastra a fijarse solo en mí, ignorando un instante todo lo demás.',
      category: 'combate',
      effects: ['CONTROL'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'GUELISES',
    ability: {
      // Reescrita 2026-09-02 (mismo motivo que arriba) — antes dependía literalmente de "el resto
      // de la jauría, corriendo cerca". Ahora es el propio instinto de resistencia de manada
      // (aguantar la caza más tiempo del que un depredador solitario debería poder) lo que
      // devuelve el aliento, sin necesitar compañeros reales presentes.
      name: 'Segundo aliento de caza',
      icon: '🌬️',
      description: 'El mismo instinto de resistencia que aguanta la caza en jauría le devuelve el aliento, incluso cazando sola.',
      promptText: 'El mismo instinto de resistencia que aguanta la caza en jauría me devuelve el aliento, aunque hoy cace sola.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 36,
    categoria: 'GUELISES',
    ability: {
      // PROVOCACION sin motor real todavía (ver comentario de cabecera de este archivo) — efecto
      // de diseño ya fijado, pendiente de implementación futura. Encaja en GUELISES por ser fauna
      // de manada robusta con instinto de alfa (constitución/nivel altos en los ejemplares de
      // esta categoría, p.ej. Ferike nivel 10-16). Reescrita 2026-09-02 (auditoría "narrativa de
      // jauría/manada en 1v1") — antes dependía de "exponerse para que el resto ataque sin
      // oposición", incoherente en 1v1 sin compañeros reales en la escena. Ahora describe el reto
      // directo del alfa, con el mismo instinto de plantar cara sin depender de que haya nadie más
      // presente.
      name: 'Desafío del alfa',
      icon: '👑',
      description: 'Se planta con el porte de un alfa de jauría y reta al rival directamente, sin dudar ni un instante en exponerse al golpe.',
      promptText: 'Me planto con el porte de un alfa de jauría y reto al rival directamente, sin dudar en exponerme al golpe.',
      category: 'combate',
      effects: ['PROVOCACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ACECHANTES — depredadores solitarios de emboscada (Ferios). Tema: sigilo, un único golpe
  // decisivo, sin ayuda de nadie.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'ACECHANTES',
    ability: {
      name: 'Zarpazo de emboscada',
      icon: '🐾',
      description: 'Rompe el sigilo de golpe, cargando todo el peso del ataque en el primer zarpazo desde la cobertura.',
      promptText: 'Rompo el sigilo de golpe, cargando todo el peso del ataque en el primer zarpazo desde la cobertura.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ACECHANTES',
    ability: {
      name: 'Retirada al follaje',
      icon: '🌿',
      description: 'Se funde de nuevo con la cobertura en cuanto el golpe falla, aguantando el contraataque a medio camino de la sombra.',
      promptText: 'Me fundo de nuevo con la cobertura en cuanto el golpe falla, aguantando el contraataque a medio camino de la sombra.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ACECHANTES',
    ability: {
      name: 'Lectura de presa',
      icon: '👁️',
      description: 'Observa desde la cobertura, calculando en silencio cada movimiento antes de decidir si el ataque merece la pena.',
      promptText: 'Observo desde la cobertura, calculando en silencio cada movimiento antes de decidir si el ataque merece la pena.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'ACECHANTES',
    ability: {
      name: 'Golpe al punto ciego',
      icon: '🎯',
      description: 'Encuentra el único ángulo sin cubrir y golpea ahí, dejando al rival aturdido por la sorpresa del acierto.',
      promptText: 'Encuentro el único ángulo sin cubrir y golpeo ahí — la sorpresa del acierto lo deja aturdido.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'ACECHANTES',
    ability: {
      name: 'Instinto de emboscada fallida',
      icon: '🔄',
      description: 'Cuando la emboscada sale mal, el propio instinto responde antes de que el rival complete su ataque.',
      promptText: 'La emboscada sale mal, pero el instinto responde antes de que complete su ataque.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'ACECHANTES',
    ability: {
      name: 'Presencia paralizante',
      icon: '😨',
      description: 'Se deja ver un instante, lo justo para que el rival dude si el verdadero ataque ya ha empezado.',
      promptText: 'Me dejo ver un instante, lo justo para que dude si el verdadero ataque ya ha empezado.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'ACECHANTES',
    ability: {
      name: 'Calma tras el acecho',
      icon: '🌙',
      description: 'El propio silencio del acecho, prolongado, recompone el aliento mejor que cualquier descanso franco.',
      promptText: 'El silencio del acecho, prolongado, me recompone el aliento mejor que cualquier descanso franco.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CORVENES — aves de presa/carroñeras (Ferios). Tema: altura, picado, ojos como objetivo.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'CORVENES',
    ability: {
      name: 'Picado certero',
      icon: '🦅',
      description: 'Cae en picado desde la altura, todo el peso del vuelo concentrado en el golpe del pico o las garras.',
      promptText: 'Caigo en picado desde la altura, todo el peso del vuelo concentrado en el golpe.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'CORVENES',
    ability: {
      name: 'Viraje brusco',
      icon: '🌬️',
      description: 'Rompe la línea de vuelo en el último instante, dejando que el golpe rival pase rozando el plumaje.',
      promptText: 'Rompo la línea de vuelo en el último instante, dejando que el golpe pase rozando el plumaje.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'CORVENES',
    ability: {
      name: 'Ojeo desde el aire',
      icon: '👁️',
      description: 'Traza círculos altos sobre el rival, leyendo sus movimientos antes de decidir el ángulo del próximo picado.',
      promptText: 'Trazo círculos altos, leyendo sus movimientos antes de decidir el ángulo del próximo picado.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'CORVENES',
    ability: {
      name: 'Picotazo al ojo',
      icon: '🎯',
      description: 'Busca el ojo, no la carne — un picotazo certero ahí deja a cualquiera desorientado un instante.',
      promptText: 'Busco el ojo, no la carne — el picotazo certero lo deja desorientado un instante.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'CORVENES',
    ability: {
      name: 'Graznido de guerra',
      icon: '📢',
      description: 'Un graznido agudo y prolongado, señal de caza que hace dudar a cualquier presa consciente de lo que significa.',
      promptText: 'Grazno agudo y prolongado — la señal de caza hace dudar a cualquiera que sepa lo que significa.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'CORVENES',
    ability: {
      name: 'Garras en respuesta',
      icon: '🦶',
      description: 'Cierra las garras sobre quien intenta derribarla del aire, respondiendo al golpe antes de perder altura.',
      promptText: 'Cierro las garras sobre quien intenta derribarme del aire, respondiendo antes de perder altura.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'CORVENES',
    ability: {
      name: 'Corriente ascendente',
      icon: '🌀',
      description: 'Encuentra la corriente cálida que la lleva a planear sin esfuerzo, recuperando fuerzas antes del siguiente picado.',
      promptText: 'Encuentro la corriente cálida que me lleva a planear sin esfuerzo, recuperando fuerzas para el siguiente picado.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ZANCUDOS — aves terrestres/de charca (Ferios). Tema: velocidad de patas, picoteo rápido,
  // huida más que confrontación.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'ZANCUDOS',
    ability: {
      name: 'Picoteo veloz',
      icon: '💥',
      description: 'Encadena picotazos rápidos y cortos, buscando la parte más blanda y desprotegida del rival.',
      promptText: 'Encadeno picotazos rápidos y cortos, buscando la parte más blanda y desprotegida.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ZANCUDOS',
    ability: {
      name: 'Zancada esquiva',
      icon: '🏃',
      description: 'Aparta las patas largas del camino del golpe en el último instante, sin perder el equilibrio sobre el barro.',
      promptText: 'Aparto las patas del camino del golpe en el último instante, sin perder el equilibrio sobre el barro.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ZANCUDOS',
    ability: {
      name: 'Carrera de huida',
      icon: '🐦',
      description: 'Rompe a correr entre la charca y la orilla, aprovechando la confusión del terreno para escapar del todo.',
      promptText: 'Rompo a correr entre la charca y la orilla, aprovechando la confusión del terreno para escapar del todo.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'utilidad',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'ZANCUDOS',
    ability: {
      name: 'Aleteo cegador',
      icon: '🌫️',
      description: 'Levanta barro y agua de un aletazo justo antes de picotear, dejando al rival aturdido un instante sin ver bien.',
      promptText: 'Levanto barro y agua de un aletazo antes de picotear — lo dejo aturdido, sin ver bien un instante.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'ZANCUDOS',
    ability: {
      // Reescrita 2026-09-02 (auditoría "narrativa de jauría/manada en 1v1") — antes dependía de
      // "vigilar al resto de la bandada". Ahora es el mismo instinto de alerta constante, propio
      // de ave que vive en bandada, aplicado a leer al rival directamente.
      name: 'Alerta constante',
      icon: '👁️',
      description: 'Vigila con la misma alerta constante de quien vive en bandada, leyendo el peligro real antes de que llegue de verdad.',
      promptText: 'Vigilo con la misma alerta constante de quien vive en bandada, leyendo el peligro real antes de que llegue de verdad.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'ZANCUDOS',
    ability: {
      name: 'Respiro entre chudos',
      icon: '🌾',
      description: 'Se detiene un instante entre los chudos altos, invisible para quien la persigue, recuperando el aliento.',
      promptText: 'Me detengo un instante entre los chudos altos, invisible para quien me persigue, recuperando el aliento.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'ZANCUDOS',
    ability: {
      name: 'Contragolpe de pico',
      icon: '🦷',
      description: 'Justo cuando el golpe rival parece seguro, gira el cuello con rapidez y clava el pico antes de que conecte del todo.',
      promptText: 'Justo cuando su golpe parece seguro, giro el cuello con rapidez y clavo el pico antes de que conecte del todo.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BESTIONES — grandes herbívoros/bestias de manada (Ferios). Tema: peso, embestida, resistencia
  // bruta, casi nunca inician la pelea.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'BESTIONES',
    ability: {
      name: 'Embestida de peso',
      icon: '💥',
      description: 'Carga con todo su peso, capaz de derribar a quien no logre apartarse a tiempo.',
      promptText: 'Cargo con todo mi peso, buscando derribar a quien no logre apartarse a tiempo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'BESTIONES',
    ability: {
      // Renombrada 2026-09-02 (auditoría "narrativa de jauría/manada en 1v1") — solo el `name`
      // aludía a "manada" (la description/promptText ya funcionaban en solitario, sin cambios);
      // se renombra para no sugerir que depende de compañeros presentes en la escena.
      name: 'Coraza natural',
      icon: '🛡️',
      description: 'Se planta con las patas bien firmes, dejando que el grosor de su propio cuerpo absorba el golpe.',
      promptText: 'Me planto con las patas bien firmes, dejando que el grosor de mi propio cuerpo absorba el golpe.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'BESTIONES',
    ability: {
      name: 'Bufido de advertencia',
      icon: '😤',
      description: 'Un bufido bajo y una pisada fuerte que retumba en el suelo, avisando de que la próxima embestida va en serio.',
      promptText: 'Bufo bajo y piso con fuerza, dejando claro que la próxima embestida va en serio.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'BESTIONES',
    ability: {
      name: 'Pisotón sísmico',
      icon: '🦶',
      description: 'El impacto de sus pezuñas contra el suelo sacude a quien está cerca, dejándolo aturdido por el temblor.',
      promptText: 'El impacto de mis pezuñas contra el suelo sacude a quien está cerca, aturdido por el temblor.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'BESTIONES',
    ability: {
      // Reescrita 2026-09-02 (auditoría "narrativa de jauría/manada en 1v1") — antes dependía
      // literalmente de "el resto de la manada, cerca". Ahora es el propio instinto de manada
      // (aguantar más tiempo del que un ejemplar aislado debería) el que devuelve el aliento.
      name: 'Segundo aliento',
      icon: '🌬️',
      description: 'El mismo instinto de resistencia que aguanta plantada frente a una manada entera le devuelve el aliento y la calma para seguir.',
      promptText: 'El mismo instinto de resistencia que me aguanta plantada frente a una manada entera me devuelve el aliento y la calma para seguir.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'BESTIONES',
    ability: {
      name: 'Cornamenta al contragolpe',
      icon: '🦌',
      description: 'Baja la cabeza justo cuando el golpe rival ya parece seguro, respondiendo con la cornamenta entera.',
      promptText: 'Bajo la cabeza justo cuando el golpe ya parece seguro, respondiendo con la cornamenta entera.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'BESTIONES',
    ability: {
      // Reescrita 2026-09-02 (auditoría "narrativa de jauría/manada en 1v1") — antes dependía de
      // "interponerse entre la manada y la amenaza". Ahora el mismo instinto de alfa se planta de
      // frente y fuerza la atención del rival sobre sí misma, sin necesitar a nadie detrás.
      name: 'Instinto de alfa',
      icon: '👑',
      description: 'Se planta de frente con el porte de un alfa, obligando a que toda la atención del rival caiga sobre ella.',
      promptText: 'Me planto de frente con el porte de un alfa, obligando a que toda su atención caiga sobre mí.',
      category: 'combate',
      effects: ['CONTROL'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 36,
    categoria: 'BESTIONES',
    ability: {
      // PROVOCACION sin motor real todavía (ver comentario de cabecera de este archivo) — efecto
      // de diseño ya fijado, pendiente de implementación futura. Encaja de forma directa en
      // BESTIONES: grandes herbívoros con la constitución más alta de todo el catálogo de fauna
      // (Gargantúa de Ceniza fuerza 20/constitución 22, mismo perfil que Corredor de Cauce/
      // Múrgol/Cuernahoja) — plantarse a recibir toda la carga del rival es justo el rol que ya
      // cumple "Instinto de alfa" (CONTROL), solo que aquí llevado a la forma más pura y central
      // del kit: un desafío directo, no un robo de iniciativa disfrazado. Reescrita 2026-09-02
      // (auditoría "narrativa de jauría/manada en 1v1") — antes dependía de "no contra el resto
      // de la manada", incoherente en 1v1.
      name: 'Embestida de reto',
      icon: '🐾',
      description: 'Baja la cabeza y golpea el suelo repetidamente, retando sin ambigüedad a que la próxima carga vaya contra ella.',
      promptText: 'Bajo la cabeza y golpeo el suelo repetidamente, retando sin ambigüedad a que la próxima carga vaya contra mí.',
      category: 'combate',
      effects: ['PROVOCACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RONDINES — pequeños mamíferos omnívoros (Ferios). Tema: madrigueras, huida rápida, mordiscos
  // oportunistas más que fuerza.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'RONDINES',
    ability: {
      name: 'Mordisco oportunista',
      icon: '🦫',
      description: 'Aprovecha el primer descuido para clavar los incisivos donde más duele, sin darle tiempo a reaccionar.',
      promptText: 'Aprovecho el primer descuido para clavar los incisivos donde más duele.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'RONDINES',
    ability: {
      name: 'Retirada a la madriguera',
      icon: '🕳️',
      description: 'Se cuela por la abertura más estrecha, aguantando el golpe a medio camino de la seguridad de su propia madriguera.',
      promptText: 'Me cuelo por la abertura más estrecha, aguantando el golpe a medio camino de mi propia madriguera.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'RONDINES',
    ability: {
      name: 'Olfateo de peligro',
      icon: '👃',
      description: 'Se detiene un instante a olfatear el aire, leyendo la amenaza real antes de decidir si merece la pena quedarse.',
      promptText: 'Me detengo un instante a olfatear el aire, leyendo la amenaza real antes de decidir si merece la pena quedarme.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'RONDINES',
    ability: {
      name: 'Mordisco al tendón',
      icon: '🎯',
      description: 'Busca el tendón expuesto y muerde con fuerza desproporcionada para su tamaño, dejando la pierna rival inservible un instante.',
      promptText: 'Busco el tendón expuesto y muerdo con fuerza desproporcionada para mi tamaño.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'RONDINES',
    ability: {
      name: 'Descanso en la madriguera',
      icon: '🌙',
      description: 'Un respiro breve al abrigo de la propia madriguera, recuperando fuerzas antes de volver a asomar.',
      promptText: 'Un respiro breve al abrigo de mi propia madriguera, recuperando fuerzas antes de volver a asomar.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'RONDINES',
    ability: {
      name: 'Mordisco al descuido',
      icon: '🦷',
      description: 'Espera inmóvil hasta que el rival baja la guardia y entonces muerde, respondiendo al golpe que ya daba por segura la victoria.',
      promptText: 'Espero inmóvil hasta que baja la guardia y entonces muerdo, respondiendo al golpe que ya daba por segura la victoria.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'RONDINES',
    ability: {
      name: 'Chillido de alarma',
      icon: '📢',
      description: 'Un chillido agudo que sobresalta al rival lo justo para hacerle dudar del siguiente movimiento.',
      promptText: 'Un chillido agudo lo sobresalta lo justo para hacerle dudar del siguiente movimiento.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // QUITINOS — insectos/artrópodos acorazados (Florial). Tema: caparazón, paciencia, cambio de
  // ritmo lento a golpe brusco.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'QUITINOS',
    ability: {
      name: 'Golpe de mandíbula',
      icon: '🦷',
      description: 'Cierra las mandíbulas acorazadas con toda la fuerza que permite su caparazón, lento pero certero.',
      promptText: 'Cierro las mandíbulas acorazadas con toda la fuerza que permite mi caparazón.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'QUITINOS',
    ability: {
      name: 'Caparazón cerrado',
      icon: '🛡️',
      description: 'Repliega las extremidades bajo el caparazón, dejando que la placa dura absorba el golpe entero.',
      promptText: 'Repliego las extremidades bajo el caparazón, dejando que la placa dura absorba el golpe entero.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'QUITINOS',
    ability: {
      name: 'Inmovilidad de roca',
      icon: '🪨',
      description: 'Se queda completamente quieto, confundido con la roca o la corteza, calculando si merece la pena moverse.',
      promptText: 'Me quedo completamente quieto, confundido con la roca, calculando si merece la pena moverme.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'QUITINOS',
    ability: {
      name: 'Pinza aturdidora',
      icon: '💥',
      description: 'Cierra la pinza mayor con un chasquido seco que aturde por el propio impacto, antes de que llegue el dolor.',
      promptText: 'Cierro la pinza mayor con un chasquido seco que aturde por el propio impacto.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'QUITINOS',
    ability: {
      name: 'Reflejo de caparazón',
      icon: '🔁',
      description: 'La curva exacta de la placa desvía el golpe rival de vuelta contra quien lo lanzó.',
      promptText: 'La curva exacta de mi placa desvía el golpe de vuelta contra quien lo lanzó.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'QUITINOS',
    ability: {
      name: 'Chasquido de advertencia',
      icon: '😨',
      description: 'Golpea las pinzas entre sí produciendo un chasquido seco y repetido, aviso claro de lo que viene si se acercan más.',
      promptText: 'Golpeo las pinzas entre sí en un chasquido seco y repetido — aviso claro de lo que viene si se acercan más.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'QUITINOS',
    ability: {
      name: 'Letargo bajo la placa',
      icon: '😴',
      description: 'Ralentiza el propio cuerpo bajo el caparazón, ahorrando fuerzas hasta que vuelva a hacer falta moverse.',
      promptText: 'Ralentizo mi propio cuerpo bajo el caparazón, ahorrando fuerzas hasta que vuelva a hacer falta moverme.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 36,
    categoria: 'QUITINOS',
    ability: {
      // PROVOCACION sin motor real todavía (ver comentario de cabecera de este archivo) — efecto
      // de diseño ya fijado, pendiente de implementación futura. Un artrópodo acorazado (mismo
      // perfil de constitución alta que Escorante/Imanio/Terkash) puede permitirse plantarse y
      // exponerse porque el propio caparazón ("Caparazón cerrado"/"Reflejo de caparazón") ya
      // aguanta el golpe — un desafío calculado, no valentía a ciegas.
      name: 'Postura de reto',
      icon: '🛡️',
      description: 'Se yergue todo lo alto que permite su caparazón y golpea las mandíbulas o pinzas entre sí, retando abiertamente a que el próximo golpe vaya contra ella.',
      promptText: 'Me yergo todo lo alto que permite mi caparazón y golpeo las mandíbulas entre sí, retando abiertamente a que el próximo golpe vaya contra mí.',
      category: 'combate',
      effects: ['PROVOCACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ESCAMADOS — reptiles/anfibios (Florial). Tema: sangre fría, mordisco certero, huida al agua o
  // bajo tierra cuando conviene.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'ESCAMADOS',
    ability: {
      name: 'Mordisco de sangre fría',
      icon: '🦷',
      description: 'Cierra la mandíbula sin prisa ni duda — la sangre fría no conoce el nerviosismo del ataque.',
      promptText: 'Cierro la mandíbula sin prisa ni duda, sin el nerviosismo que sentiría cualquier otra criatura.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ESCAMADOS',
    ability: {
      name: 'Escama endurecida',
      icon: '🛡️',
      description: 'Tensa las escamas del lomo, superficie dura que amortigua buena parte de cualquier golpe directo.',
      promptText: 'Tenso las escamas del lomo, superficie dura que amortigua buena parte de cualquier golpe directo.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ESCAMADOS',
    ability: {
      name: 'Huida al agua o la madriguera',
      icon: '💦',
      description: 'Se desliza hacia el agua o la tierra suelta más cercana, casi imposible de seguir una vez dentro.',
      promptText: 'Me deslizo hacia el agua o la tierra suelta más cercana, casi imposible de seguir una vez dentro.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'utilidad',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'ESCAMADOS',
    ability: {
      name: 'Latigazo de cola',
      icon: '💥',
      description: 'Gira el cuerpo entero y golpea con la cola en un barrido que deja al rival tambaleándose, aturdido.',
      promptText: 'Giro el cuerpo entero y golpeo con la cola en un barrido que lo deja tambaleándose.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'ESCAMADOS',
    ability: {
      name: 'Ojo de reptil',
      icon: '👁️',
      description: 'Los ojos, casi sin parpadear, siguen cada movimiento del rival sin delatar cuándo llegará el ataque real.',
      promptText: 'Mis ojos, casi sin parpadear, siguen cada uno de sus movimientos sin delatar cuándo llegará mi ataque real.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'ESCAMADOS',
    ability: {
      name: 'Sangre fría bajo presión',
      icon: '🌡️',
      description: 'El cuerpo se enfría por dentro, calmando el propio ritmo hasta recuperar el aliento sin urgencia alguna.',
      promptText: 'Mi cuerpo se enfría por dentro, calmando mi propio ritmo hasta recuperar el aliento sin urgencia alguna.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'ESCAMADOS',
    ability: {
      name: 'Mordisco al descuido',
      icon: '🦷',
      description: 'Espera inmóvil, sangre fría pura, hasta que el golpe rival ya parece seguro — y entonces muerde primero.',
      promptText: 'Espero inmóvil, sangre fría pura, hasta que su golpe ya parece seguro — y entonces muerdo primero.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NADANTES — peces/fauna acuática (Florial). Tema: agua como refugio y arma, esquiva antes que
  // fuerza bruta.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'NADANTES',
    ability: {
      name: 'Embiste desde el agua',
      icon: '💦',
      description: 'Sale disparado desde bajo el agua con todo el impulso de la corriente, embistiendo antes de que lo esperen.',
      promptText: 'Salgo disparado desde bajo el agua con todo el impulso de la corriente.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'NADANTES',
    ability: {
      name: 'Esquiva acuática',
      icon: '🌊',
      description: 'Se desliza entre la corriente con un giro brusco, dejando que el agua misma desvíe el golpe.',
      promptText: 'Me deslizo entre la corriente con un giro brusco, dejando que el agua misma desvíe el golpe.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'NADANTES',
    ability: {
      name: 'Lectura de corriente',
      icon: '👁️',
      description: 'Se queda quieto en la corriente, leyendo cada vibración del agua antes de decidir el próximo movimiento.',
      promptText: 'Me quedo quieto en la corriente, leyendo cada vibración del agua antes de decidir mi próximo movimiento.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'NADANTES',
    ability: {
      name: 'Salto desde la charca',
      icon: '🎯',
      description: 'Salta fuera del agua directo al punto débil del rival, el impacto tan repentino que lo deja aturdido.',
      promptText: 'Salto fuera del agua directo a su punto débil — el impacto tan repentino lo deja aturdido.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'NADANTES',
    ability: {
      name: 'Refugio en lo profundo',
      icon: '🕳️',
      description: 'Se sumerge en la parte más profunda de la charca o el cauce, recuperando el aliento donde nadie puede seguirlo.',
      promptText: 'Me sumerjo en la parte más profunda de la charca, recuperando el aliento donde nadie puede seguirme.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'NADANTES',
    ability: {
      name: 'Coletazo de respuesta',
      icon: '🦷',
      description: 'Justo cuando el golpe rival parece seguro dentro del agua, responde con un coletazo brusco desde abajo.',
      promptText: 'Justo cuando su golpe parece seguro dentro del agua, respondo con un coletazo brusco desde abajo.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'NADANTES',
    ability: {
      name: 'Desconcierto en la corriente',
      icon: '🌀',
      description: 'Remueve el fondo turbio de golpe, dejando el agua tan revuelta que el rival ya no sabe hacia dónde mirar.',
      promptText: 'Remuevo el fondo turbio de golpe, dejando el agua tan revuelta que ya no sabe hacia dónde mirar.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ORDENADOS — categoría de Goirme (orden/simetría/geometría). SIN fauna real asignada todavía
  // (decisión explícita: "categoría vacía, solo definir el TIPO... para uso futuro") — Goirme
  // "tiene poca fauna propia en la Meseta del Orden" (genesis.md). 7 habilidades ya definidas para
  // que la infraestructura esté lista en cuanto se diseñe fauna real de esta categoría.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'ORDENADOS',
    ability: {
      name: 'Golpe simétrico',
      icon: '📐',
      description: 'Golpea siguiendo el mismo ángulo exacto una y otra vez, sin desviarse ni un grado del trazo perfecto.',
      promptText: 'Golpeo siguiendo el mismo ángulo exacto, sin desviarme ni un grado del trazo perfecto.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ORDENADOS',
    ability: {
      name: 'Postura de simetría',
      icon: '🛡️',
      description: 'Se coloca en la postura exacta que reparte cualquier golpe por igual entre ambos costados del cuerpo.',
      promptText: 'Me coloco en la postura exacta que reparte cualquier golpe por igual entre ambos costados.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ORDENADOS',
    ability: {
      name: 'Cálculo de patrón',
      icon: '📏',
      description: 'Observa el movimiento rival buscando el patrón que se repite, el orden oculto bajo el caos aparente del combate.',
      promptText: 'Observo su movimiento buscando el patrón que se repite, el orden oculto bajo el caos aparente.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'ORDENADOS',
    ability: {
      name: 'Trazo preciso',
      icon: '🎯',
      description: 'El golpe cae exactamente donde el cálculo decía que debía caer, dejando al rival desorientado por la precisión.',
      promptText: 'El golpe cae exactamente donde mi cálculo decía que debía caer.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'ORDENADOS',
    ability: {
      name: 'Reflejo geométrico',
      icon: '🔁',
      description: 'Devuelve el golpe siguiendo el mismo ángulo exacto con el que llegó, como un espejo perfecto.',
      promptText: 'Devuelvo el golpe siguiendo el mismo ángulo exacto con el que llegó.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'ORDENADOS',
    ability: {
      name: 'Presencia inquebrantable',
      icon: '😨',
      description: 'Se queda perfectamente quieto e inmutable, un orden tan ajeno al caos del combate que resulta perturbador.',
      promptText: 'Me quedo perfectamente quieto e inmutable, un orden tan ajeno al caos que resulta perturbador.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'ORDENADOS',
    ability: {
      name: 'Equilibrio recompuesto',
      icon: '⚖️',
      description: 'Recompone su propio equilibrio interno con precisión, recuperando fuerzas de un modo tan ordenado como todo lo demás en ella.',
      promptText: 'Recompongo mi propio equilibrio interno con precisión, recuperando fuerzas de un modo tan ordenado como todo lo demás en mí.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // UMBRIAS — categoría de Kroj (sigilo/noche/silencio). SIN fauna real asignada todavía (mismo
  // criterio que ORDENADOS) — Kroj "tiene poca fauna propia" fuera de los Nabieus y las Sombras de
  // Kroj (genesis.md, mención de lore, sin fila propia en el catálogo de fauna hoy). 7 habilidades
  // ya definidas para uso futuro.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'UMBRIAS',
    ability: {
      name: 'Golpe desde la sombra',
      icon: '🌑',
      description: 'Ataca desde la oscuridad más cerrada, sin que el rival llegue a verla llegar del todo.',
      promptText: 'Ataco desde la oscuridad más cerrada, sin que llegue a verme llegar del todo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'UMBRIAS',
    ability: {
      name: 'Fusión con la noche',
      icon: '🌙',
      description: 'Se funde con la oscuridad cerrada, dejando que el golpe rival caiga sobre lo que ya no está del todo ahí.',
      promptText: 'Me fundo con la oscuridad cerrada, dejando que el golpe caiga sobre lo que ya no está del todo ahí.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'UMBRIAS',
    ability: {
      name: 'Silencio absoluto',
      icon: '👁️',
      description: 'No se le oye llegar — observa en un silencio total, calculando el momento exacto antes de actuar.',
      promptText: 'No se me oye llegar — observo en un silencio total, calculando el momento exacto antes de actuar.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'UMBRIAS',
    ability: {
      name: 'Zarpazo sin sonido',
      icon: '🎯',
      description: 'El golpe llega sin ningún aviso previo, ni sonido ni sombra que lo delate — el rival tarda en reaccionar, aturdido.',
      promptText: 'El golpe llega sin ningún aviso previo, ni sonido ni sombra que lo delate.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'UMBRIAS',
    ability: {
      name: 'Presencia de la noche cerrada',
      icon: '😨',
      description: 'Deja que la propia oscuridad hable por ella, un silencio tan total que resulta más temible que cualquier gruñido.',
      promptText: 'Dejo que la propia oscuridad hable por mí, un silencio tan total que resulta más temible que cualquier gruñido.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'UMBRIAS',
    ability: {
      name: 'Respuesta desde la nada',
      icon: '🔁',
      description: 'Cuando el golpe rival parece seguro contra la oscuridad, la respuesta llega desde un ángulo que nadie vio venir.',
      promptText: 'Cuando su golpe parece seguro contra la oscuridad, mi respuesta llega desde un ángulo que nadie vio venir.',
      category: 'combate',
      effects: ['CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'UMBRIAS',
    ability: {
      name: 'Descanso en la noche',
      icon: '🌙',
      description: 'La propia noche cerrada la envuelve y recompone, un descanso que ningún otro momento del día le ofrece igual.',
      promptText: 'La propia noche cerrada me envuelve y recompone, un descanso que ningún otro momento del día me ofrece igual.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MUDOS_SALVAJE — fauna EXISTENTE mutada por la magia Salvaje derramada tras el Estallido de
  // Tarkor (genesis.md § "El Estallido") — animales reales del catálogo con algo imposible/mítico
  // ya en su bio (Kirelon Arenoso, Salamandra de Escoria — ver mapeo completo en el resumen de la
  // entrega). Tema: la propia mutación como arma — algo que no debería poder hacer un animal
  // "normal" (magnetismo, calor imposible, sentidos fuera de lo natural).
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'MUDOS_SALVAJE',
    ability: {
      name: 'Golpe de lo imposible',
      icon: '✨',
      description: 'Golpea con una parte de su cuerpo que no debería comportarse así — resto visible de la mutación de la magia Salvaje.',
      promptText: 'Golpeo con una parte de mi cuerpo que no debería comportarse así.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'MUDOS_SALVAJE',
    ability: {
      name: 'Piel alterada',
      icon: '🛡️',
      description: 'La piel o escama mutada resiste de un modo que ningún animal "normal" de su especie podría explicar.',
      promptText: 'Mi piel mutada resiste de un modo que ningún animal "normal" de mi especie podría explicar.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'MUDOS_SALVAJE',
    ability: {
      name: 'Sentido fuera de lo natural',
      icon: '👁️',
      description: 'Percibe al rival por un sentido que ningún animal debería tener, leyendo su siguiente movimiento antes de que ocurra.',
      promptText: 'Percibo al rival por un sentido que ningún animal debería tener.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'MUDOS_SALVAJE',
    ability: {
      name: 'Descarga mutada',
      icon: '💥',
      description: 'Libera de golpe la parte más inestable de su propia mutación contra el rival, dejándolo aturdido por lo que acaba de presenciar.',
      promptText: 'Libero de golpe la parte más inestable de mi propia mutación — lo deja aturdido por lo que acaba de presenciar.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'magia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'MUDOS_SALVAJE',
    ability: {
      name: 'Reflejo de magia salvaje',
      icon: '🔁',
      description: 'Lo que queda de magia Salvaje bajo la piel devuelve el golpe rival transformado en algo que ya no reconoce.',
      promptText: 'Lo que queda de magia Salvaje bajo mi piel devuelve el golpe transformado en algo que ya no reconoce.',
      category: 'combate',
      effects: ['REFRACTAR'],
      rol: 'defensa',
      preferredAttribute: 'magia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'MUDOS_SALVAJE',
    ability: {
      name: 'Presencia antinatural',
      icon: '😨',
      description: 'Basta con que el rival note lo que tiene delante no es del todo natural para que dude del siguiente paso.',
      promptText: 'Basta con que note que lo que tiene delante no es del todo natural para que dude de su siguiente paso.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'MUDOS_SALVAJE',
    ability: {
      name: 'Estabilización salvaje',
      icon: '🌀',
      description: 'La propia mutación, inestable por naturaleza, se asienta un instante y le devuelve fuerzas de un modo que no debería ser posible.',
      promptText: 'Mi propia mutación, inestable por naturaleza, se asienta un instante y me devuelve fuerzas de un modo que no debería ser posible.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 36,
    categoria: 'MUDOS_SALVAJE',
    ability: {
      // PROVOCACION sin motor real todavía (ver comentario de cabecera de este archivo) — efecto
      // de diseño ya fijado, pendiente de implementación futura. Kirelon Arenoso (nivel 8-14,
      // fuerza 17/constitución 16) es el ejemplar más robusto y de mayor nivel real de esta
      // categoría — la propia mutación (piel/escama alterada, "Piel alterada" ya en el kit)
      // sostiene un desafío directo sin miedo real a la respuesta.
      name: 'Desafío mutado',
      icon: '✨',
      description: 'Expone sin dudarlo la parte más visiblemente mutada de su cuerpo, retando abiertamente a que golpeen ahí — confiando en que ninguna respuesta normal baste.',
      promptText: 'Expongo sin dudarlo la parte más visiblemente mutada de mi cuerpo, retando a que golpeen ahí.',
      category: 'combate',
      effects: ['PROVOCACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ROKRATS_ESTALLIDO — seres nacidos DIRECTAMENTE de la magia Salvaje, sin animal base real
  // (igual que los Orcos, genesis.md § "El Estallido") — decisión explícita: "no inventes fauna
  // real... categoría vacía, solo definir el TIPO... para contenido futuro". 7 habilidades ya
  // definidas.
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    categoria: 'ROKRATS_ESTALLIDO',
    ability: {
      name: 'Zarpazo de magia cruda',
      icon: '✨',
      description: 'Golpea con una extremidad hecha de magia Salvaje solidificada, sin ningún animal real detrás que la explique.',
      promptText: 'Golpeo con una extremidad hecha de magia Salvaje solidificada.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'magia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ROKRATS_ESTALLIDO',
    ability: {
      name: 'Cuerpo inestable',
      icon: '🛡️',
      description: 'Su propio cuerpo, nunca del todo fijo, absorbe el golpe deformándose en vez de romperse.',
      promptText: 'Mi propio cuerpo, nunca del todo fijo, absorbe el golpe deformándose en vez de romperse.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'magia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    categoria: 'ROKRATS_ESTALLIDO',
    ability: {
      name: 'Percepción de lo salvaje',
      icon: '👁️',
      description: 'Percibe al rival como pura energía en movimiento, leyendo su intención antes de que se convierta en gesto.',
      promptText: 'Percibo al rival como pura energía en movimiento, leyendo su intención antes de que se convierta en gesto.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    categoria: 'ROKRATS_ESTALLIDO',
    ability: {
      name: 'Estallido menor',
      icon: '💥',
      description: 'Libera una pequeña descarga de la misma magia que le dio origen, un eco menor del Estallido que aturde por su propia naturaleza.',
      promptText: 'Libero una pequeña descarga de la misma magia que me dio origen, un eco menor del Estallido.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'magia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    categoria: 'ROKRATS_ESTALLIDO',
    ability: {
      name: 'Devolución de magia',
      icon: '🔁',
      description: 'La magia Salvaje que lo compone devuelve el golpe rival transformado en algo irreconocible.',
      promptText: 'La magia Salvaje que me compone devuelve el golpe transformado en algo irreconocible.',
      category: 'combate',
      effects: ['REFRACTAR'],
      rol: 'defensa',
      preferredAttribute: 'magia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    categoria: 'ROKRATS_ESTALLIDO',
    ability: {
      name: 'Presencia del Estallido',
      icon: '😨',
      description: 'Solo con estar cerca, la sensación de estar ante algo que no debería existir hace dudar a cualquiera.',
      promptText: 'Solo con estar cerca, la sensación de estar ante algo que no debería existir hace dudar a cualquiera.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 32,
    categoria: 'ROKRATS_ESTALLIDO',
    ability: {
      name: 'Reabsorción salvaje',
      icon: '🌀',
      description: 'Reabsorbe parte de su propia energía dispersa, recomponiéndose de un modo que ningún ser vivo "real" podría hacer.',
      promptText: 'Reabsorbo parte de mi propia energía dispersa, recomponiéndome de un modo que ningún ser vivo "real" podría hacer.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 36,
    categoria: 'ROKRATS_ESTALLIDO',
    ability: {
      // PROVOCACION sin motor real todavía (ver comentario de cabecera de este archivo) — efecto
      // de diseño ya fijado, pendiente de implementación futura. Un ser nacido directo de la
      // magia Salvaje, sin ningún animal base que limite su resistencia real, es la fauna con más
      // margen narrativo de todo el catálogo para un desafío directo — mismo criterio que
      // MUDOS_SALVAJE, llevado un paso más allá (nada "normal" lo sostiene, es magia pura).
      name: 'Provocación del Estallido',
      icon: '✨',
      description: 'Se abre en canal la propia inestabilidad, un desafío tan directo y antinatural que resulta casi imposible no fijarse en ella antes que en cualquier otra cosa.',
      promptText: 'Me abro en canal mi propia inestabilidad, un desafío tan directo que resulta casi imposible no fijarse en mí antes que en cualquier otra cosa.',
      category: 'combate',
      effects: ['PROVOCACION'],
      rol: 'utilidad',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
];

/// Para la Enciclopedia (mismo criterio que `classAbilityUnlocksForClase`) — TODAS las habilidades
/// de esta categoría, sin filtrar por nivel. El filtro por nivel real lo hace
/// `npcCombatAbilitiesFor` (npcCombatAbilities.ts), igual que ya hace con `unlock.level > npc.level`
/// para las de clase.
export function faunaCategoriaAbilityUnlocksFor(categoria: FaunaCategoria): FaunaCategoriaAbilityUnlock[] {
  return FAUNA_CATEGORIA_ABILITIES.filter((u) => u.categoria === categoria);
}

/// Para el motor de turnos — solo las ya desbloqueadas por el nivel actual del NPC, mismo criterio
/// que `especializacionAbilityUnlocksFor` (classAbilities.ts). `npcCombatAbilitiesFor` podría
/// filtrar `faunaCategoriaAbilityUnlocksFor` por nivel él mismo (mismo patrón que usa con
/// `classAbilityUnlocksForClase`), pero se expone también esta forma ya filtrada para no repetir
/// `if (unlock.level > npc.level) continue` en dos sitios.
export function faunaCategoriaAbilitiesForLevel(categoria: FaunaCategoria, level: number): StartingAbility[] {
  return FAUNA_CATEGORIA_ABILITIES.filter((u) => u.categoria === categoria && u.level <= level).map((u) => u.ability);
}
