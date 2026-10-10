import { abrirPartida, atacarEnCombate, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();
await atacarEnCombate(page, 'Golpeo de nuevo con todas mis fuerzas.');
await verEstado(page, 'recorrido_21a.png');
console.log('Golpe 2 completado');
await browser.close();
