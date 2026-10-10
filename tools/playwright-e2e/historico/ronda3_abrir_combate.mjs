import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const combatirVisible = await page.getByRole('button', { name: /combatir/i }).isVisible().catch(() => false);
  console.log('Botón Combatir visible:', combatirVisible);
  if (combatirVisible) {
    await page.getByRole('button', { name: /combatir/i }).click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: 'screenshots/ronda3_panel_combate.png', fullPage: true });
  await browser.close();
})();
