import { abrirPartida } from './lib.mjs';

const { browser, page } = await abrirPartida();
const screenshotDir = '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad';

await page.getByRole('button', { name: /compa[ñn]eros/i }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /grupos de combate/i }).click();
await page.waitForTimeout(500);

// Crear Grupo 2 si no existe todavía
const grupo2Existe = await page.locator('text=Grupo 2').first().isVisible().catch(() => false);
if (!grupo2Existe) {
  await page.getByRole('button', { name: /nuevo grupo/i }).click();
  await page.waitForTimeout(500);
}

// Drag and drop real: Ceniza -> Grupo 2
const ceniza = page.locator('div[draggable="true"]', { hasText: 'Ceniza' }).first();
const grupo2Box = page.locator('text=Grupo 2').first();

const cenizaBox = await ceniza.boundingBox();
const targetBox = await grupo2Box.boundingBox();

if (cenizaBox && targetBox) {
  await page.mouse.move(cenizaBox.x + cenizaBox.width / 2, cenizaBox.y + cenizaBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(700);
}

await page.screenshot({ path: `${screenshotDir}/45_tras_drag.png` });
console.log('Drag intentado');

await browser.close();
