import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /cancelar/i }).click().catch(() => console.log('no había Cancelar'));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/ronda3_tras_cerrar.png', fullPage: true });
  await browser.close();
})();
