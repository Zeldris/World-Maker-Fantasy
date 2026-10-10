import { abrirPartida, atacarEnCombate, hayDefensaPendiente, defenderseEnCombate, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();

if (await hayDefensaPendiente(page)) {
  console.log('Hay defensa pendiente, defendiendo...');
  await defenderseEnCombate(page);
  await verEstado(page, 'recorrido_22a_defensa.png');
}

if (await hayDefensaPendiente(page)) {
  console.log('Sigue habiendo defensa pendiente tras la primera, defendiendo otra vez...');
  await defenderseEnCombate(page);
}

const matarBtn = page.getByRole('button', { name: 'Matar' });
if (await matarBtn.isVisible().catch(() => false)) {
  console.log('El Orco está CONVALECIENTE, pulsando Matar...');
  await matarBtn.click();
  await page.waitForTimeout(2000);
} else {
  console.log('Atacando de nuevo...');
  await atacarEnCombate(page, 'Sigo atacando con mi hacha rota.');
}

await verEstado(page, 'recorrido_22b.png');
console.log('Ronda completada');
await browser.close();
