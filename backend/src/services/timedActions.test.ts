import { describe, it, expect } from 'vitest';
import { duracionExplicitaMinutos, duracionExplicitaDeLaAccion, computeDuration, mentionsExplicitDuration } from './timedActions.js';

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

/// P17 (QA-27): «descanso un par de horas» duraba 5 minutos si el clasificador no leía la duración.
describe('P17 — la duración explícita del texto manda', () => {
  const attrs = { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 };

  it('lee las duraciones habituales', () => {
    expect(duracionExplicitaMinutos('Me siento a la sombra junto al pozo y descanso un par de horas')).toBe(120);
    expect(duracionExplicitaMinutos('Duermo toda la noche')).toBe(480);
    expect(duracionExplicitaMinutos('Descanso media hora')).toBe(30);
    expect(duracionExplicitaMinutos('Trabajo tres horas en la empalizada')).toBe(180);
    expect(duracionExplicitaMinutos('Me quedo 2 días construyendo')).toBe(2880);
    expect(duracionExplicitaMinutos('Paso una semana aquí')).toBe(10080);
    expect(duracionExplicitaMinutos('Espero diez minutos')).toBe(10);
  });

  it('sin duración explícita devuelve null', () => {
    expect(duracionExplicitaMinutos('Descanso un rato')).toBeNull();
    expect(duracionExplicitaMinutos('Examino mis alrededores')).toBeNull();
    expect(duracionExplicitaMinutos('Ataco a dos Guchapos')).toBeNull();
    expect(duracionExplicitaMinutos('Descanso varios días')).toBeNull();
    expect(duracionExplicitaMinutos('Espero unas horas')).toBeNull();
  });

  it('una referencia al pasado no es la duración de la acción', () => {
    expect(duracionExplicitaMinutos('Como la carne que cacé hace dos días')).toBeNull();
    expect(duracionExplicitaMinutos('Busco las huellas de hace tres horas')).toBeNull();
  });

  it('la que se aplica a la clasificación respeta lo dicho y lo instantáneo', () => {
    expect(duracionExplicitaDeLaAccion('Descanso un par de horas', 'corta')).toBe(120);
    expect(duracionExplicitaDeLaAccion('Le digo que vuelvo en una hora', 'corta')).toBeNull();
    expect(duracionExplicitaDeLaAccion('Examino la veta durante una hora', 'instantanea')).toBeNull();
  });

  it('computeDuration usa la del texto aunque el clasificador diga otra cosa', () => {
    expect(computeDuration('Descanso un par de horas junto al pozo', 'corta', attrs, 5).minutos).toBe(120);
    expect(computeDuration('Descanso un par de horas', 'instantanea', attrs, 0).minutos).toBe(120);
    expect(computeDuration('Descanso un rato', 'corta', attrs, 20).minutos).toBe(20);
  });
});

describe('P17 — lo que se dice no ocupa tiempo', () => {
  const attrs = { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 };
  it('hablar de una duración no la hace durar', () => {
    expect(computeDuration('Le digo que vuelvo en una hora', 'instantanea', attrs, 0).minutos).toBe(1);
    expect(computeDuration('Examino la veta durante una hora', 'instantanea', attrs, 0).minutos).toBe(1);
    expect(computeDuration('Espero dos horas a que pase la tormenta', 'instantanea', attrs, 0).minutos).toBe(120);
  });
});
