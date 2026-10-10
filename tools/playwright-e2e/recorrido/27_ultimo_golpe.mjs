import { abrirPartida, atacarEnCombate, hayDefensaPendiente, defenderseEnCombate, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();

if (await hayDefensaPendiente(page)) {
  await defenderseEnCombate(page);
}

await atacarEnCombate(page, 'Le doy el golpe de gracia.');
await verEstado(page, 'recorrido_27a.png');
console.log('Golpe final completado');
await browser.close();
