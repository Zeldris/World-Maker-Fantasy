import type { StartingAbility } from './startingAbilities.js';
import type { Clase, Especializacion } from '@prisma/client';
import { ENERGY_COST_BASICA, ENERGY_COST_MEDIA, ENERGY_COST_AVANZADA, ENERGY_COST_EXPERTA } from './energy.js';

export type { Clase, Especializacion } from '@prisma/client';

/// Sistema de clases y especializaciones (2026-08-24, Grupo 3 § Sistema de clases, diseño
/// completo en docs/rpgtarkor/clases.md) — reemplaza la lista plana original (2026-07-29, 4
/// habilidades de apoyo por clase, sin especialización) por tronco común (niveles 1-8) +
/// especialización elegida a nivel 10 (huecos reales en 12/16/19/24/28/32/36/40, mismo ritmo que
/// `progression.ts`). Dos de las 4 habilidades de tronco de Guerrero y una de Cazador se
/// REASIGNARON a especializaciones concretas (Grito de Guerra/Grito tenebroso → Berserker;
/// Compañero cazador → Domador) y se sustituyeron por 2 nuevas en el mismo hueco de nivel — un
/// personaje YA en curso con esas 3 SavedAction "de serie" conserva las que ya tenía (nunca se
/// borran), solo los desbloqueos NUEVOS a partir de aquí siguen la tabla de abajo.
///
/// Solo 3 clases tienen alguna `ClassAbilityUnlock` real esta pasada: GUERRERO, CAZADOR, CHAMAN
/// (las únicas con "repaso a fondo" completo en clases.md). Dentro de esas 3, Domador y Totémico
/// se quedan en 0 huecos reales — dependen por completo de compañeros/invocación, infraestructura
/// de combate multi-objetivo que todavía no existe (combate-multiple.md) — siguen siendo
/// especializaciones válidas (`Especializacion.DOMADOR`/`TOTEMICO`, un NPC puede tenerlas
/// asignadas), simplemente sin ningún desbloqueo de habilidad todavía.
///
/// De los 25 efectos de `AbilityEffect` (+ `CONVERSION`, nuevo esta pasada), solo estos están
/// implementados de verdad hoy: ATAQUE/ATURDIMIENTO/INTIMIDACION/AGUANTE/ANALISIS/RECUPERACION/
/// LETAL/LIMITADA/CONVERSION. El resto (AUMENTO/DEBILIDAD/CANALIZAR/CONTRA/CURAZION/REFLEJAR/
/// REFRACTAR/PURIFICAR/PROVOCACION/RETIRAR/EXPULSAR — duración por turnos; INVOCACION/CONTROL/
/// MULTIPLE/DESVIAR/OCULTACION/COMPANERO — combate multi-objetivo) sigue sin construir, así que
/// solo se dan de alta aquí las habilidades de clases.md marcadas "✅ lista" (verificado efecto a
/// efecto contra este enum real, no copiado tal cual del doc — varias filas de Convocador/Opresor
/// estaban mal marcadas "✅" en el propio documento pese a usar AUMENTO/DEBILIDAD/MULTIPLE/CONTRA,
/// corregido aquí).
///
/// `attributeBonus` (2026-08-24, clases.md § "Habilidad de daño vs ataque básico") — bonus fijo de
/// atributo que da usar la habilidad, construido en la MISMA pasada que este archivo
/// (`StartingAbility.attributeBonus`, `ExchangeParticipant.attributeBonus` en combatExchange.ts).
/// Números tomados del texto de "Estado" de cada fila del doc cuando dan una cifra base clara;
/// donde el doc solo describe el efecto sin bonus propio, o el bonus depende de un umbral
/// condicional que la infraestructura actual no soporta (p.ej. "+10 si Convaleciente, si no +2" —
/// solo el caso base se queda), se deja en 0/undefined. Cifras de partida, ajustables jugando,
/// igual que el resto de números de este proyecto.
export interface ClassAbilityUnlock {
  level: number;
  clase: Clase;
  /// undefined = tronco común (cualquier personaje de esta clase la aprende, elija luego la
  /// especialización que elija). Con valor = solo quien eligió esa especialización a nivel 10.
  especializacion?: Especializacion;
  ability: StartingAbility;
}

