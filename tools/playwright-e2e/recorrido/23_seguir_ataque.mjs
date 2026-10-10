import { abrirPartida, atacarEnCombate, hayDefensaPendiente, defenderseEnCombate, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();

if (await hayDefensaPendiente(page)) {
  console.log('Defensa pendiente');
  await defenderseEnCombate(page);
}

const matarBtn = page.getByRole('button', { name: 'Matar' });
if (await matarBtn.isVisible().catch(() => false)) {
  console.log('CONVALECIENTE, matando...');
  await matarBtn.click();
  await page.waitForTimeout(2000);
} else {
  console.log('Atacando de nuevo...');
  await atacarEnCombate(page, 'Remato con un golpe certero.');
}

await verEstado(page, 'recorrido_23a.png');
console.log('Ronda completada');
await browser.close();
