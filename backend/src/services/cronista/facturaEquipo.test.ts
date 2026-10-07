import { describe, it, expect } from 'vitest';
import { costeDePiezas, desgasteSemanal, equipoDeAlta, familiaDeTaller, piezasEnCasa, roturaSinPagar } from './facturaEquipo.js';

describe('factura de equipo (CR-58)', () => {
  it('desgaste semanal: herramienta 7/4, arma 18/6, armadura 16/8', () => {
    expect(desgasteSemanal({ trabajadores: 4, soldados: 6 })).toEqual({ herramienta: 7, arma: 18, armadura: 12 });
  });

  it('lo que se fabrica en casa cuesta materiales (mitad del valor, 1 por cada 5 Goirnos); lo demás, Goirnos', () => {
    const enCasa = piezasEnCasa(new Set([familiaDeTaller('herreria-obrador')]));
    expect([...enCasa].sort()).toEqual(['arma', 'herramienta']);
    expect(costeDePiezas({ herramienta: 7, arma: 18, armadura: 16 }, enCasa)).toEqual({ goirnos: 16, materiales: 3 });
    expect(costeDePiezas({ herramienta: 7, arma: 18, armadura: 16 }, new Set())).toEqual({ goirnos: 41, materiales: 0 });
  });

  it('alta: herramienta para el trabajador; arma y armadura para el soldado', () => {
    expect(equipoDeAlta('trabajador')).toEqual({ herramienta: 7 });
    expect(equipoDeAlta('soldado')).toEqual({ arma: 18, armadura: 16 });
    expect(equipoDeAlta('cazador')).toEqual({ arma: 18 });
  });

  it('una semana sin pagar rompe 1/4 de las herramientas y 1/6 de las armas', () => {
    expect(roturaSinPagar({ trabajadores: 10, soldados: 7 })).toEqual({ sinHerramienta: 3, sinArma: 2 });
  });
});
