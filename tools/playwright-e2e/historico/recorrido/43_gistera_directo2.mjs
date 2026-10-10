import { turnoDirecto, SAVE_ID } from './lib.mjs';

console.log('Turno 1: explorar');
const r1 = await turnoDirecto(SAVE_ID, 'Sigo explorando la hondonada con cautela, atento a cualquier movimiento entre las sombras.');
console.log(JSON.stringify(r1).slice(0, 400));

console.log('Turno 2: explorar más');
const r2 = await turnoDirecto(SAVE_ID, 'Continúo adentrándome en la hondonada, buscando cualquier señal de otro superviviente.');
console.log(JSON.stringify(r2).slice(0, 400));

console.log('Turno 3: explorar más');
const r3 = await turnoDirecto(SAVE_ID, 'Avanzo con cuidado hacia el fondo, escudriñando cada sombra de las cuevas.');
console.log(JSON.stringify(r3).slice(0, 400));
