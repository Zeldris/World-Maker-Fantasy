import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  let got409 = false;
  page.on('console', (msg) => { if (msg.type() === 'error' && msg.text().includes('409')) got409 = true; });

  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /combatir/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /^salir$/i }).click();
  await page.waitForTimeout(1500);
  console.log('¿Hubo 409?', got409);
  await page.screenshot({ path: 'screenshots/confirmar_cierre_final.png', fullPage: true });
  await browser.close();
})();
