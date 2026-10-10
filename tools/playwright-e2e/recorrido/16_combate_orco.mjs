import { abrirPartida, atacarEnCombate, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();
await atacarEnCombate(page, 'Golpeo con mi hacha rota con todas mis fuerzas.');
await verEstado(page, 'recorrido_16a.png');
console.log('Golpe 1 completado');
await browser.close();
