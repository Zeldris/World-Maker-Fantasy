import { describe, it, expect } from 'vitest';
import { extractStreamingNarration } from './narrationStream.js';

describe('extractStreamingNarration', () => {
  it('devuelve vacío si todavía no ha llegado la clave "narration"', () => {
    expect(extractStreamingNarration('{\n ')).toEqual({ value: '', closed: false });
  });

  it('devuelve vacío si la clave llegó pero no la comilla de apertura del valor', () => {
    expect(extractStreamingNarration('{"narration":')).toEqual({ value: '', closed: false });
  });

  it('extrae el valor parcial mientras la cadena sigue abierta', () => {
    expect(extractStreamingNarration('{"narration": "Gorhorn asciende')).toEqual({
      value: 'Gorhorn asciende',
      closed: false,
    });
  });

  it('marca closed:true al encontrar la comilla de cierre sin escapar', () => {
    expect(extractStreamingNarration('{"narration": "Gorhorn asciende la colina.", "newFacts"')).toEqual({
      value: 'Gorhorn asciende la colina.',
      closed: true,
    });
  });

  it('decodifica comillas escapadas dentro del valor sin cerrar la cadena de más', () => {
    expect(extractStreamingNarration('{"narration": "Dice \\"alto\\" y sigue')).toEqual({
      value: 'Dice "alto" y sigue',
      closed: false,
    });
  });

  it('decodifica saltos de línea y barras invertidas escapadas', () => {
    expect(extractStreamingNarration('{"narration": "Una línea\\nY otra\\\\barra"')).toEqual({
      value: 'Una línea\nY otra\\barra',
      closed: true,
    });
  });

  it('espera a más datos si un escape queda cortado justo al final del chunk', () => {
    expect(extractStreamingNarration('{"narration": "final con barra\\')).toEqual({
      value: 'final con barra',
      closed: false,
    });
  });

  it('espera a más datos si un \\u queda incompleto', () => {
    expect(extractStreamingNarration('{"narration": "algo \\u00')).toEqual({
      value: 'algo ',
      closed: false,
    });
  });

  it('caso real: crece de forma monótona chunk a chunk hasta cerrar', () => {
    const full = '{"narration": "El orco levanta su hacha y golpea con fuerza.", "newFacts": []}';
    let prevLen = -1;
    for (let end = 1; end <= full.length; end++) {
      const { value } = extractStreamingNarration(full.slice(0, end));
      expect(value.length).toBeGreaterThanOrEqual(prevLen);
      prevLen = value.length;
    }
    expect(extractStreamingNarration(full)).toEqual({
      value: 'El orco levanta su hacha y golpea con fuerza.',
      closed: true,
    });
  });
});
