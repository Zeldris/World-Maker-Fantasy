import { describe, it, expect } from 'vitest';
import { opcionesDisponiblesPara, OPCION_NOTICIAS, OPCION_TRABAJO } from './npcInteraction.js';
import type { NpcInScene } from './npcScene.js';

function npcFixture(overrides: Partial<NpcInScene> = {}): NpcInScene {
  return {
    id: 'npc1', slug: 'npc1', name: 'NPC de prueba', articulo: 'el', genero: null, kind: 'PRINCIPAL',
    level: 1, role: 'Maestro', faction: 'clan-serhu', personality: 'Serio', bio: 'x',
    items: [],
    attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 8, voluntad: 8, carisma: 8, magia: 0 },
    raza: 'orcos', clase: null, especializacion: null, ataqueNatural: null, habilidadesRaciales: [], faunaCategoria: null,
    temperamento: 'CAUTELOSO', condicionFisica: 'ILESO', saqueado: false, lootedItemNames: [], energia: null, analizado: false,
    capturable: false,
    groupSize: null, groupDefeated: 0, corpsesLooted: 0,
    abilityUsesThisEncounter: {},
    activeEffects: [],
    homeLocationSlug: 'karot-veku',
    comerciablePct: 0, reclutablePct: 0, domesticablePct: 0, cortejablePct: 0, capturablePct: 0,
    targetedForKill: false,
    interactionTypes: [],
    teachesProfession: null,
    ...overrides,
  };
}

describe('opcionesDisponiblesPara', () => {
  it('sin interactionTypes: no ofrece nada (el caller no debería ni llamar aquí)', () => {
    expect(opcionesDisponiblesPara(npcFixture(), { hayMisionOfertadaDeEsteNpc: false })).toEqual([]);
  });

  it('NPC_LORE puro: solo Charlar/Combatir/Salir', () => {
    const npc = npcFixture({ interactionTypes: ['NPC_LORE'] });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).toEqual(['Charlar', 'Combatir', 'Salir']);
  });

  it('MAESTRO_OFICIO con teachesProfession: ofrece Aprender oficio', () => {
    const npc = npcFixture({ interactionTypes: ['MAESTRO_OFICIO'], teachesProfession: 'herrero-orcos-llanuras' });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).toEqual(['Charlar', 'Aprender oficio', 'Combatir', 'Salir']);
  });

  it('MAESTRO_OFICIO sin teachesProfession (catálogo inconsistente): no ofrece Aprender oficio', () => {
    const npc = npcFixture({ interactionTypes: ['MAESTRO_OFICIO'], teachesProfession: null });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).toEqual(['Charlar', 'Combatir', 'Salir']);
  });

  it('NPC_MISION sin oferta activa de este NPC: no ofrece la opción de misión', () => {
    const npc = npcFixture({ interactionTypes: ['NPC_MISION'] });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).toEqual(['Charlar', 'Combatir', 'Salir']);
  });

  it('NPC_MISION con oferta activa de este NPC: incluye el título real', () => {
    const npc = npcFixture({ interactionTypes: ['NPC_MISION'] });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: true, tituloMisionOfertada: 'Acabar con el Orco Enfurecido' })).toEqual([
      'Charlar',
      'Misión: Acabar con el Orco Enfurecido',
      'Combatir',
      'Salir',
    ]);
  });

  it('capturable y en condición GRAVE: ofrece Ayudar y Reclutar', () => {
    const npc = npcFixture({ interactionTypes: ['NPC_LORE'], capturable: true, condicionFisica: 'GRAVE' });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).toEqual(['Charlar', 'Ayudar', 'Reclutar', 'Combatir', 'Salir']);
  });

  it('capturable pero ILESO todavía (no derrotado): no ofrece Reclutar', () => {
    const npc = npcFixture({ interactionTypes: ['NPC_LORE'], capturable: true, condicionFisica: 'ILESO' });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).toEqual(['Charlar', 'Combatir', 'Salir']);
  });

  it('GRAVE pero sin atributoResistencia (capturable: false): no ofrece Reclutar, sí Ayudar (CR-12)', () => {
    const npc = npcFixture({ interactionTypes: ['NPC_LORE'], capturable: false, condicionFisica: 'GRAVE' });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).toEqual(['Charlar', 'Ayudar', 'Combatir', 'Salir']);
  });

  it('los 3 interactionTypes a la vez, multivaluado (decisión explícita de la usuaria)', () => {
    const npc = npcFixture({
      interactionTypes: ['MAESTRO_OFICIO', 'NPC_MISION', 'NPC_LORE'],
      teachesProfession: 'curtidor-orcos-llanuras',
      capturable: true,
      condicionFisica: 'CONVALECIENTE',
    });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: true, tituloMisionOfertada: 'La deuda de Ulkha' })).toEqual([
      'Charlar',
      'Aprender oficio',
      'Misión: La deuda de Ulkha',
      'Ayudar',
      'Reclutar',
      'Combatir',
      'Salir',
    ]);
  });

  it('CR-12: un malherido sin interactionTypes (soldado de un campo de batalla) tiene menú para ayudarle', () => {
    const npc = npcFixture({ interactionTypes: [], capturable: false, condicionFisica: 'GRAVE' });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).toEqual(['Charlar', 'Ayudar', 'Combatir', 'Salir']);
    expect(opcionesDisponiblesPara(npcFixture({ interactionTypes: [], condicionFisica: 'ILESO' }), { hayMisionOfertadaDeEsteNpc: false })).toEqual([]);
  });
});

describe('CR-40 (40f): «¿Tienes trabajo?»', () => {
  it('sale solo si el caller dice que el NPC puede ofrecer trabajo, y nunca a un malherido', () => {
    const npc = npcFixture({ interactionTypes: ['CHARLA'] as never, condicionFisica: 'ILESO' });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).not.toContain(OPCION_TRABAJO);
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false, puedeOfrecerTrabajo: true })).toContain(OPCION_TRABAJO);
    const herido = npcFixture({ interactionTypes: ['CHARLA'] as never, condicionFisica: 'GRAVE' });
    expect(opcionesDisponiblesPara(herido, { hayMisionOfertadaDeEsteNpc: false, puedeOfrecerTrabajo: true })).not.toContain(OPCION_TRABAJO);
  });
});

describe('CR-18 (18c): «¿Qué se cuenta?»', () => {
  it('sale tras «¿Tienes trabajo?» solo si el caller dice que el NPC puede contar, y nunca a un malherido', () => {
    const npc = npcFixture({ interactionTypes: ['CHARLA'] as never, condicionFisica: 'ILESO' });
    expect(opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false })).not.toContain(OPCION_NOTICIAS);
    const opciones = opcionesDisponiblesPara(npc, { hayMisionOfertadaDeEsteNpc: false, puedeOfrecerTrabajo: true, puedeContarNoticias: true });
    expect(opciones.indexOf(OPCION_NOTICIAS)).toBe(opciones.indexOf(OPCION_TRABAJO) + 1);
    const herido = npcFixture({ interactionTypes: ['CHARLA'] as never, condicionFisica: 'GRAVE' });
    expect(opcionesDisponiblesPara(herido, { hayMisionOfertadaDeEsteNpc: false, puedeContarNoticias: true })).not.toContain(OPCION_NOTICIAS);
  });
});
