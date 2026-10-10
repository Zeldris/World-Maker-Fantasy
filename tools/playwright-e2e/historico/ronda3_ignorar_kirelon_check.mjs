import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const ignorarVisible = await page.getByRole('button', { name: /^ignorar$/i }).isVisible().catch(() => false);
  console.log('Botón Ignorar visible:', ignorarVisible);
  if (ignorarVisible) {
    await page.getByRole('button', { name: /^ignorar$/i }).click();
    await page.waitForTimeout(1000);
    console.log('Ignorado');
  }
  await page.screenshot({ path: 'screenshots/ronda3_ignorar.png', fullPage: true });
  await browser.close();
})();
