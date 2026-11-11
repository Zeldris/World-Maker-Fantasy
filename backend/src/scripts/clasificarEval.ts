/// Lógica de `clasificar-eval.ts` (QA-309): parseo de casos y la cadena de decisión del turno, con el clasificador
/// inyectado para poder probarla sin Ollama. Reutiliza las funciones reales de `npcScene.ts`; no copia su lógica.
import {
  detectsAttackIntent,
  detectsDialogueIntent,
  detectsGreetingOrQuestion,
  detectsHostileSearchIntent,
  detectsVerbalAcceptanceIntent,
  tabulatedAttackAttribute,
} from '../services/npcScene.js';
import type { ClassificationResult } from '../services/narrador.js';

export type TemperamentoCaso = 'AMIGABLE' | 'INOFENSIVO' | 'CAUTELOSO' | 'AGRESIVO' | 'ENEMIGO';

export interface CasoClasificar {
  id: string;
  accion: string;
  /// NPC en escena (mínimo). Sin él, la acción va sin nadie delante.
  npc?: { nombre: string; temperamento: TemperamentoCaso } | null;
  esperado: {
    tirada: boolean;
    atributo?: string;
    saludoOPregunta: boolean;
    amenaza: boolean;
    combate: boolean;
  };
  origen: string;
}

export interface Obtenido {
  tirada: boolean;
  atributo: string | null;
  saludoOPregunta: boolean;
  amenaza: boolean;
  combate: boolean;
  /// Qué decidió la tirada: la tabla determinista (ataque/búsqueda hostil), el modelo `clasificar` o el saludo (regla
  /// que apaga la tirada que pidió el modelo).
  capaTirada: 'regla: tabla de ataque' | 'modelo clasificar' | 'regla: saludo apaga la tirada' | 'sin NPC: modelo clasificar';
  capaCombate: 'regla: agresivo' | 'regla: verbo de ataque/búsqueda hostil' | 'regla: saludo' | 'ninguna';
}

export function parseCasos(texto: string): CasoClasificar[] {
  return texto
    .split('\n')
    .map((t, i) => ({ t, linea: i + 1 }))
    .filter(({ t }) => t.trim())
    .map(({ t, linea }) => {
      let c: CasoClasificar;
      try {
        c = JSON.parse(t) as CasoClasificar;
      } catch (err) {
        throw new Error(`línea ${linea} no es JSON válido (${err instanceof Error ? err.message : err})`);
      }
      if (!c.id || !c.accion || !c.origen || !c.esperado || typeof c.esperado.tirada !== 'boolean' || typeof c.esperado.combate !== 'boolean') {
        throw new Error(`línea ${linea}: faltan id, accion, origen o esperado.{tirada,combate}`);
      }
      return c;
    });
}

/// La cadena de `turn.ts` (tirada: atajo tabulado → `classifyAction` → saludo sin tirada) y de `turnResolution.ts`
/// (combate: `saludoSinHostilidad`, `agresivoSlugsInScene`, `shouldForceCombat`), sin el `combateIniciado` que propone el
/// narrador (es una llamada aparte, la del modelo grande) ni reputación de facción (se supone neutra).
export async function decidir(caso: CasoClasificar, clasificar: (accion: string) => Promise<ClassificationResult>): Promise<Obtenido> {
  const { accion, npc } = caso;
  const hayNpc = !!npc;
  const saludo = detectsGreetingOrQuestion(accion);
  const verboAtaque = detectsAttackIntent(accion) || (detectsHostileSearchIntent(accion) && !detectsVerbalAcceptanceIntent(accion));

  let tirada: boolean;
  let atributo: string | null = null;
  let capaTirada: Obtenido['capaTirada'];
  if (hayNpc && verboAtaque) {
    tirada = true;
    atributo = tabulatedAttackAttribute(accion);
    capaTirada = 'regla: tabla de ataque';
  } else {
    const c = await clasificar(accion);
    tirada = c.requiereTirada;
    atributo = c.atributo;
    capaTirada = hayNpc ? 'modelo clasificar' : 'sin NPC: modelo clasificar';
  }
  // turn.ts: el saludo apaga la tirada decida quien decida (tabla o modelo).
  if (tirada && hayNpc && saludo) {
    tirada = false;
    capaTirada = 'regla: saludo apaga la tirada';
  }

  const agresivo = npc?.temperamento === 'AGRESIVO' || npc?.temperamento === 'ENEMIGO';
  let combate = false;
  let capaCombate: Obtenido['capaCombate'] = hayNpc && saludo ? 'regla: saludo' : 'ninguna';
  if (hayNpc && agresivo) {
    combate = true;
    capaCombate = 'regla: agresivo';
  } else if (hayNpc && !saludo && verboAtaque) {
    combate = true;
    capaCombate = 'regla: verbo de ataque/búsqueda hostil';
  }

  // Amenaza: lo que el turno trata como intención hostil: lo que no es saludo ni pregunta y es diálogo o verbo de ataque.
  const amenaza = !saludo && (verboAtaque || detectsDialogueIntent(accion));
  return { tirada, atributo: tirada ? atributo : null, saludoOPregunta: saludo, amenaza, combate, capaTirada, capaCombate };
}

export function diferencias(caso: CasoClasificar, o: Obtenido): string[] {
  const e = caso.esperado;
  const d: string[] = [];
  if (o.tirada !== e.tirada) d.push(`tirada (esperado ${e.tirada}, obtenido ${o.tirada}; decidió: ${o.capaTirada})`);
  if (e.atributo && o.tirada && o.atributo !== e.atributo) d.push(`atributo (esperado ${e.atributo}, obtenido ${o.atributo})`);
  if (o.saludoOPregunta !== e.saludoOPregunta) d.push(`saludo/pregunta (esperado ${e.saludoOPregunta}, obtenido ${o.saludoOPregunta})`);
  if (o.amenaza !== e.amenaza) d.push(`amenaza (esperado ${e.amenaza}, obtenido ${o.amenaza})`);
  if (o.combate !== e.combate) d.push(`combate (esperado ${e.combate}, obtenido ${o.combate}; decidió: ${o.capaCombate})`);
  return d;
}
