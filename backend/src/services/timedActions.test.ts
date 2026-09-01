import { describe, it, expect } from 'vitest';
import { computeDuration, mentionsExplicitDuration } from './timedActions.js';

const attrs = { fuerza: 8, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

describe('mentionsExplicitDuration', () => {
  it('detecta duraciones explícitas', () => {
    expect(mentionsExplicitDuration('Me quedo aquí varios días construyendo un campamento')).toBe(true);
    expect(mentionsExplicitDuration('Descanso toda la noche')).toBe(true);
    expect(mentionsExplicitDuration('Viajo durante 3 horas')).toBe(true);
    expect(mentionsExplicitDuration('Me quedo una semana')).toBe(true);
  });

  it('no dispara en una acción sin duración explícita (bug real 2026-07-20)', () => {
    expect(mentionsExplicitDuration('Explorar la zona en busca de provisiones, presas o algun enemigo')).toBe(false);
  });
});

describe('computeDuration', () => {
  it('produce leña de matorral de cuerno con la misma fórmula que la leña genérica', () => {
    const generica = computeDuration('Corto leña en el bosque', 'corta', attrs, 30);
    const matorral = computeDuration('Recojo leña de un matorral de cuerno', 'corta', attrs, 30);
    expect(matorral.produccion?.itemName).toBe('Leña de matorral de cuerno');
    expect(matorral.produccion?.cantidad).toBe(generica.produccion?.cantidad);
  });

  it('produce grano de espiga roja a razón de 1 por hora, sin escalar con atributos', () => {
    const unaHora = computeDuration('Recolecto espiga roja en la llanura', 'extendida', attrs, 60);
    expect(unaHora.produccion).toEqual({ itemName: 'Grano de espiga roja', cantidad: 1 });

    const dosHoras = computeDuration('Recolecto espiga roja en la llanura', 'extendida', attrs, 120);
    expect(dosHoras.produccion?.cantidad).toBe(2);

    const fuerzaAlta = computeDuration('Recolecto espiga roja en la llanura', 'extendida', { ...attrs, fuerza: 20 }, 60);
    expect(fuerzaAlta.produccion?.cantidad).toBe(1);
  });

  it('banda instantánea tiene un suelo de 1 minuto, no 0 (bug real jugando: 14 turnos de combate seguidos sin avanzar el reloj)', () => {
    expect(computeDuration('Ataco con mi hacha', 'instantanea', attrs, 0)).toEqual({ minutos: 1 });
  });
});
