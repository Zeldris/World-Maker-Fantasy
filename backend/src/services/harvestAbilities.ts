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
/// RECURSO propia, ya usa la población FAUNA existente (ver population.ts). A diferencia de
/// minero/talador, su "ya localizado en la zona" (2026-08-09, petición explícita: "que al usar la
/// habilidad de profesión de desollar funcione como el resto y explore la zona con los cadáveres
/// derrotados") no mira `WorldPopulation` ni tiene "Explorar" propio — mira qué fauna en escena
/// (`detectNpcsInScene`, npcScene.ts) ya está derrotada (CONVALECIENTE/MUERTO) y sin despiezar
/// todavía (`carcassCandidatesFor`, recolectar.ts): solo puedes desollar lo que ya has vencido en
/// combate (y rematado o no) o lo que la propia narración ya ha descrito como cadáver en la zona.
export interface HarvestAbilityUnlock {
  /// Prefijo base del oficio recolector ("minero", "talador", "desollador"), SIN raza/región —
  /// professions.ts (2026-08-09) escala cada uno con sufijos distintos (minero/talador solo por
  /// región: "minero-llanuras"; desollador por raza+región, como su creadora peletero:
  /// "desollador-orcos-llanuras"). El emparejamiento real es por prefijo (ver
  /// `matchesOficioPrefix` más abajo), nunca por igualdad exacta.
  oficio: string;
  metodo: MetodoObtencion;
  ability: StartingAbility;
}

/// Compartida con `crafting.ts` § `hasToolForOficio`/`canCraft` (deuda técnica 2026-08-21: mismo
/// cuerpo de 2 líneas duplicado literal en ambos archivos).
export function matchesOficioPrefix(oficio: string, prefix: string): boolean {
  return oficio === prefix || oficio.startsWith(`${prefix}-`);
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
      description: 'Busca presas ya derrotadas en la zona (cazadas por ti o descritas como cadáver) para desollarlas y aprovechar sus materiales.',
      promptText: 'Despiezo y desuello la presa que tengo delante.',
      category: 'profesion',
    },
  },
  // Bug real encontrado jugando en vivo (2026-08-13, "no veo la habilidad de recolección para
  // herborista"): existía la profesión (professions.ts) y el catálogo (HarvestYield método
  // EXTRACCION), pero nunca su botón — herborista se quedó fuera de HARVEST_ABILITIES desde el
  // rediseño de profesiones original, mismo hueco que ya se cerró antes para desollador.
  {
    oficio: 'herborista',
    metodo: 'EXTRACCION',
    ability: {
      name: 'Recolectar hierbas',
      icon: '🌿',
      description: 'Busca hierbas o flores medicinales ya localizadas en la zona, o explora en busca de alguna nueva.',
      promptText: 'Busco hierbas o flores medicinales por la zona.',
      category: 'profesion',
    },
  },
];

/// Qué habilidad base recolectora se desbloquea al alcanzar nivel 1 en `oficio` — mismo criterio
/// que professionAbilityUnlocksFor, pero siempre nivel 1 (no hay recetas de tier superior aquí).
export function harvestAbilityUnlocksFor(oficio: string, nivel: number): StartingAbility[] {
  if (nivel !== 1) return [];
  return HARVEST_ABILITIES.filter((u) => matchesOficioPrefix(oficio, u.oficio)).map((u) => u.ability);
}

/// A qué MetodoObtencion corresponde un oficio recolector — null si `oficio` no es recolector
/// (o no existe). Usado por el endpoint de "Explorar"/localizado para saber qué buscar.
export function metodoForOficio(oficio: string): MetodoObtencion | null {
  return HARVEST_ABILITIES.find((u) => matchesOficioPrefix(oficio, u.oficio))?.metodo ?? null;
}
