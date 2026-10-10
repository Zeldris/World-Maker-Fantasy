import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
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
await page.screenshot({ path: 'screenshots/tr20_p1_expandido.png', fullPage: true });
const link = page.getByText('Karot Veku - Campamento del Clan Serhu', { exact: true });
if (await link.count() > 0) {
  await link.first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/tr20_p1_ficha.png', fullPage: true });
}
await browser.close();
