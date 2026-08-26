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
/// 2026-08-24, segunda pasada en el mismo día ("aplícalo ya todo y ya lo cambiaremos en el futuro
/// si hago cambios en las clases"): clases.md pasó de "solo Guerrero/Cazador/Chamán repasadas a
/// fondo" a las 9 clases con repaso completo y "fase de diseño cerrada" en el propio doc — esta
/// pasada aplica las 8 clases con tabla real (todas salvo MAGO, que sigue siendo solo identidad
/// narrativa, sin tronco ni especializaciones con tabla de niveles todavía).
///
/// Domador y Totémico (Cazador/Chamán) se quedan casi en 0 huecos reales — dependen por completo
/// de compañeros/invocación, infraestructura de combate multi-objetivo que todavía no existe
/// (combate-multiple.md) — siguen siendo especializaciones válidas (`Especializacion.DOMADOR`/
/// `TOTEMICO`, un NPC puede tenerlas asignadas). Domador tiene 1 hueco real desde 2026-08-26
/// (Compañero cazador, `COMPANERO` — pasiva, no depende de multi-objetivo, ver más abajo).
///
/// De los 25 efectos de `AbilityEffect` (+ `CONVERSION`), están implementados de verdad hoy:
/// ATAQUE/ATURDIMIENTO/INTIMIDACION/AGUANTE/ANALISIS/RECUPERACION/LETAL/LIMITADA/CONVERSION
/// (pasada original) + CONTRA/REFRACTAR/CONTROL/COMPANERO (2026-08-26, solo las habilidades cuyo
/// efecto real no dependía de infraestructura sin construir — ver clases.md § comentario de cada
/// especialización para el resto, que se queda pendiente). CONTRA/REFRACTAR reutilizan el margen
/// decisivo ya existente (±10) en vez del umbral propio de cada habilidad (6/8 en el doc, mismo
/// criterio de simplificación que ya usa LETAL); CONTROL se simplifica a robar la iniciativa
/// (como ATURDIMIENTO) en vez de "2 turnos" reales, al no existir todavía un segundo rival real al
/// que redirigirlo; COMPANERO reutiliza `esSlotDomador` (companeros.ts), ya construido de antes.
/// El resto (AUMENTO/DEBILIDAD/CANALIZAR/CURAZION/REFLEJAR/PURIFICAR/PROVOCACION/RETIRAR/EXPULSAR
/// — duración por turnos; INVOCACION/MULTIPLE/DESVIAR/OCULTACION — combate multi-objetivo de
/// verdad) sigue sin construir, así que solo se dan de alta aquí las habilidades de clases.md
/// marcadas "✅ lista" o cuyo efecto real ya está cubierto (verificado efecto a efecto contra este
/// enum real, no copiado tal cual del doc — varias filas de Convocador/Opresor Y de Maestro
/// Arquero/Maestro Ballestero estaban mal marcadas "✅" en el propio documento pese a usar
/// AUMENTO/DEBILIDAD/MULTIPLE, corregido aquí — Arquero pasa de "7/8" en el doc a 1/8 real por
/// especialización).
///
/// Recuento final por clase (huecos reales / 8 por especialización, tronco aparte):
/// GUERRERO Berserker 1, Guardián 1, Lancero 2, Especialista 4 — CAZADOR Domador 1, Supervivencia
/// 1, Tirador 5, Instintivo 4 — CHAMAN Totémico 0, Rúnico 2, Convocador 2, Opresor 3 — ARQUERO
/// Maestro Arquero 1, Maestro Ballestero 1 — CABALLERO Orden 6, Valor 3, Dolor 7 — SEGADOR Parca 3,
/// Maldito 4, Ilustrado 6, Transmutador 2 — ASESINO Maestro Asesino 7, Tóxico 3, Danzante 8,
/// Selecto 6 — DRUIDA Cambiaformas 8, Aullador 2, Salvaje 8, Adaptado 8.
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

  // --- Domador (12/16/19/24/28/32/36/40 — solo 12 lista) ---
  //
  // COMPANERO (2026-08-26) — pasiva, sin turno que resolver en combate: da un slot de compañero
  // NUEVO restringido a fauna combatible, que se suma a `maxCompanions` sin depender de
  // construcción propia. La mecánica real (`esSlotDomador`, companeros.ts §
  // POST /tameo-pendientes/:npcSlug/confirmar) ya existía de antes, gatead por clase/especialización
  // (`esDomador`) — esta fila solo la hace visible como habilidad de verdad desbloqueada a nivel
  // 12, no cambia el motor. El resto de la especialización (16-40) sigue dependiendo de
  // `INVOCACION`/combate multi-objetivo, sin construir.
  {
    level: 12,
    clase: 'CAZADOR',
    especializacion: 'DOMADOR',
    ability: {
      name: 'Compañero cazador',
      icon: '🐾',
      description: 'Desbloquea un slot de mascota — una criatura capturada puede llevar equipo propio (casco, armadura, accesorio), gestionable desde el Bestiario. Solo con piezas crafteadas para ella.',
      promptText: 'Me preparo para llevar una criatura capturada a mi lado como compañera de caza.',
      category: 'general',
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

  // --- Convocador (12/16/19/24/28/32/36/40 — 28 y 32 listas) ---
  //
  // Corrección frente al doc (2026-08-24): clases.md marcaba 12/16/19/28/32/40 como "✅ lista"
  // (6/8), pero 12/16/19/40 usan AUMENTO/DEBILIDAD/MULTIPLE/CANALIZAR — ninguno implementado
  // todavía. 28 (Puño Ígneo, ATAQUE+ATURDIMIENTO) ya era real; 32 (Vórtice Menor, CONTRA) se suma
  // 2026-08-26.
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
  {
    level: 32,
    clase: 'CHAMAN',
    especializacion: 'CONVOCADOR',
    ability: {
      name: 'Vórtice Menor',
      icon: '🌪️',
      description: 'Un torbellino menor te ayuda a esquivar — y a devolver el golpe si el rival se queda demasiado cerca.',
      promptText: 'Invoco un torbellino menor para esquivar el golpe de mi rival.',
      category: 'combate',
      effects: ['AGUANTE', 'CONTRA'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      attributeBonus: 4,
      energyCost: ENERGY_COST_AVANZADA,
    },
  },

  // --- Opresor (12/16/19/24/28/32/36/40 — 12, 16 y 24 listas) ---
  //
  // Corrección frente al doc (2026-08-24): clases.md marcaba 12/24/32 como "✅ lista" (3/8), pero
  // 32 (Runa de Sujeción) usa MULTIPLE ("inmoviliza a TODOS los rivales") — multi-objetivo, no
  // implementado. 12/24 ya eran reales; 16 (Opresión Mental, CONTROL) se suma 2026-08-26,
  // simplificada a robar la iniciativa en vez de "2 turnos" (sin combate multi-objetivo para
  // redirigir el control a un aliado del rival, ver turnResolution.ts).
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
    level: 16,
    clase: 'CHAMAN',
    especializacion: 'OPRESOR',
    ability: {
      name: 'Opresión Mental',
      icon: '🧠',
      description: 'Una presión mental invasiva impone tu voluntad sobre el rival, desorientándolo un instante.',
      promptText: 'Impongo una presión mental invasiva sobre mi rival, buscando desorientarlo.',
      category: 'combate',
      effects: ['CONTROL'],
      rol: 'utilidad',
      preferredAttribute: 'arcano',
      energyCost: ENERGY_COST_MEDIA,
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

  // ══════════════════════════════════════════════════════════════════════════
  // ARQUERO — tronco común (1/4/6/8)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Corrección frente al doc (2026-08-24): clases.md marcaba Maestro Arquero/Maestro Ballestero
  // como "7/8 listas" (todo salvo el 36), pero 12/24/28 usan DEBILIDAD, 19 usa CONTRA, 24 también
  // AUMENTO y 32 usa MULTIPLE — ninguno implementado. Solo el nivel 16 (ATAQUE+ATURDIMIENTO) es
  // real hoy en cada rama. Misma familia de error que Convocador/Opresor: el propio doc no había
  // verificado cada fila efecto a efecto contra el motor.
  {
    level: 1,
    clase: 'ARQUERO',
    ability: {
      name: 'Vista de Halcón',
      icon: '🦅',
      description: 'Estudia al rival un instante desde la distancia, leyendo su punto débil antes de tensar la cuerda.',
      promptText: 'Estudio a mi rival desde la distancia, leyendo su punto débil.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 4,
    clase: 'ARQUERO',
    ability: {
      name: 'Reflejos de Cazador',
      icon: '🏃',
      description: 'Se aparta del ataque con la misma agilidad que exige tensar y soltar una flecha en movimiento.',
      promptText: 'Me aparto del golpe con la misma agilidad con la que suelto una flecha en movimiento.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      attributeBonus: 2,
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 6,
    clase: 'ARQUERO',
    ability: {
      name: 'Tiro de Aliento Estable',
      icon: '💨',
      description: 'Controla la respiración antes de soltar la cuerda — un disparo estable que le devuelve algo de energía si conecta de lleno.',
      promptText: 'Controlo mi respiración antes de soltar la cuerda, buscando un disparo estable.',
      category: 'combate',
      effects: ['ATAQUE', 'RECUPERACION'],
      rol: 'ataque',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 10,
    },
  },
  {
    level: 8,
    clase: 'ARQUERO',
    ability: {
      name: 'Tiro de Precisión',
      icon: '🎯',
      description: 'Un disparo reactivo, soltado en el instante exacto en que el rival se descubre.',
      promptText: 'Suelto la flecha en el instante exacto en que mi rival se descubre.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      attributeBonus: 4,
      energyCost: ENERGY_COST_MEDIA,
    },
  },

  // --- Maestro Arquero (12/16/19/24/28/32/36/40 — solo 16 lista) ---
  {
    level: 16,
    clase: 'ARQUERO',
    especializacion: 'MAESTRO_ARQUERO',
    ability: {
      name: 'Tiro Inmovilizador',
      icon: '🏹',
      description: 'Un disparo dirigido a clavar al rival en el sitio, no a herirlo de gravedad.',
      promptText: 'Disparo buscando clavar a mi rival en el sitio.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },

  // --- Maestro Ballestero (12/16/19/24/28/32/36/40 — solo 16 lista, reflavor de Maestro Arquero) ---
  {
    level: 16,
    clase: 'ARQUERO',
    especializacion: 'MAESTRO_BALLESTERO',
    ability: {
      name: 'Perno Inmovilizador',
      icon: '🎯',
      description: 'Un perno dirigido a clavar al rival en el sitio, no a herirlo de gravedad.',
      promptText: 'Disparo un perno buscando clavar a mi rival en el sitio.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CABALLERO (exclusiva de Goirntes) — tronco común (1/4/6/8)
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    clase: 'CABALLERO',
    ability: {
      name: 'Juramento del Caballero',
      icon: '⚔️',
      description: 'La firmeza del voto resiste un golpe — la primera lección de cualquier Caballero, antes que ninguna técnica.',
      promptText: 'Resisto el golpe con la firmeza de mi juramento.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 4,
    clase: 'CABALLERO',
    ability: {
      name: 'Golpe de Honor',
      icon: '🗡️',
      description: 'Un golpe directo, sin artificio — el honor no necesita adornos.',
      promptText: 'Golpeo directo y sin artificio, con el honor por delante.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 6,
    clase: 'CABALLERO',
    ability: {
      name: 'Resistencia Templada',
      icon: '🔥',
      description: 'Recupera el aliento como quien se templa al fuego — disciplina antes que descanso.',
      promptText: 'Recupero el aliento con la disciplina de mi entrenamiento.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 15,
    },
  },
  {
    level: 8,
    clase: 'CABALLERO',
    ability: {
      name: 'Mirada Autoritaria',
      icon: '👁️',
      description: 'Lee al rival con la autoridad de su rango — un vistazo que revela más que un interrogatorio.',
      promptText: 'Estudio a mi rival con la autoridad de mi rango.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'carisma',
      energyCost: ENERGY_COST_BASICA,
    },
  },

  // --- Caballero del Orden (12/16/19/24/28/32/36/40 — 12/16/19/24/28/32 listas) ---
  {
    level: 12,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_ORDEN',
    ability: {
      name: 'Muralla de Acero',
      icon: '🧱',
      description: 'Se planta como una muralla — el tanque de los Caballeros, pura resistencia.',
      promptText: 'Me planto como una muralla de acero.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_ORDEN',
    ability: {
      name: 'Golpe de Escudo',
      icon: '🛡️',
      description: 'Golpea con el borde del escudo — escala por constitución, no por fuerza.',
      promptText: 'Golpeo con el borde de mi escudo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_ORDEN',
    ability: {
      name: 'Voluntad Inquebrantable',
      icon: '🪨',
      description: 'Resiste por pura voluntad, sin ceder un palmo de terreno.',
      promptText: 'Resisto sin ceder un palmo, por pura voluntad.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_ORDEN',
    ability: {
      name: 'Golpe Pesado',
      icon: '🔨',
      description: 'Un golpe cargado de todo su peso, lento pero contundente.',
      promptText: 'Cargo todo mi peso en un golpe contundente.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 28,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_ORDEN',
    ability: {
      name: 'Bastión Viviente',
      icon: '🏰',
      description: 'Se convierte en un bastión andante, inamovible pase lo que pase.',
      promptText: 'Me convierto en un bastión andante, inamovible.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 32,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_ORDEN',
    ability: {
      name: 'Grito de Hierro',
      icon: '📢',
      description: 'Un grito de mando que aturde al rival por su pura contundencia.',
      promptText: 'Suelto un grito de mando que retumba en el campo.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'carisma',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },

  // --- Caballero del Valor (12/16/19/24/28/32/36/40 — 19/24/36 listas) ---
  {
    level: 19,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_VALOR',
    ability: {
      name: 'Golpe Justiciero',
      icon: '⚖️',
      description: 'Un golpe dirigido con la certeza de quien defiende una causa justa.',
      promptText: 'Golpeo con la certeza de quien defiende una causa justa.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_VALOR',
    ability: {
      name: 'Escudo del Valor',
      icon: '🛡️',
      description: 'Se defiende con el escudo en alto, el valor por delante del miedo.',
      promptText: 'Alzo mi escudo, con el valor por delante del miedo.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 36,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_VALOR',
    ability: {
      name: 'Golpe de Justicia',
      icon: '⚔️',
      description: 'El golpe definitivo de quien reparte justicia con su propia mano.',
      promptText: 'Reparto justicia con mi propia mano.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },

  // --- Caballero del Dolor (12/16/19/24/28/32/36/40 — todas menos 24) ---
  {
    level: 12,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_DOLOR',
    ability: {
      name: 'Golpe del Dolor',
      icon: '🩸',
      description: 'Un golpe cuyo daño escala con su propia resistencia — cuanto más aguanta, más fuerte pega.',
      promptText: 'Golpeo dejando que mi propia resistencia potencie el impacto.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_DOLOR',
    ability: {
      name: 'Resistencia al Sufrimiento',
      icon: '🦴',
      description: 'Aguanta el golpe sin apenas inmutarse — el dolor ya no le dice nada nuevo.',
      promptText: 'Aguanto el golpe, el dolor ya no me dice nada nuevo.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_DOLOR',
    ability: {
      name: 'Furia Contenida',
      icon: '😤',
      description: 'Libera de golpe la furia que llevaba conteniendo.',
      promptText: 'Libero de golpe la furia que llevaba conteniendo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 28,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_DOLOR',
    ability: {
      name: 'Grito de Batalla',
      icon: '📢',
      description: 'Un grito nacido del propio dolor que aturde a quien lo escucha de cerca.',
      promptText: 'Suelto un grito nacido de mi propio dolor.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'carisma',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 32,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_DOLOR',
    ability: {
      name: 'Última Gota',
      icon: '💧',
      description: 'La voluntad tira del cuerpo pese al dolor, recuperando fuerzas de donde ya no quedaban.',
      promptText: 'Dejo que mi voluntad tire de mi cuerpo pese al dolor.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_AVANZADA,
      energyRegen: 15,
    },
  },
  {
    level: 36,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_DOLOR',
    ability: {
      name: 'Golpe Inquebrantable',
      icon: '🔨',
      description: 'Un golpe que no cede ni un ápice, por mucho que le cueste dárselo.',
      promptText: 'Golpeo sin ceder ni un ápice, por mucho que me cueste.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 40,
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_DOLOR',
    ability: {
      name: 'Dolor Convertido en Fuerza',
      icon: '💥',
      description: 'El golpe definitivo — máximo cuanto más resistente es quien lo da.',
      promptText: 'Convierto todo mi dolor acumulado en un único golpe definitivo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SEGADOR (exclusiva de Nabieus) — tronco común (1/4/6/8)
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    clase: 'SEGADOR',
    ability: {
      name: 'Vista de la Parca',
      icon: '👁️',
      description: 'Lee el destino del rival, detectando su debilidad antes de que él mismo la conozca.',
      promptText: 'Leo el destino de mi rival, detectando su debilidad.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 4,
    clase: 'SEGADOR',
    ability: {
      name: 'Paso Fúnebre',
      icon: '🌫️',
      description: 'Esquiva como una sombra, sin apenas dejar huella de su paso.',
      promptText: 'Esquivo como una sombra, sin dejar apenas huella.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 6,
    clase: 'SEGADOR',
    ability: {
      name: 'Aliento Postrero',
      icon: '💨',
      description: 'Recupera el aliento como quien ya ha mirado a la muerte antes y sabe que no es esta vez.',
      promptText: 'Recupero el aliento, sabiendo que esta no es mi hora.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 15,
    },
  },
  {
    level: 8,
    clase: 'SEGADOR',
    ability: {
      name: 'Guadaña Certera',
      icon: '🔪',
      description: 'Un golpe directo, seco, sin ceremonia — la Parca no necesita adornos.',
      promptText: 'Golpeo directo y seco, sin ceremonia.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },

  // --- Parca (12/16/19/24/28/32/36/40 — 12/24/36 listas) ---
  {
    level: 12,
    clase: 'SEGADOR',
    especializacion: 'PARCA',
    ability: {
      name: 'Golpe Segador',
      icon: '🌾',
      description: 'Un golpe que pega más fuerte cuanto más herido está ya el rival.',
      promptText: 'Golpeo con más fuerza cuanto más veo herido a mi rival.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    clase: 'SEGADOR',
    especializacion: 'PARCA',
    ability: {
      name: 'Corte Final',
      icon: '⚔️',
      description: 'Una ejecución rápida y precisa, sin margen para que el rival reaccione.',
      promptText: 'Ejecuto un corte rápido y preciso, sin dar margen a reaccionar.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 36,
    clase: 'SEGADOR',
    especializacion: 'PARCA',
    ability: {
      name: 'Golpe Agonizante',
      icon: '💀',
      description: 'Un golpe que escala con todo el daño ya infligido antes — el remate de la Parca.',
      promptText: 'Golpeo dejando que todo el daño ya infligido potencie el remate.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },

  // --- Maldito (12/16/19/24/28/32/36/40 — 16/19/24/32 listas) ---
  {
    level: 16,
    clase: 'SEGADOR',
    especializacion: 'MALDITO',
    ability: {
      name: 'Golpe Aturdidor',
      icon: '⛓️',
      description: 'Un golpe cargado de mala fortuna que deja al rival aturdido.',
      promptText: 'Golpeo cargando el impacto de mala fortuna.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'SEGADOR',
    especializacion: 'MALDITO',
    ability: {
      name: 'Robo de Energía',
      icon: '🌀',
      description: 'Le arrebata energía al rival, dejándolo un poco más vacío por dentro.',
      promptText: 'Le arrebato energía a mi rival, dejándolo un poco más vacío.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'ataque',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 15,
    },
  },
  {
    level: 24,
    clase: 'SEGADOR',
    especializacion: 'MALDITO',
    ability: {
      name: 'Grillete Maldito',
      icon: '⛓️',
      description: 'Una maldición que se cierra como un grillete invisible en torno al rival.',
      promptText: 'Cierro una maldición como un grillete invisible sobre mi rival.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 32,
    clase: 'SEGADOR',
    especializacion: 'MALDITO',
    ability: {
      name: 'Cadena de Maldiciones',
      icon: '⛓️',
      description: 'Encadena una maldición sobre otra, dejando al rival sin margen para recuperarse.',
      promptText: 'Encadeno una maldición tras otra sobre mi rival.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },

  // --- Ilustrado (12/16/19/24/28/32/36/40 — 12/16/19/28/32/40 listas) ---
  {
    level: 12,
    clase: 'SEGADOR',
    especializacion: 'ILUSTRADO',
    ability: {
      name: 'Cálculo del Destino',
      icon: '🎲',
      description: 'Elige el atributo de su golpe según lo que ha predicho, no según el arma que lleva.',
      promptText: 'Elijo el filo de mi golpe según lo que he predicho de antemano.',
      category: 'combate',
      effects: ['ATAQUE', 'CONVERSION'],
      rol: 'ataque',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'SEGADOR',
    especializacion: 'ILUSTRADO',
    ability: {
      name: 'Paso Predicho',
      icon: '🔮',
      description: 'Anticipa el golpe antes de que llegue y lo evita sin esfuerzo aparente.',
      promptText: 'Anticipo el golpe antes de que llegue y lo evito.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'SEGADOR',
    especializacion: 'ILUSTRADO',
    ability: {
      name: 'Ventaja Calculada',
      icon: '📐',
      description: 'Aprovecha una abertura que había calculado de antemano, no que apareció por suerte.',
      promptText: 'Aprovecho una abertura que ya había calculado de antemano.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 28,
    clase: 'SEGADOR',
    especializacion: 'ILUSTRADO',
    ability: {
      name: 'Predicción Precisa',
      icon: '🎲',
      description: 'Vuelve a leer el destino del combate y ajusta su golpe al atributo perfecto.',
      promptText: 'Leo de nuevo el destino del combate y ajusto mi golpe.',
      category: 'combate',
      effects: ['ATAQUE', 'CONVERSION'],
      rol: 'ataque',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 32,
    clase: 'SEGADOR',
    especializacion: 'ILUSTRADO',
    ability: {
      name: 'Golpe de la Fortuna',
      icon: '🍀',
      description: 'Un golpe que confía en la fortuna calculada, no en la fuerza bruta.',
      promptText: 'Confío en mi fortuna calculada para este golpe.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 40,
    clase: 'SEGADOR',
    especializacion: 'ILUSTRADO',
    ability: {
      name: 'Destino Sellado',
      icon: '📜',
      description: 'El golpe definitivo, siempre con el atributo perfecto — el destino del rival ya estaba escrito.',
      promptText: 'Sello el destino de mi rival con el golpe perfecto.',
      category: 'combate',
      effects: ['ATAQUE', 'CONVERSION'],
      rol: 'ataque',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // --- Transmutador (12/16/19/24/28/32/36/40 — solo 12/24 listas) ---
  {
    level: 12,
    clase: 'SEGADOR',
    especializacion: 'TRANSMUTADOR',
    ability: {
      name: 'Toque Alquímico',
      icon: '⚗️',
      description: 'Imbuye su golpe con un elemento inestable, sin llegar a controlarlo del todo.',
      promptText: 'Imbuyo mi golpe con un elemento inestable.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 24,
    clase: 'SEGADOR',
    especializacion: 'TRANSMUTADOR',
    ability: {
      name: 'Golpe Inestable',
      icon: '💢',
      description: 'Un golpe cuya energía inestable se libera de golpe, sin control fino.',
      promptText: 'Libero de golpe la energía inestable de mi ataque.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ASESINO — tronco común (1/4/6/8)
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    clase: 'ASESINO',
    ability: {
      name: 'Estudio del Blanco',
      icon: '🔍',
      description: 'Estudia al objetivo un instante, leyendo su punto débil antes de acercarse.',
      promptText: 'Estudio a mi objetivo un instante, leyendo su punto débil.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 4,
    clase: 'ASESINO',
    ability: {
      name: 'Reflejos de Sombra',
      icon: '🌑',
      description: 'Se funde con las sombras un instante, esquivando el golpe antes de que llegue.',
      promptText: 'Me fundo con las sombras un instante, esquivando el golpe.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 6,
    clase: 'ASESINO',
    ability: {
      name: 'Respiración Silenciosa',
      icon: '💨',
      description: 'Recupera el aliento sin hacer un solo ruido, invisible incluso descansando.',
      promptText: 'Recupero el aliento sin hacer un solo ruido.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 15,
    },
  },
  {
    level: 8,
    clase: 'ASESINO',
    ability: {
      name: 'Golpe Certero',
      icon: '🗡️',
      description: 'Un golpe reactivo, soltado en el instante exacto en que el rival baja la guardia.',
      promptText: 'Golpeo en el instante exacto en que mi rival baja la guardia.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },

  // --- Maestro Asesino (12/16/19/24/28/32/36/40 — todas menos 32) ---
  {
    level: 12,
    clase: 'ASESINO',
    especializacion: 'MAESTRO_ASESINO',
    ability: {
      name: 'Golpe Preciso',
      icon: '🗡️',
      description: 'Un golpe limpio, sin margen de error — la base de cualquier Maestro Asesino.',
      promptText: 'Golpeo limpio, sin margen de error.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'ASESINO',
    especializacion: 'MAESTRO_ASESINO',
    ability: {
      name: 'Punto Vital',
      icon: '🎯',
      description: 'Un golpe calculado a un punto crítico concreto, no a la masa del cuerpo.',
      promptText: 'Calculo el golpe a un punto vital concreto.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'ASESINO',
    especializacion: 'MAESTRO_ASESINO',
    ability: {
      name: 'Paso Sombrío',
      icon: '🌑',
      description: 'Se desliza entre sombras, esquivando el golpe con pura fluidez.',
      promptText: 'Me deslizo entre sombras, esquivando con pura fluidez.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'ASESINO',
    especializacion: 'MAESTRO_ASESINO',
    ability: {
      name: 'Golpe Doble',
      icon: '🗡️',
      description: 'Dos golpes en el tiempo de uno, encadenados sin pausa.',
      promptText: 'Encadeno dos golpes sin pausa entre ellos.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 28,
    clase: 'ASESINO',
    especializacion: 'MAESTRO_ASESINO',
    ability: {
      name: 'Instinto Asesino',
      icon: '🩸',
      description: 'Deja que el puro instinto tome el control, aturdiendo al rival de la sorpresa.',
      promptText: 'Dejo que el puro instinto tome el control por un instante.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 36,
    clase: 'ASESINO',
    especializacion: 'MAESTRO_ASESINO',
    ability: {
      name: 'Ejecución Precisa',
      icon: '⚔️',
      description: 'Control absoluto del cuerpo en el golpe final, sin un solo movimiento de más.',
      promptText: 'Ejecuto el golpe final con control absoluto del cuerpo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 40,
    clase: 'ASESINO',
    especializacion: 'MAESTRO_ASESINO',
    ability: {
      name: 'Golpe Maestro',
      icon: '💥',
      description: 'Precisión máxima — el golpe definitivo de un generalista que domina cualquier técnica.',
      promptText: 'Suelto el golpe definitivo, precisión máxima.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // --- Asesino Tóxico (12/16/19/24/28/32/36/40 — 16/24/32 listas) ---
  {
    level: 16,
    clase: 'ASESINO',
    especializacion: 'ASESINO_TOXICO',
    ability: {
      name: 'Golpe Tóxico',
      icon: '🧪',
      description: 'Un golpe impregnado de veneno, aunque su efecto pleno tarde en manifestarse.',
      promptText: 'Golpeo con la hoja impregnada de veneno.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'ASESINO',
    especializacion: 'ASESINO_TOXICO',
    ability: {
      name: 'Resistencia a Toxinas',
      icon: '🧬',
      description: 'Su propio cuerpo, curtido en venenos, resiste lo que a otros derribaría.',
      promptText: 'Resisto el golpe con un cuerpo curtido en venenos.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 32,
    clase: 'ASESINO',
    especializacion: 'ASESINO_TOXICO',
    ability: {
      name: 'Golpe Letal',
      icon: '☠️',
      description: 'Un golpe directo cargado de toda la letalidad que su veneno promete.',
      promptText: 'Golpeo directo, cargado de toda la letalidad de mi veneno.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },

  // --- Asesino Danzante (12/16/19/24/28/32/36/40 — todas listas) ---
  {
    level: 12,
    clase: 'ASESINO',
    especializacion: 'ASESINO_DANZANTE',
    ability: {
      name: 'Paso de Danza',
      icon: '💃',
      description: 'Esquiva con la fluidez de una danza, nunca quieto en el mismo sitio.',
      promptText: 'Esquivo con la fluidez de una danza.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'ASESINO',
    especializacion: 'ASESINO_DANZANTE',
    ability: {
      name: 'Golpe Fluido',
      icon: '🗡️',
      description: 'Un golpe que fluye directamente del paso anterior, sin ninguna pausa entre ambos.',
      promptText: 'Encadeno el golpe directamente desde mi último paso.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'ASESINO',
    especializacion: 'ASESINO_DANZANTE',
    ability: {
      name: 'Giro Evasivo',
      icon: '🌀',
      description: 'Un giro completo que deja el golpe rival sin nada que golpear.',
      promptText: 'Giro por completo, dejando el golpe sin nada que golpear.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'ASESINO',
    especializacion: 'ASESINO_DANZANTE',
    ability: {
      name: 'Cadena de Golpes',
      icon: '⚔️',
      description: 'Encadena varios golpes en un único movimiento continuo, sin dar tregua.',
      promptText: 'Encadeno varios golpes en un único movimiento continuo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 28,
    clase: 'ASESINO',
    especializacion: 'ASESINO_DANZANTE',
    ability: {
      name: 'Ritmo de Combate',
      icon: '🎵',
      description: 'Encuentra el ritmo del combate y recupera fuerzas siguiéndolo.',
      promptText: 'Encuentro el ritmo del combate y recupero fuerzas siguiéndolo.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_AVANZADA,
      energyRegen: 15,
    },
  },
  {
    level: 32,
    clase: 'ASESINO',
    especializacion: 'ASESINO_DANZANTE',
    ability: {
      name: 'Danza Mortal',
      icon: '💃',
      description: 'Cada movimiento de la danza esconde un golpe, hasta que uno conecta de verdad.',
      promptText: 'Escondo un golpe en cada movimiento de mi danza.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 36,
    clase: 'ASESINO',
    especializacion: 'ASESINO_DANZANTE',
    ability: {
      name: 'Esquiva Perfecta',
      icon: '🧠',
      description: 'Predice el golpe antes de que se lance y lo esquiva sin apenas moverse.',
      promptText: 'Predigo el golpe antes de que se lance y lo esquivo.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 40,
    clase: 'ASESINO',
    especializacion: 'ASESINO_DANZANTE',
    ability: {
      name: 'Vals del Filo',
      icon: '🗡️',
      description: 'El combate entero se vuelve una danza, y el filo la remata en su último compás.',
      promptText: 'Remato el combate en el último compás de mi danza.',
      category: 'combate',
      effects: ['ATAQUE', 'AGUANTE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // --- Asesino Selecto (12/16/19/24/28/32/36/40 — todas menos 12/28) ---
  {
    level: 16,
    clase: 'ASESINO',
    especializacion: 'ASESINO_SELECTO',
    ability: {
      name: 'Golpe Marcado',
      icon: '🎯',
      description: 'Un golpe con daño extra contra el objetivo que ya tiene marcado.',
      promptText: 'Golpeo con toda mi atención puesta en el objetivo marcado.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'ASESINO',
    especializacion: 'ASESINO_SELECTO',
    ability: {
      name: 'Instinto de Caza',
      icon: '🦅',
      description: 'Se defiende como quien nunca deja de cazar, ni siquiera cuando le atacan a él.',
      promptText: 'Me defiendo con el mismo instinto con el que cazo.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'ASESINO',
    especializacion: 'ASESINO_SELECTO',
    ability: {
      name: 'Golpe Selecto',
      icon: '🗡️',
      description: 'Un golpe elegido con cuidado, nunca al azar.',
      promptText: 'Elijo con cuidado dónde cae este golpe.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 32,
    clase: 'ASESINO',
    especializacion: 'ASESINO_SELECTO',
    ability: {
      name: 'Golpe Certero',
      icon: '🎯',
      description: 'Un golpe directo al objetivo marcado, sin desperdiciar ni un movimiento.',
      promptText: 'Golpeo directo al objetivo marcado, sin desperdiciar nada.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 36,
    clase: 'ASESINO',
    especializacion: 'ASESINO_SELECTO',
    ability: {
      name: 'Sentencia',
      icon: '⚖️',
      description: 'Aturde al objetivo marcado como quien dicta una sentencia ya decidida.',
      promptText: 'Dicto sentencia sobre mi objetivo marcado.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 40,
    clase: 'ASESINO',
    especializacion: 'ASESINO_SELECTO',
    ability: {
      name: 'Ejecución del Elegido',
      icon: '💀',
      description: 'Daño masivo solo contra el objetivo marcado — el resto del combate no le importa.',
      promptText: 'Descargo todo mi daño sobre el objetivo marcado, nada más importa.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DRUIDA (exclusiva de Faerus) — tronco común (1/4/6/8)
  // ══════════════════════════════════════════════════════════════════════════
  {
    level: 1,
    clase: 'DRUIDA',
    ability: {
      name: 'Instinto Natural',
      icon: '🍃',
      description: 'Lee al rival con el mismo instinto que lee al bosque — su punto débil queda claro.',
      promptText: 'Leo a mi rival con el mismo instinto con el que leo el bosque.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 4,
    clase: 'DRUIDA',
    ability: {
      name: 'Reflejos Salvajes',
      icon: '🐾',
      description: 'Esquiva con reflejos más animales que entrenados.',
      promptText: 'Esquivo con reflejos más animales que entrenados.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 6,
    clase: 'DRUIDA',
    ability: {
      name: 'Aliento del Bosque',
      icon: '🌳',
      description: 'Recupera el aliento como quien respira el propio bosque a través de la piel.',
      promptText: 'Recupero el aliento como quien respira el bosque a través de la piel.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_MEDIA,
      energyRegen: 15,
    },
  },
  {
    level: 8,
    clase: 'DRUIDA',
    ability: {
      name: 'Zarpazo',
      icon: '🐾',
      description: 'Un zarpazo directo, la primera arma con la que cuenta cualquier Druida.',
      promptText: 'Golpeo con un zarpazo directo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },

  // --- Cambiaformas (12/16/19/24/28/32/36/40 — todas listas) ---
  {
    level: 12,
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    ability: {
      name: 'Forma de Ferike',
      icon: '🐆',
      description: 'Adopta brevemente la forma de un Ferike — garra desgarradora, pura fuerza felina.',
      promptText: 'Adopto brevemente la forma de un Ferike.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    ability: {
      name: 'Forma de Hetris',
      icon: '🦎',
      description: 'Adopta brevemente la forma de un Hetris, veloz y esquivo.',
      promptText: 'Adopto brevemente la forma de un Hetris.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    ability: {
      name: 'Forma de Gargantúa',
      icon: '🦏',
      description: 'Adopta brevemente la forma de una Gargantúa — placas óseas, resistencia bruta.',
      promptText: 'Adopto brevemente la forma de una Gargantúa.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    ability: {
      name: 'Forma de Vistue',
      icon: '🦉',
      description: 'Adopta brevemente la forma de un Vistue, recuperando fuerzas de su resistencia natural.',
      promptText: 'Adopto brevemente la forma de un Vistue.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_AVANZADA,
      energyRegen: 15,
    },
  },
  {
    level: 28,
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    ability: {
      name: 'Forma de Mekiosi',
      icon: '🐺',
      description: 'Adopta brevemente la forma de un Mekiosi, agresivo y directo.',
      promptText: 'Adopto brevemente la forma de un Mekiosi.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 32,
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    ability: {
      name: 'Garras Primigenias',
      icon: '🐾',
      description: 'Una transformación parcial, sin forma concreta — solo garras primigenias asomando.',
      promptText: 'Dejo que asomen unas garras primigenias, sin transformarme del todo.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 36,
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    ability: {
      name: 'Instinto Bestial',
      icon: '👁️',
      description: 'Sentidos e instintos afilados, sin forma concreta — solo lo animal, agudizado.',
      promptText: 'Agudizo mis sentidos e instintos, sin transformarme del todo.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 40,
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    ability: {
      name: 'Forma Ancestral',
      icon: '🌌',
      description: 'Todas las formas a la vez, por un instante — el golpe definitivo del Cambiaformas.',
      promptText: 'Dejo que todas mis formas se manifiesten a la vez, por un solo instante.',
      category: 'combate',
      effects: ['ATAQUE', 'CONVERSION'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // --- Aullador (12/16/19/24/28/32/36/40 — solo 24/28 listas) ---
  {
    level: 24,
    clase: 'DRUIDA',
    especializacion: 'AULLADOR',
    ability: {
      name: 'Aullido de Guerra',
      icon: '🐺',
      description: 'Un aullido de guerra que aturde a quien lo escucha de cerca.',
      promptText: 'Suelto un aullido de guerra.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 28,
    clase: 'DRUIDA',
    especializacion: 'AULLADOR',
    ability: {
      name: 'Instinto de Manada',
      icon: '🐾',
      description: 'Se defiende con el instinto de quien nunca combate solo de verdad, aunque la manada no esté a la vista.',
      promptText: 'Me defiendo con el instinto de quien nunca combate solo.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },

  // --- Salvaje (12/16/19/24/28/32/36/40 — todas listas) ---
  {
    level: 12,
    clase: 'DRUIDA',
    especializacion: 'SALVAJE',
    ability: {
      name: 'Garras Desgarradoras',
      icon: '🐾',
      description: 'Garras que desgarran sin ninguna técnica de por medio, solo agresividad pura.',
      promptText: 'Desgarro con mis garras, sin ninguna técnica de por medio.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'DRUIDA',
    especializacion: 'SALVAJE',
    ability: {
      name: 'Mordisco Feroz',
      icon: '🦷',
      description: 'Un mordisco feroz, rápido y directo a la carne.',
      promptText: 'Muerdo con ferocidad, rápido y directo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'DRUIDA',
    especializacion: 'SALVAJE',
    ability: {
      name: 'Instinto Asesino',
      icon: '🩸',
      description: 'Deja que el instinto puro tome el control, aturdiendo al rival por pura agresividad.',
      promptText: 'Dejo que mi instinto más puro tome el control.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'DRUIDA',
    especializacion: 'SALVAJE',
    ability: {
      name: 'Embestida Salvaje',
      icon: '💥',
      description: 'Una embestida sin ninguna contención, pura agresividad feral.',
      promptText: 'Embisto sin ninguna contención.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 28,
    clase: 'DRUIDA',
    especializacion: 'SALVAJE',
    ability: {
      name: 'Furia Primal',
      icon: '🔥',
      description: 'Recupera fuerzas dejando que la furia primal recorra su cuerpo.',
      promptText: 'Dejo que la furia primal recorra mi cuerpo y me devuelva fuerzas.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'defensa',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_AVANZADA,
      energyRegen: 15,
    },
  },
  {
    level: 32,
    clase: 'DRUIDA',
    especializacion: 'SALVAJE',
    ability: {
      name: 'Zarpazo Doble',
      icon: '🐾',
      description: 'Dos zarpazos en el tiempo de uno, sin descanso entre ambos.',
      promptText: 'Suelto dos zarpazos sin descanso entre ambos.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 36,
    clase: 'DRUIDA',
    especializacion: 'SALVAJE',
    ability: {
      name: 'Colmillos Afilados',
      icon: '🦷',
      description: 'Sus colmillos, afilados al máximo, ya no dejan ninguna herida a medias.',
      promptText: 'Hundo mis colmillos afilados al máximo.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 40,
    clase: 'DRUIDA',
    especializacion: 'SALVAJE',
    ability: {
      name: 'Furia Desatada',
      icon: '💥',
      description: 'Toda la agresividad feral desatada de golpe — el remate definitivo del Salvaje.',
      promptText: 'Desato toda mi agresividad feral de golpe.',
      category: 'combate',
      effects: ['ATAQUE', 'ATURDIMIENTO'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_EXPERTA,
    },
  },

  // --- Adaptado (12/16/19/24/28/32/36/40 — todas listas) ---
  {
    level: 12,
    clase: 'DRUIDA',
    especializacion: 'ADAPTADO',
    ability: {
      name: 'Golpe Adaptado',
      icon: '🔀',
      description: 'Un golpe que se adapta a lo que haga falta, sin comprometerse con un solo estilo.',
      promptText: 'Adapto mi golpe a lo que haga falta en este instante.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 16,
    clase: 'DRUIDA',
    especializacion: 'ADAPTADO',
    ability: {
      name: 'Piel Cambiante',
      icon: '🐍',
      description: 'Su piel se adapta al golpe entrante, absorbiéndolo mejor de lo esperado.',
      promptText: 'Dejo que mi piel se adapte al golpe entrante.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'constitucion',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 19,
    clase: 'DRUIDA',
    especializacion: 'ADAPTADO',
    ability: {
      name: 'Adaptación Rápida',
      icon: '🔄',
      description: 'Su golpe adopta el atributo que mejor contrarresta al rival, leído sobre la marcha.',
      promptText: 'Adapto mi golpe al atributo que mejor contrarresta a mi rival.',
      category: 'combate',
      effects: ['ATAQUE', 'CONVERSION'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 24,
    clase: 'DRUIDA',
    especializacion: 'ADAPTADO',
    ability: {
      name: 'Instinto Adaptativo',
      icon: '💨',
      description: 'Recupera fuerzas adaptándose al ritmo del combate, sea cual sea.',
      promptText: 'Me adapto al ritmo del combate y recupero fuerzas.',
      category: 'combate',
      effects: ['RECUPERACION'],
      rol: 'utilidad',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_AVANZADA,
      energyRegen: 15,
    },
  },
  {
    level: 28,
    clase: 'DRUIDA',
    especializacion: 'ADAPTADO',
    ability: {
      name: 'Contragolpe Natural',
      icon: '🔁',
      description: 'Un golpe reactivo, respuesta natural e inmediata al ataque del rival.',
      promptText: 'Respondo de forma natural e inmediata al ataque de mi rival.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'ataque',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 32,
    clase: 'DRUIDA',
    especializacion: 'ADAPTADO',
    ability: {
      name: 'Reflejos Cambiantes',
      icon: '🌀',
      description: 'Sus reflejos cambian de estilo constantemente, difíciles de leer para el rival.',
      promptText: 'Cambio de estilo defensivo constantemente, difícil de leer.',
      category: 'combate',
      effects: ['AGUANTE'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 36,
    clase: 'DRUIDA',
    especializacion: 'ADAPTADO',
    ability: {
      name: 'Aullido Adaptativo',
      icon: '📢',
      description: 'Un aullido que se adapta a la situación — a veces aturde, a veces solo desconcierta.',
      promptText: 'Suelto un aullido que se adapta a la situación del combate.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'utilidad',
      preferredAttribute: 'carisma',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 40,
    clase: 'DRUIDA',
    especializacion: 'ADAPTADO',
    ability: {
      name: 'Forma Perfecta',
      icon: '✨',
      description: 'Se adapta hasta encontrar la forma perfecta para este combate concreto, y golpea con ella.',
      promptText: 'Encuentro la forma perfecta para este combate y golpeo con ella.',
      category: 'combate',
      effects: ['ATAQUE', 'CONVERSION'],
      rol: 'ataque',
      preferredAttribute: 'fuerza',
      energyCost: ENERGY_COST_EXPERTA,
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
