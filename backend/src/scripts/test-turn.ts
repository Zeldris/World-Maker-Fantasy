import 'dotenv/config';
import '../lib/setupFetch.js';
import { rollCheck } from '../services/dice.js';
import { classifyAction, narrateAction } from '../services/narrador.js';
import type { AttributeBlock } from '../services/dice.js';

/// Script de prueba manual por terminal — flujo de turno completo con Gorhorn.
/// Uso: npm run test:turn -- "Gorhorn examina sus alrededores al anochecer"
/// (o npx tsx src/scripts/test-turn.ts "acción aquí")
///
/// Esto es deliberadamente simple: datos de Gorhorn y hechos de mundo a mano, sin base de
/// datos todavía. Sirve para probar el flujo clasificar → tirar → narrar de verdad contra
/// Ollama. La orquestación real (con Save/WorldState en Postgres) se construye después.

const gorhorn = {
  name: 'Gorhorn',
  attributes: { fuerza: 18, destreza: 9, constitucion: 5, inteligencia: 5, voluntad: 12, carisma: 8, arcano: 8 } satisfies AttributeBlock,
  summary:
    'Gorhorn, guerrero orco, único superviviente del clan Maktor, aniquilado como carne de cañón por el mando Goirntes en la Concordia de Hierro. Viaja solo por las Llanuras del Viento Rojo buscando una forma de que la muerte de su clan signifique algo.',
};

const worldFacts = [
  'No hay luna convencional: un cinturón de micro-cristales atmosféricos da un brillo perlado durante la noche.',
  'Gorhorn está solo, sin campamento ni aliados cerca.',
  'La Concordia de Hierro sigue reclutando contingentes orcos para el frente contra Vaelira.',
];

async function main() {
  const action = process.argv.slice(2).join(' ') || 'Gorhorn examina sus alrededores al anochecer.';

  console.log(`\n=== Turno de ${gorhorn.name} ===`);
  console.log(`Acción: "${action}"\n`);

  const ctx = { worldFacts, characterSummary: gorhorn.summary, action };

  console.log('[1/2] Clasificando acción...');
  let t0 = Date.now();
  const classification = await classifyAction(ctx);
  console.log(`   → ${JSON.stringify(classification)} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

  const roll = classification.requiereTirada
    ? rollCheck(gorhorn.attributes, classification.atributo, classification.dificultad)
    : undefined;

  if (roll) {
    console.log(
      `[dado] ${roll.attribute} ${roll.value} → d20(${roll.roll}) + ${Math.floor(roll.value / 2)} = ${roll.result} vs dificultad ${roll.difficulty} → ${roll.success ? 'ÉXITO' : 'FALLO'}\n`,
    );
  } else {
    console.log('[dado] sin tirada — la clasificación decidió que no hacía falta.\n');
  }

  console.log('[2/2] Narrando resultado...');
  t0 = Date.now();
  const narration = await narrateAction({ ...ctx, roll });
  console.log(`   (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

  console.log('--- Narración ---');
  console.log(narration.narration);
  if (narration.newFacts.length) {
    console.log('\n--- Hechos nuevos ---');
    narration.newFacts.forEach((f) => console.log(`- ${f}`));
  }
  console.log();
}

main().catch((err) => {
  console.error('Error en el turno de prueba:', err);
  process.exit(1);
});