const CLASS_ABILITIES: ClassAbilityUnlock[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // GUERRERO — tronco común (1/4/6)
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    clase: 'GUERRERO',
    ability: {
      name: 'Firmeza Férrea',
      icon: '🛡️',
      description: 'Resiste un golpe por pura dureza física, sin depender de escudo — la primera lección de cualquier Guerrero, antes que ninguna técnica.',
      promptText: 'Aprieto los dientes y aguanto el golpe por pura dureza física, sin ceder terreno.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      attributeBonus: 2,
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 4,
    clase: 'GUERRERO',
    ability: {
      name: 'Instinto Guerrero',
      icon: '🔍',
      description: 'Estudia al rival un instante, leyendo su punto débil — revela qué atributo conviene usar contra él, nunca inflige daño por sí sola.',
      promptText: 'Estudio a mi enemigo un instante, leyendo su punto débil antes de moverme.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 6,
    clase: 'GUERRERO',
    ability: {
      name: 'Segundo Aliento',
      icon: '💨',
      description: 'Recupera el aliento en pleno combate por pura fuerza de voluntad, sin dejar de estar atento al enemigo.',
      promptText: 'Recupero el aliento un instante en plena pelea, sin bajar la guardia.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 15,
    },
  },

  // --- Berserker (12/16/19/24/28/32/36/40 — solo 19 lista) ---
  {
    level: 19,
    clase: 'GUERRERO',
    especializacion: 'BERSERKER',
    ability: {
      name: 'Última Resistencia',
      icon: '🩸',
      description: 'Cuanto más al límite está, más se aferra a seguir en pie — el orgullo de un Berserker no le deja caer sin pelear.',
      promptText: 'Me aferro a seguir en pie pese al límite, negándome a caer sin pelear.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      attributeBonus: 2,
      energyCost: ENERGY_COST_MEDIA,
    },
  },

  // --- Guardián (12/16/19/24/28/32/36/40 — solo 12 lista) ---
  {
    level: 12,
    clase: 'GUERRERO',
    especializacion: 'GUARDIAN',
    ability: {
      name: 'Muro de Batalla',
      icon: '🧱',
      description: 'Planta los pies y se convierte en un muro — pura resistencia física, sin nada de vocal ni de carisma.',
      promptText: 'Planto los pies y me convierto en un muro, pura resistencia física.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      attributeBonus: 4,
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // --- Lancero (12/16/19/24/28/32/36/40 — 16 y 40 listas) ---
  {
    level: 16,
    clase: 'GUERRERO',
    especializacion: 'LANCERO',
    ability: {
      name: 'Barrido de Asta',
      icon: '🌀',
      description: 'Barre el suelo con el asta de su arma, buscando derribar al rival antes de que reaccione.',
      promptText: 'Barro el suelo con el asta de mi arma, buscando derribar a mi rival.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 40,
    clase: 'GUERRERO',
    especializacion: 'LANCERO',
    ability: {
      name: 'Lanza Certera',
      icon: '🎯',
      description: 'El golpe definitivo del Lancero — precisión y fuerza combinadas en una sola estocada, letal contra un rival ya al límite.',
      promptText: 'Concentro toda mi precisión en una sola estocada definitiva.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO', 'LETAL', 'LIMITADA'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      attributeBonus: 4,
      maxUsesPerCombat: 3,
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // --- Especialista (12/16/19/24/28/32/36/40 — 12/16/19/24 listas) ---
  {
    level: 12,
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    ability: {
      name: 'Golpe Adaptado',
      icon: '⚔️',
      description: 'Un golpe de fuerza bruta sin ninguna floritura — el generalista de la clase sabe pegar fuerte cuando toca.',
      promptText: 'Golpeo con fuerza bruta, sin ninguna floritura.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      attributeBonus: 4,
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    ability: {
      name: 'Golpe Calculado',
      icon: '🧠',
      description: 'Golpe técnico, no de fuerza bruta — busca el ángulo correcto antes de golpear.',
      promptText: 'Busco el ángulo correcto antes de golpear, un golpe técnico, no de fuerza bruta.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'inteligencia',
      attributeBonus: 4,
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 19,
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    ability: {
      name: 'Golpe Desequilibrante',
      icon: '💫',
      description: 'Busca desequilibrar al rival con un golpe rápido y preciso — si conecta de lleno, lo deja tambaleándose.',
      promptText: 'Busco desequilibrar a mi rival con un golpe rápido y preciso.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      attributeBonus: 4,
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    ability: {
      name: 'Aliento de Batalla',
      icon: '💨',
      description: 'Se sobrepone al cansancio de la batalla por pura voluntad — recupera el aliento sin dejar de estar en guardia.',
      promptText: 'Me sobrepongo al cansancio por pura voluntad, sin dejar de estar en guardia.',
      category: 'combate',
      effects: ['AGUANTE', 'RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      attributeBonus: 4,
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 15,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CAZADOR — tronco común (1/4/6/8)
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    clase: 'CAZADOR',
    ability: {
      name: 'Analisis Salvaje',
      icon: '🔍',
      description: 'Estudia al rival un instante, leyendo su punto débil — revela qué atributo conviene usar contra él, nunca inflige daño por sí sola.',
      promptText: 'Estudio a mi enemigo un instante, leyendo su punto débil antes de moverme.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 4,
    clase: 'CAZADOR',
    ability: {
      name: 'Barrido Salvaje',
      icon: '🌀',
      description: 'Evade el golpe y desestabiliza a su oponente con una patada baja a las piernas — si el rival ataca de verdad, lo desorienta permitiéndole ganar la iniciativa en los dos siguientes turnos, sin llegar a herirlo.',
      promptText: 'Dejo que un arrebato de instinto puro y salvaje tome el control por un instante, listo para desorientar a mi rival en cuanto ataque.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 6,
    clase: 'CAZADOR',
    ability: {
      name: 'Instinto de Supervivencia',
      icon: '🌿',
      description: 'Aguanta el golpe y tira de reservas propias para seguir en pie — la lección más básica de sobrevivir en la naturaleza.',
      promptText: 'Aguanto el golpe y tiro de mis propias reservas para seguir en pie.',
      category: 'combate',
      effects: ['AGUANTE', 'RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 15,
    },
  },
  {
    level: 8,
    clase: 'CAZADOR',
    ability: {
      name: 'Golpe Certero',
      icon: '🎯',
      description: 'Un golpe directo y sin adornos, aprendido de la caza — encontrar el punto exacto y golpearlo con fuerza.',
      promptText: 'Busco el punto exacto y golpeo con fuerza, sin adornos.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      attributeBonus: 3,
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // --- Supervivencia (12/16/19/24/28/32/36/40 — solo 16 lista) ---
  {
    level: 16,
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    ability: {
      name: 'Zancadilla',
      icon: '🦵',
      description: 'Aprovecha un desequilibrio del rival para derribarlo — técnica de supervivencia, no de fuerza.',
      promptText: 'Aprovecho un desequilibrio de mi rival para intentar derribarlo.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // --- Tirador (12/16/19/24/28/32/36/40 — 12/16/19/28/32 listas) ---
  {
    level: 12,
    clase: 'CAZADOR',
    especializacion: 'TIRADOR',
    ability: {
      name: 'Disparo Certero',
      icon: '🏹',
      description: 'Un disparo directo, sin margen de error — la base de cualquier Tirador.',
      promptText: 'Apunto con calma y disparo directo, sin margen de error.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      attributeBonus: 3,
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'CAZADOR',
    especializacion: 'TIRADOR',
    ability: {
      name: 'Instinto de Cazador',
      icon: '👁️',
      description: 'Lee la intención del rival y esquiva el golpe antes de que llegue — no es técnica, es puro instinto de cazador.',
      promptText: 'Leo la intención de mi rival y esquivo antes de que el golpe llegue.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'inteligencia',
      attributeBonus: 4,
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'CAZADOR',
    especializacion: 'TIRADOR',
    ability: {
      name: 'Tiro Inmovilizador',
      icon: '🏹',
      description: 'Un disparo dirigido a clavar al rival en el sitio, no a herirlo de gravedad.',
      promptText: 'Disparo buscando clavar a mi rival en el sitio, no herirlo de gravedad.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      attributeBonus: 3,
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 28,
    clase: 'CAZADOR',
    especializacion: 'TIRADOR',
    ability: {
      name: 'Concentración Absoluta',
      icon: '🧘',
      description: 'Paciencia y foco absoluto antes de disparar — no es técnica, es control total de sí mismo.',
      promptText: 'Me tomo un instante de paciencia y foco absoluto antes de disparar.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 32,
    clase: 'CAZADOR',
    especializacion: 'TIRADOR',
    ability: {
      name: 'Puntería Perfecta',
      icon: '🎯',
      description: 'El disparo definitivo de precisión — cada detalle calculado antes de soltar la cuerda.',
      promptText: 'Calculo cada detalle antes de soltar la cuerda — el disparo definitivo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      attributeBonus: 8,
      energyCost: ENERGY_COST_AVANZADA,
    },
  },

  // --- Instintivo (12/16/19/24/28/32/36/40 — 12/16/36/40 listas) ---
  {
    level: 12,
    clase: 'CAZADOR',
    especializacion: 'INSTINTIVO',
    ability: {
      name: 'Barrido Instintivo',
      icon: '🌀',
      description: 'Reacción pura, sin pensar — si gana, deja al rival aturdido por la propia sorpresa.',
      promptText: 'Reacciono por puro instinto, sin pensarlo dos veces.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'CAZADOR',
    especializacion: 'INSTINTIVO',
    ability: {
      name: 'Golpe Rápido',
      icon: '⚡',
      description: 'Un golpe tan rápido que el rival apenas lo ve venir — velocidad por encima de fuerza.',
      promptText: 'Golpeo tan rápido que apenas me da tiempo a pensarlo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      attributeBonus: 4,
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 36,
    clase: 'CAZADOR',
    especializacion: 'INSTINTIVO',
    ability: {
      name: 'Instinto Asesino',
      icon: '🩸',
      description: 'Reacción primaria, pura adrenalina — el cuerpo responde antes de que la mente decida nada.',
      promptText: 'Dejo que la pura adrenalina responda por mí, antes de pensarlo.',
      category: 'combate',
      effects: ['AGUANTE', 'ATURDIMIENTO', 'LIMITADA'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      attributeBonus: 4,
      maxUsesPerCombat: 3,
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 40,
    clase: 'CAZADOR',
    especializacion: 'INSTINTIVO',
    ability: {
      name: 'Velocidad Letal',
      icon: '💀',
      description: 'El golpe más rápido que puede dar — si el rival ya está al límite, no sobrevive.',
      promptText: 'Suelto el golpe más rápido que tengo, sin dudar.',
      category: 'combate',
      effects: ['ATAQUE', 'LETAL'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      attributeBonus: 6,
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAMÁN (exclusiva de orcos) — tronco común (1/6/8)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Nivel 4 (Tótem Veloz, AUMENTO) se queda sin construir — bloqueada por la misma
  // infraestructura de duración que el resto del enum, sin un hueco "listo" que ponerle todavía.
  {
    level: 1,
    clase: 'CHAMAN',
    ability: {
      name: 'Carga Rúnica',
      icon: '🔮',
      // CONVERSION (2026-08-24, nuevo) — se resuelve entero por `preferredAttribute: 'arcano'`
      // (el atributo Magia todavía no existe, ver clases.md § Atributo Magia — usa `arcano`, el
      // nombre real de hoy, hasta que se aplique el renombrado). Sin lógica de runtime aparte:
      // el ataque de esta habilidad YA tira con Magia/arcano en vez del atributo que le tocaría
      // normalmente, simplemente porque así lo dice su propia ficha.
      description: 'Canaliza su conexión con la magia ambiental a través de una runa — este ataque usa Magia en vez de fuerza física.',
      promptText: 'Canalizo mi conexión con la magia ambiental a través de una runa, dejando que guíe mi golpe.',
      category: 'combate',
      effects: ['ATAQUE', 'CONVERSION'],
      rol: 'ataque',
      preferredAttribute: 'arcano',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 6,
    clase: 'CHAMAN',
    ability: {
      name: 'Voluntad del Espíritu',
      icon: '🪶',
      description: 'Resiste un golpe sosteniendo la conexión con su espíritu bajo presión — no es magia en sí, es voluntad pura.',
      promptText: 'Sostengo mi conexión espiritual bajo presión, resistiendo el golpe por pura voluntad.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    clase: 'CHAMAN',
    ability: {
      name: 'Comunión con el Entorno',
      icon: '🌾',
      description: 'Canaliza la magia ambiental del entorno para recuperar energía — comunión, no invocación.',
      promptText: 'Canalizo la magia ambiental a mi alrededor, dejando que me devuelva algo de energía.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'arcano',
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 15,
    },
  },

  // --- Rúnico (12/16/19/24/28/32/36/40 — 24 y 40 listas) ---
  {
    level: 24,
    clase: 'CHAMAN',
    especializacion: 'RUNICO',
    ability: {
      name: 'Runa de Resistencia',
      icon: '🪨',
      description: 'Una runa de resistencia grabada al vuelo — te defiendes con la fuerza de tu propia voluntad.',
      promptText: 'Grabo una runa de resistencia al vuelo, defendiéndome con pura voluntad.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      attributeBonus: 5,
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 40,
    clase: 'CHAMAN',
    especializacion: 'RUNICO',
    ability: {
      name: 'Intelecto Rúnico',
      icon: '🔮',
      description: 'Una runa predice el ataque del rival — te anticipas con un golpe básico del tipo que tiene ventaja contra él.',
      promptText: 'Dejo que una runa prediga el ataque de mi rival, anticipándome con el golpe justo.',
      category: 'combate',
      effects: ['ATAQUE', 'LIMITADA'],
      rol: 'ataque',
      preferredAttribute: 'arcano',
      maxUsesPerCombat: 4,
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // --- Convocador (12/16/19/24/28/32/36/40 — solo 28 lista) ---
  //
  // Corrección frente al doc (2026-08-24): clases.md marcaba 12/16/19/28/32/40 como "✅ lista"
  // (6/8), pero 12/16/19/32/40 usan AUMENTO/DEBILIDAD/MULTIPLE/CONTRA — ninguno implementado
  // todavía. Solo 28 (Puño Ígneo, ATAQUE+ATURDIMIENTO) es real hoy.
  {
    level: 28,
    clase: 'CHAMAN',
    especializacion: 'CONVOCADOR',
    ability: {
      name: 'Puño Ígneo',
      icon: '🔥',
      description: 'Golpe de fuego consecutivo, canalizado a través del puño — el "guerrero-mago" de la clase en su forma más directa.',
      promptText: 'Canalizo fuego a través de mi puño para un golpe consecutivo.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'arcano',
      attributeBonus: 4,
      energyCost: ENERGY_COST_AVANZADA,
    },
  },

  // --- Opresor (12/16/19/24/28/32/36/40 — 12 y 24 listas) ---
  //
  // Corrección frente al doc (2026-08-24): clases.md marcaba 12/24/32 como "✅ lista" (3/8), pero
  // 32 (Runa de Sujeción) usa MULTIPLE ("inmoviliza a TODOS los rivales") — multi-objetivo, no
  // implementado. Solo 12/24 son reales hoy.
  {
    level: 12,
    clase: 'CHAMAN',
    especializacion: 'OPRESOR',
    ability: {
      name: 'Grillete Rúnico',
      icon: '⛓️',
      description: 'Una runa te retiene un turno — la primera lección de subyugar sin necesidad de fuerza.',
      promptText: 'Trazo una runa de grillete, buscando retener a mi rival un instante.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'arcano',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    clase: 'CHAMAN',
    especializacion: 'OPRESOR',
    ability: {
      name: 'Golpe Sometedor',
      icon: '✊',
      description: 'Golpe físico reforzado con runas que aturde al rival — subyugar también puede ser directo.',
      promptText: 'Golpeo con mis runas cargadas, buscando someter a mi rival de un golpe.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      attributeBonus: 3,
      energyCost: ENERGY_COST_MEDIA,
    },
  },
];

/// Qué habilidades de clase tiene un personaje — hoy solo Gorhorn es jugable, `clase: 'CAZADOR'`
/// (`docs/rpgtarkor/clases.md`, "Gorhorn deja de tener doble clase... voy a probarlo por la rama
/// de domador"). Domador se queda sin ningún hueco real construido esta pasada (0/8, bloqueada
/// por completo) — Gorhorn sigue recibiendo el tronco común de Cazador tal cual, sin
/// especialización filtrada todavía (no hay flujo in-game para elegirla).
export function classAbilityUnlocksFor(characterName: string, level: number): StartingAbility[] {
  if (characterName !== 'Gorhorn') return [];
  return CLASS_ABILITIES.filter((u) => u.level === level && u.clase === 'CAZADOR' && !u.especializacion).map((u) => u.ability);
}

/// Roster completo (todos los niveles) — para la Enciclopedia, no para el motor de turnos.
export function allClassAbilityUnlocks(): ClassAbilityUnlock[] {
  return CLASS_ABILITIES;
}

/// Roster de UNA clase, para el árbol colapsable propio de cada una en la Enciclopedia
/// (2026-07-22, "que cada clase sea un colapsable que al pulsarlo veas el árbol de habilidades")
/// y para `npcCombatAbilitiesFor` (npcCombatAbilities.ts) — un NPC con `especializacion` recibe
/// el tronco común (`!u.especializacion`) MÁS los huecos de su propia rama; sin `especializacion`
/// (o una clase sin huecos construidos), solo el tronco común.
export function classAbilityUnlocksForClase(clase: Clase, especializacion?: Especializacion | null): ClassAbilityUnlock[] {
  return CLASS_ABILITIES.filter((u) => u.clase === clase && (!u.especializacion || u.especializacion === especializacion));
}
