import type { CardinalDirection } from './travel.js';

/// Un camino conocido desde la ubicación actual, ya con dirección cardinal resuelta (2026-08-15,
/// feature de exploración: usar la Aguja de Cardo Brújula). Solo llegan aquí los caminos con
/// coordenadas conocidas en ambos extremos — sin coordenadas, el camino simplemente no aparece
/// (falla cerrado, nunca se inventa una dirección).
export interface CompassLinkInfo {
  direction: CardinalDirection;
  toName: string;
  terreno: string;
  minutosBase: number;
}

const SECTOR_ORDER: CardinalDirection[] = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];

function joinWithY(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/// Texto determinista de "usar la Aguja de Cardo Brújula" (2026-08-15, petición explícita) —
/// nunca pasa por el Narrador/Ollama, se inserta directo como LogEntry (mismo patrón que
/// `questRewardNarrationFor`): todo el contenido ya se sabe con certeza mecánica (LocationLink +
/// coordenadas reales de docs/13-escala-del-mundo.md). Con el Mapa de las Llanuras en inventario,
/// nombra el destino real de cada camino conocido; sin mapa, describe el terreno de cada ruta
/// (reutiliza `LocationLink.terreno`, ya escrito como prosa para esto) sin revelar el destino.
export function compassNarrationText(links: CompassLinkInfo[], hasMap: boolean): string {
  if (links.length === 0) {
    return 'Sostienes la Aguja de Cardo Brújula en alto, pero gira sin encontrar ningún camino conocido cerca.';
  }

  const byDirection = new Map<CardinalDirection, CompassLinkInfo[]>();
  for (const link of links) {
    if (!byDirection.has(link.direction)) byDirection.set(link.direction, []);
    byDirection.get(link.direction)!.push(link);
  }

  const clauses = SECTOR_ORDER.filter((dir) => byDirection.has(dir)).map((dir) => {
    const group = byDirection.get(dir)!;
    if (hasMap) {
      const destinos = joinWithY(group.map((l) => `${l.toName} (${l.minutosBase} min)`));
      return `al ${dir} hay camino${group.length > 1 ? 's' : ''} a ${destinos}`;
    }
    return `al ${dir}: ${group.map((l) => l.terreno).join('; ')}`;
  });

  const intro = hasMap
    ? 'Consultas el mapa y, guiándote por el imán, ves que'
    : 'Sin mapa a mano, giras la aguja y describes lo que percibes alrededor:';

  return `${intro} ${clauses.join(', ')}.`;
}
