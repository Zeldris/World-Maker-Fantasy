import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
await page.getByText('Enciclopedia', { exact: true }).click();
await page.waitForTimeout(1000);
await page.getByText('Lugares', { exact: true }).click();
await page.waitForTimeout(1000);
await page.getByText(/LAS LLANURAS DEL VIENTO ROJO/i).click();
await page.waitForTimeout(1000);
await page.getByPlaceholder('Buscar por nombre...').fill('Karot');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/tr19_expandido.png', fullPage: true });
const karotLink = page.getByText('Karot Veku - Campamento del Clan Serhu', { exact: true });
console.log('encontrado:', await karotLink.count());
if (await karotLink.count() > 0) {
  await karotLink.first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/tr19_ficha.png', fullPage: true });
}
await browser.close();
