import { abrirPartida, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();
await verEstado(page, 'recorrido_05a_antes.png');

const interactuar = page.getByRole('button', { name: 'INTERACTUAR' });
if (await interactuar.isVisible().catch(() => false)) {
  await interactuar.click();
  await page.waitForTimeout(3000);
  await verEstado(page, 'recorrido_05b_modal.png');
  console.log('Modal abierto tras INTERACTUAR');
} else {
  console.log('No hay botón INTERACTUAR visible');
}

await browser.close();
