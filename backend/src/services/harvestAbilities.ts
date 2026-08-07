import type { MetodoObtencion } from '@prisma/client';
import type { StartingAbility } from './startingAbilities.js';

/// Habilidades BASE de oficio recolector (rediseño de profesiones, 2026-08-07) — a diferencia de
/// las de oficio creador (professionAbilities.ts, una por RECETA), aquí hay una sola habilidad
/// genérica por oficio recolector, desbloqueada a nivel 1 ("Minar", "Talar", "Desollar"). No manda
/// `promptText` directo al composer al pulsarla — el frontend abre un pop-up de selección
/// (HarvestSelectionModal) que primero busca fuentes ya localizadas en la escena
/// (`detectHarvestSourcesInScene`, harvest.ts) y, si no hay ninguna, ofrece "Explorar"
/// (`GET /saves/:id/recolectar/:oficio`, determinista, sin gastar turno — ver `metodoForOficio`
/// más abajo, que conecta cada oficio recolector con su `MetodoObtencion` real de HarvestYield).
///
/// Desuello usa el método CAZA (fauna ya derrotada) — no necesita una fila `WorldPopulation` tipo
/// RECURSO propia, ya usa la población FAUNA existente (ver population.ts).
export interface HarvestAbilityUnlock {
  oficio: string;
  metodo: MetodoObtencion;
  ability: StartingAbility;
}

const HARVEST_ABILITIES: HarvestAbilityUnlock[] = [
  {
    oficio: 'minero',
    metodo: 'MINERIA',
    ability: {
      name: 'Minar',
      icon: '⛏️',
      description: 'Busca vetas de mineral o piedra que ya se hayan localizado en la zona, o explora en busca de alguna nueva.',
      promptText: 'Busco vetas de mineral o piedra por la zona.',
      category: 'profesion',
    },
  },
  {
    oficio: 'talador',
    metodo: 'TALA',
    ability: {
      name: 'Talar',
      icon: '🪓',
      description: 'Busca madera ya localizada en la zona, o explora en busca de matorral o árboles que talar.',
      promptText: 'Busco madera que talar por la zona.',
      category: 'profesion',
    },
  },
  {
    oficio: 'desollador',
    metodo: 'CAZA',
    ability: {
      name: 'Desollar',
      icon: '🔪',
      description: 'Despelleja y despieza una presa ya derrotada que tengas delante.',
      promptText: 'Despiezo y desuello la presa que tengo delante.',
      category: 'profesion',
    },
  },
];

/// Qué habilidad base recolectora se desbloquea al alcanzar nivel 1 en `oficio` — mismo criterio
/// que professionAbilityUnlocksFor, pero siempre nivel 1 (no hay recetas de tier superior aquí).
export function harvestAbilityUnlocksFor(oficio: string, nivel: number): StartingAbility[] {
  if (nivel !== 1) return [];
  return HARVEST_ABILITIES.filter((u) => u.oficio === oficio).map((u) => u.ability);
}

export function allHarvestAbilityUnlocks(): HarvestAbilityUnlock[] {
  return HARVEST_ABILITIES;
}

/// A qué MetodoObtencion corresponde un oficio recolector — null si `oficio` no es recolector
/// (o no existe). Usado por el endpoint de "Explorar" para saber qué buscar.
export function metodoForOficio(oficio: string): MetodoObtencion | null {
  return HARVEST_ABILITIES.find((u) => u.oficio === oficio)?.metodo ?? null;
}
