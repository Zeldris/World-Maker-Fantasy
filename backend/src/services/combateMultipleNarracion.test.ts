import { describe, it, expect } from 'vitest';
import { buildExchangeNarrationPrompt, deterministicExchangeNarration, type TurnoNarracionInput } from './combateMultipleNarracion.js';

// Grupo 3 § Combate múltiple (2026-08-25) — solo las 2 piezas puras (prompt/fallback); la llamada
// real a Ollama no se testea aquí, mismo criterio que narrateAction en narrador.test.ts.

const base: TurnoNarracionInput = {
  atacanteNombre: 'Gorhorn',
  defensorNombre: 'Corretolvas',
  habilidadNombre: 'Golpe Certero',
  exchangeBlock: 'RESULTADO DEL INTERCAMBIO — YA RESUELTO, no lo cambies: Gorhorn tira 18 · Corretolvas tira 10.',
  combatBothMissed: false,
  combatRealHitLanded: true,
  defensorQuedaConvalecienteEsteTurno: false,
  defensorMuereEsteTurno: false,
};

describe('buildExchangeNarrationPrompt', () => {
  it('incluye el exchangeBlock ya resuelto y la habilidad tal cual, sin reinterpretarlos', () => {
    const { prompt, format } = buildExchangeNarrationPrompt(base);
    expect(prompt).toContain(base.exchangeBlock);
    expect(prompt).toContain('Golpe Certero');
    expect(prompt).toContain(base.atacanteNombre);
    expect(prompt).toContain(base.defensorNombre);
    expect(format).toEqual({ type: 'object', properties: { narration: { type: 'string' } }, required: ['narration'] });
  });
});

describe('deterministicExchangeNarration', () => {
  it('muerte tiene prioridad sobre cualquier otro estado', () => {
    const texto = deterministicExchangeNarration({ ...base, defensorMuereEsteTurno: true, defensorQuedaConvalecienteEsteTurno: true });
    expect(texto).toContain('acaba con');
  });

  it('CONVALECIENTE sin muerte da el texto de "sin fuerzas"', () => {
    const texto = deterministicExchangeNarration({ ...base, defensorQuedaConvalecienteEsteTurno: true });
    expect(texto).toContain('sin fuerzas');
  });

  it('ambos fallan da un texto neutro sin golpe', () => {
    const texto = deterministicExchangeNarration({ ...base, combatBothMissed: true, combatRealHitLanded: false });
    expect(texto).toContain('ninguno conecta');
  });

  it('golpe real sin caída da un texto de impacto', () => {
    const texto = deterministicExchangeNarration(base);
    expect(texto).toContain('golpea');
  });

  it('nunca deja el nombre del atacante o defensor fuera del texto', () => {
    for (const overrides of [
      {},
      { defensorMuereEsteTurno: true },
      { defensorQuedaConvalecienteEsteTurno: true },
      { combatBothMissed: true, combatRealHitLanded: false },
    ]) {
      const texto = deterministicExchangeNarration({ ...base, ...overrides });
      expect(texto).toContain(base.atacanteNombre);
      expect(texto).toContain(base.defensorNombre);
    }
  });
});
