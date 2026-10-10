import { abrirPartida, actuar, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();

const cancelar = page.getByRole('button', { name: 'CANCELAR' });
if (await cancelar.isVisible().catch(() => false)) {
  await cancelar.click();
  await page.waitForTimeout(500);
}

await actuar(page, 'Emprendo el camino de vuelta hacia el Karot Veku, el campamento del Clan Serhu.');
await verEstado(page, 'recorrido_40a.png');
console.log('Turno de viaje enviado');
await browser.close();
