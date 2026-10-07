import { describe, it, expect } from 'vitest';
import { CATALOGO_SUCESOS, importanciaDeSuceso, textoDeSuceso } from './catalogoSucesos.js';

// CR-2 (hito 0.2, roadmap-cronista.md § 6.1 y § 6.3).
describe('catálogo de sucesos', () => {
  it('cubre todos los tipos iniciales de § 6.1, cada uno con familia, importancia 1-10 y plantilla', () => {
    // Lista de § 6.1 copiada tal cual: si alguien quita un tipo del catálogo, este test lo dice.
    const esperados = [
      'ACCION_RELEVANTE', 'COMBATE_GANADO', 'COMBATE_PERDIDO', 'MUERTE_CAUSADA', 'PERDON_CONCEDIDO', 'CAPTURA', 'PROMESA', 'PROMESA_CUMPLIDA',
      'PROMESA_ROTA', 'REGALO', 'ROBO', 'MISION_COMPLETADA', 'MISION_FALLIDA', 'DESCUBRIMIENTO', 'OFICIO_APRENDIDO', 'MUERTE_JUGADOR', 'RENACER',
      'FIN_PARTIDA', 'NACIMIENTO_NOTABLE', 'MUERTE_NPC', 'MUERTE_LIDER', 'SUCESION', 'HEREDERO_DESIGNADO', 'RECUPERACION_NPC', 'CADAVER_DESAPARECE',
      'CAMBIO_RELACION', 'GUERRA_DECLARADA', 'TREGUA', 'ALIANZA', 'TRATADO_COMERCIAL', 'RUPTURA', 'SABOTAJE', 'ESPIONAJE', 'FACCION_CAE',
      'FACCION_ESCINDIDA', 'FACCION_FUNDADA', 'FACCION_ABSORBIDA', 'CAMBIO_LIDER', 'TERRITORIO_CONQUISTADO', 'TERRITORIO_PERDIDO', 'EXPEDICION_SALE',
      'EXPEDICION_INTERCEPTADA', 'EXPEDICION_VUELVE', 'TORMENTA', 'TORMENTA_EXTREMA', 'CAMBIO_ESTACION', 'SEQUIA', 'OLA_FRIO', 'MIGRACION_FAUNA',
      'PLAGA', 'INCENDIO', 'CRECIDA', 'DESPRENDIMIENTO', 'AUGE_POBLACION', 'DECLIVE_POBLACION', 'ESCASEZ', 'AUGE_COMERCIAL', 'CARAVANA',
      'PRECIOS_DISPARADOS', 'REINO_FUNDADO', 'EDIFICIO_CONSTRUIDO', 'EDIFICIO_DANADO', 'REBELION', 'CONSOLIDACION', 'HAMBRUNA', 'LLEGADA_POBLADORES',
      'VISITANTE_ILUSTRE', 'CAMPAMENTO_DESTRUIDO', 'CAMPAMENTO_NUEVO', 'HALLAZGO_RUINA', 'HALLAZGO_DOCUMENTO', 'LEYENDA_NACE', 'SISTEMA_MUNDO_INICIADO', 'CONSECUENCIA_PERDIDA', 'HILO_ABIERTO',
      'HILO_CERRADO',
      // CR-12 (narrador de fondo).
      'ESCARAMUZA', 'MALESTAR_INTERNO', 'AYUDA_PRESTADA', 'HUIDA_DE_NPC', 'NPC_DESTACA', 'ETIQUETA_GANADA', 'ETIQUETA_PERDIDA', 'COMPANERO_SE_VA', 'RECLUTAMIENTO', 'RECLUTAMIENTO_FALLIDO', 'INFORMANTE_CAPTADO', 'INFORMANTE_DESCUBIERTO',
      // CR-40 (misiones del motor): dejar una misión no es fracasar.
      'MISION_ABANDONADA',
    ];
    expect(Object.keys(CATALOGO_SUCESOS).sort()).toEqual([...esperados].sort());
    for (const def of Object.values(CATALOGO_SUCESOS)) {
      expect(def.importanciaBase).toBeGreaterThanOrEqual(1);
      expect(def.importanciaBase).toBeLessThanOrEqual(10);
    }
  });

  it('las importancias base respetan los tramos de ejemplo de § 6.3', () => {
    expect(CATALOGO_SUCESOS.EXPEDICION_SALE.importanciaBase).toBeLessThanOrEqual(2);
    expect(CATALOGO_SUCESOS.EDIFICIO_CONSTRUIDO.importanciaBase).toBeGreaterThanOrEqual(3);
    expect(CATALOGO_SUCESOS.TORMENTA_EXTREMA.importanciaBase).toBeGreaterThanOrEqual(5);
    expect(CATALOGO_SUCESOS.GUERRA_DECLARADA.importanciaBase).toBeGreaterThanOrEqual(7);
    expect(CATALOGO_SUCESOS.REINO_FUNDADO.importanciaBase).toBeGreaterThanOrEqual(7);
    expect(CATALOGO_SUCESOS.MUERTE_LIDER.importanciaBase).toBeGreaterThanOrEqual(9);
    expect(CATALOGO_SUCESOS.FACCION_CAE.importanciaBase).toBeGreaterThanOrEqual(9);
  });

  it('la plantilla escribe la frase con los nombres de los datos', () => {
    expect(textoDeSuceso('MUERTE_CAUSADA', { personaje: 'Gorhorn', victima: 'Gistera Koh' })).toBe('Gorhorn da muerte a Gistera Koh.');
    expect(textoDeSuceso('REINO_FUNDADO', { reino: 'Maktor', fundador: 'Gorhorn', region: 'las Llanuras del Viento Rojo' })).toBe('Gorhorn funda el reino de Maktor en las Llanuras del Viento Rojo.');
    expect(textoDeSuceso('LLEGADA_POBLADORES', { reino: 'Maktor', cuantos: 1 })).toBe('Llega un poblador a Maktor.');
    expect(textoDeSuceso('LLEGADA_POBLADORES', { reino: 'Maktor', cuantos: 3 })).toBe('Llegan 3 pobladores a Maktor.');
    expect(textoDeSuceso('MUERTE_NPC', { npc: 'Tira', causa: 'de vieja' })).toBe('Muere Tira (de vieja).');
  });

  it('importancia: +1 por jugador autor, +1 por núcleo jugable, +1 por hilo, con tope 10', () => {
    expect(importanciaDeSuceso('MUERTE_NPC', { jugadorAutor: false, afectaNucleoJugable: false, tocaHilo: false })).toBe(5);
    expect(importanciaDeSuceso('MUERTE_NPC', { jugadorAutor: true, afectaNucleoJugable: true, tocaHilo: true })).toBe(8);
    expect(importanciaDeSuceso('FACCION_CAE', { jugadorAutor: true, afectaNucleoJugable: true, tocaHilo: true })).toBe(10);
  });
});
