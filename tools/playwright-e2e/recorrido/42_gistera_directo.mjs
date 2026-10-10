import { turnoDirecto, SAVE_ID } from './lib.mjs';

console.log('Turno 1: explorar');
const r1 = await turnoDirecto(SAVE_ID, 'Camino hacia el fondo de la hondonada, buscando algún rastro de vida entre las cuevas.');
console.log(JSON.stringify(r1.narration ?? r1).slice(0, 300));

console.log('Turno 2: explorar más');
const r2 = await turnoDirecto(SAVE_ID, 'Sigo explorando la hondonada con cautela, atento a cualquier movimiento entre las sombras.');
console.log(JSON.stringify(r2.narration ?? r2).slice(0, 300));

console.log('Turno 3: explorar más');
const r3 = await turnoDirecto(SAVE_ID, 'Continúo adentrándome en la hondonada, buscando cualquier señal de otro superviviente.');
console.log(JSON.stringify(r3.narration ?? r3).slice(0, 300));
