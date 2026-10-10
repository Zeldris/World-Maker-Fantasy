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
await page.screenshot({ path: 'screenshots/tr17_lugares.png', fullPage: true });
const link = page.getByText(/Karot Veku - Campamento/i);
if (await link.count() > 0) {
  await link.first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/tr17_karot_veku_ficha.png', fullPage: true });
}
await browser.close();
