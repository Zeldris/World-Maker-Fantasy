import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: '✨ Habilidades' }).click();
await page.waitForTimeout(1000);
await page.getByText('Combate', { exact: true }).click();
await page.waitForTimeout(1000);

// Buscar el botón info dentro de la tarjeta de Tajo Horizontal
const tarjeta = page.locator('text=Tajo Horizontal').locator('../..').last();
await tarjeta.hover();
await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/bonus_hover_00.png', fullPage: true });

const infoBtn = tarjeta.getByText('ⓘ');
console.log('Botones info encontrados:', await infoBtn.count());
if (await infoBtn.count() > 0) {
  await infoBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/bonus_hover_01_detalle.png', fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log('Contiene "bono fijo":', bodyText.includes('bono fijo'));
}

await browser.close();
