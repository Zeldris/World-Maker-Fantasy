import { abrirPartida, actuar, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();

await actuar(page, 'Sigo explorando la hondonada con cautela, atento a cualquier movimiento entre las sombras.');
await verEstado(page, 'recorrido_04b.png');
console.log('Turno 2 completado');

await actuar(page, 'Continúo adentrándome en la hondonada, buscando cualquier señal de otro superviviente.');
await verEstado(page, 'recorrido_04c.png');
console.log('Turno 3 completado');

await browser.close();
console.log('Listo');
