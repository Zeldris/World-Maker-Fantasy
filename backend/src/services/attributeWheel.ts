import type { Attribute } from './dice.js';

/// Rediseño del turno de combate (2026-07-28, petición explícita: "hacer un árbol de
/// debilidades... Fuerza<Destreza... quiero que sea muy variable el combate"). Anillo circular
/// en vez de una tabla 6×6 a mano: cada atributo pierde contra el siguiente en el anillo, gana
/// contra el anterior — ampliable a futuros atributos con solo insertarlos en un punto del
/// anillo, sin rediseñar la topología entera.
///
/// Orden y por qué (Destreza > Fuerza vino dado por la usuaria, el resto sigue la misma lógica
/// de "qué le gana a qué" en Tarkor). Rediseño de atributos (2026-07-29, referencia BG3/D&D, de 6
/// a 7 nodos — Sigilo/Carisma salieron, entraron Constitución/Inteligencia): la agilidad esquiva
/// la fuerza bruta; una lectura fría (Inteligencia) anticipa el movimiento antes de que ocurra,
/// venciendo la pura velocidad; la magia sortea la inteligencia (la magia salvaje no sigue una
/// lógica que se pueda anticipar); la constitución aguanta el desgaste mágico con pura resistencia
/// física; la voluntad quiebra a quien solo aguanta físicamente sin determinación; el carisma
/// quiebra la voluntad ajena; y la fuerza bruta no se deja intimidar, interrumpiendo el carisma
/// cerrando distancia — cierra el ciclo de vuelta a Fuerza.
export const ATTRIBUTE_RING: Attribute[] = ['fuerza', 'destreza', 'inteligencia', 'magia', 'constitucion', 'voluntad', 'carisma'];

/// Distancia dirigida en el anillo desde `a` hasta `b`, en pasos hacia adelante (1..ring.length-1
/// para atributos distintos, 0 si son el mismo). Ejemplo con el anillo de arriba:
/// `ringForwardSteps('fuerza', 'destreza') === 1` (fuerza pierde contra destreza, la siguiente),
/// `ringForwardSteps('destreza', 'fuerza') === 5` (destreza está "detrás" de fuerza, dando la
/// vuelta larga) — el signo de la ventaja se decide comparando ambos sentidos, ver
/// `typeMultiplierFor` más abajo.
function ringForwardSteps(a: Attribute, b: Attribute): number {
  const ring = ATTRIBUTE_RING;
  const iA = ring.indexOf(a);
  const iB = ring.indexOf(b);
  return (iB - iA + ring.length) % ring.length;
}

/// Distancia "real" (la más corta de las dos direcciones) — determina la MAGNITUD del
/// multiplicador; `ringForwardSteps` (o su opuesto) determina el SIGNO (quién tiene ventaja).
function ringDistance(a: Attribute, b: Attribute): number {
  const forward = ringForwardSteps(a, b);
  return Math.min(forward, ATTRIBUTE_RING.length - forward);
}

/// Dos árboles independientes (petición explícita: "lo complicado va a ser hacer dos árboles de
/// debilidades, las debilidades en ataque y las debilidades en defensa") — misma topología de
/// anillo para los dos (una sola rueda que aprender), pero magnitudes tuneables por separado.
/// Índice = distancia en el anillo (1, 2, o 3 — el máximo posible con 7 atributos). Sin entrada
/// para distancia 0 (mismo atributo, sin ventaja) ni para más allá del máximo.
export type CombatTree = 'ataque' | 'defensa';

const TYPE_MULTIPLIER_BY_DISTANCE: Record<CombatTree, Record<number, number>> = {
  // Distancia 1 (contrario directo): efecto notable pero no aplastante — con ×2 una sola
  // tirada decidiría el intercambio casi solo por el tipo, dejando poco peso a atributos/dados
  // reales (la propia usuaria avisó de que ×2 "quizás sea demasiado exagerado").
  ataque: { 1: 1.5, 2: 1.15, 3: 1 },
  // Distancia 3 (extremos opuestos del anillo): sin relación — dos tipos "sin nada que ver" no
  // se premian ni penalizan, decide el resto del sistema (atributos/dados).
  defensa: { 1: 1.5, 2: 1.15, 3: 1 },
};

/// Multiplicador a aplicar al VALOR del atributo (nunca a la dificultad ni al resultado del
/// dado — palabras textuales de la usuaria: "te reduce valor en tirada de dados") de quien usa
/// `tipoPropio` contra alguien que responde/expone `tipoRival`, en el árbol `arbol`. >1 = tiene
/// ventaja de tipo, exactamente 1 = sin relación, mismo atributo, O en desventaja de tipo.
///
/// SOLO PREMIA, NUNCA PENALIZA (rediseño 2026-08-15, petición explícita tras revisar un caso real
/// en partida: Destreza 20 vs Fuerza 5 en el mismo intercambio se sintió "muy injusto" — antes,
/// tener ventaja de tipo multiplicaba tu valor por `magnitude` (p. ej. ×1.5) Y AL MISMO TIEMPO
/// dividía el del rival por ese mismo `magnitude` (×0.67), así que la diferencia real entre los
/// dos lados no era ×1.5, era ×1.5×1.5 ≈ ×2.25 — el tipo de atributo podía pesar más que la
/// propia tirada de dados. Ahora el lado en desventaja de tipo se queda neutro (×1, igual que si
/// no hubiera relación en la rueda): el tipo de atributo es un extra que se puede GANAR, nunca
/// algo que te puedan QUITAR.
export function typeMultiplierFor(tipoPropio: Attribute, tipoRival: Attribute, arbol: CombatTree): number {
  if (tipoPropio === tipoRival) return 1;
  const distance = ringDistance(tipoPropio, tipoRival);
  const magnitude = TYPE_MULTIPLIER_BY_DISTANCE[arbol][distance] ?? 1;
  if (magnitude === 1) return 1;
  // ¿Quién tiene ventaja? Si `tipoRival` está a `distance` pasos HACIA ADELANTE de `tipoPropio`
  // (el camino corto en ese sentido), `tipoRival` gana — igual que en el ejemplo de la usuaria,
  // Destreza (1 paso por delante de Fuerza) le gana a Fuerza. Si el camino corto es hacia atrás,
  // es `tipoPropio` quien tiene la ventaja. Solo el lado ganador se multiplica — el perdedor se
  // queda en 1, nunca en `1 / magnitude`.
  const forward = ringForwardSteps(tipoPropio, tipoRival);
  const tipoPropioGana = forward > ATTRIBUTE_RING.length - forward;
  return tipoPropioGana ? magnitude : 1;
}

/// Aplica el multiplicador de tipo al valor crudo del atributo — lo que de verdad entra en
/// `rollCheck` en vez del valor sin ajustar. `Math.max(1, ...)` evita un valor efectivo de 0 o
/// negativo con atributos ya bajos (el multiplicador de tipo ya nunca es desfavorable, ver
/// comentario de `typeMultiplierFor` — esto sigue protegiendo contra un atributo crudo de 0).
export function effectiveAttributeValue(valorCrudo: number, tipoPropio: Attribute, tipoRival: Attribute, arbol: CombatTree): number {
  return Math.max(1, Math.round(valorCrudo * typeMultiplierFor(tipoPropio, tipoRival, arbol)));
}
