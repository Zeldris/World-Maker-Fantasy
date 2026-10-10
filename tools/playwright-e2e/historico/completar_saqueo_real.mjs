import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /combatir/i }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/completar_01_panel.png', fullPage: true });

  const saquearBtn = page.getByRole('button', { name: /saquear todo/i });
  const visible = await saquearBtn.isVisible().catch(() => false);
  console.log('Saquear todo visible:', visible);
  if (visible) {
    await saquearBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/completar_02_modal.png', fullPage: true });
    const confirmarBtn = page.getByRole('button', { name: /^saquear$/i });
    if (await confirmarBtn.isVisible().catch(() => false)) {
      await confirmarBtn.click();
      console.log('Saqueo confirmado, esperando 40s...');
      await page.waitForTimeout(40000);
    }
  }
  await page.screenshot({ path: 'screenshots/completar_03_final.png', fullPage: true });
  await browser.close();
})();
