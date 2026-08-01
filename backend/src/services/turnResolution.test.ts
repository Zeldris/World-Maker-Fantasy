import { describe, it, expect } from 'vitest';
import { detectsLootIntent, detectsExecuteIntent } from './turnResolution.js';

describe('detectsLootIntent', () => {
  it('detecta coincidencia exacta de un stem', () => {
    expect(detectsLootIntent('Registro el cuerpo del enemigo caído.')).toBe(true);
  });

  it('tolera una errata de distancia 2 en un stem literal (auditoría 2026-07-20, P0.4)', () => {
    expect(detectsLootIntent('Le saqeo el cadáver antes de seguir.')).toBe(true);
  });

  it('no dispara con una acción sin ninguna intención de saqueo', () => {
    expect(detectsLootIntent('Miro con cuidado el horizonte.')).toBe(false);
  });

  it('no confunde "ataque"/"atacar"/"ataco" con el stem "saque" (bug real 2026-07-29, jugando en vivo: forzaba lootMode y desactivaba el combate real en un turno de ataque)', () => {
    expect(detectsLootIntent("Lanzo un ataque rápido y calculado con mi filo, buscando precisión antes que fuerza 'Orco enfurecido'.")).toBe(false);
    expect(detectsLootIntent('Ataco desde un silencio que no debería esconder a nadie.')).toBe(false);
    expect(detectsLootIntent('Mi olfato lee el miedo de mi enemigo — ataco en el instante exacto en que flaquea.')).toBe(false);
  });

  it('no confunde "comer"/"comió" con el stem "compr" (auditoría 2026-07-29 tras el bug de "ataque": justo la palabra que usaría comer un consumible para recuperar energía)', () => {
    expect(detectsLootIntent('Quiero comer mi ración de carne ahumada para recuperar fuerzas.')).toBe(false);
    expect(detectsLootIntent('Ya comió la ración de carne ahumada antes de seguir camino.')).toBe(false);
  });
});

// Cobertura nueva (2026-07-30, botón "Decapitar" — petición explícita: "un botón que solo sale
// cuando está incapacitado para matarlo").
describe('detectsExecuteIntent', () => {
  it('detecta "remato"/"decapito"/"ejecuto"/"degüello"', () => {
    expect(detectsExecuteIntent("Remato a 'Orco enfurecido', asestándole el golpe de gracia.")).toBe(true);
    expect(detectsExecuteIntent("Decapito a 'Orco enfurecido' sin piedad.")).toBe(true);
    expect(detectsExecuteIntent("Ejecuto a 'Orco enfurecido' de una vez por todas.")).toBe(true);
  });

  it('no dispara con una acción sin intención de rematar', () => {
    expect(detectsExecuteIntent("Registro el cuerpo de 'Orco enfurecido'.")).toBe(false);
    expect(detectsExecuteIntent('Miro con cuidado el horizonte.')).toBe(false);
  });
});
