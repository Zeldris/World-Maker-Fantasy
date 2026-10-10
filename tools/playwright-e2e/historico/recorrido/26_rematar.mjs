import { abrirPartida, atacarEnCombate, hayDefensaPendiente, defenderseEnCombate, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();

if (await hayDefensaPendiente(page)) {
  console.log('Defensa pendiente');
  await defenderseEnCombate(page);
}

await atacarEnCombate(page, 'Remato al orco con un golpe final.');
await verEstado(page, 'recorrido_26a.png');
console.log('Remate completado');
await browser.close();
