import { abrirPartida, actuar, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();
await actuar(page, 'Empuño mi hacha rota y ataco al Orco Enfurecido con todas mis fuerzas.');
await verEstado(page, 'recorrido_14a.png');
console.log('Turno de ataque completado');
await browser.close();
