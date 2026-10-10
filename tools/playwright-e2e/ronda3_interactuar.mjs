import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^interactuar$/i }).click();
  console.log('Interactuar pulsado, esperando 60s...');
  await page.waitForTimeout(60000);
  await page.screenshot({ path: 'screenshots/ronda3_interactuar.png', fullPage: true });
  await browser.close();
})();
