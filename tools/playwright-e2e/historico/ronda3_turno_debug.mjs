import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
const ACCION = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });

  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const editable = page.locator('[contenteditable="true"]').first();
  await editable.click();
  await page.keyboard.type(ACCION);
  await page.waitForTimeout(300);

  const btnCount = await page.getByRole('button', { name: /^actuar$/i }).count();
  console.log('Cantidad de botones Actuar:', btnCount);
  const disabled = await page.getByRole('button', { name: /^actuar$/i }).first().isDisabled();
  console.log('Disabled:', disabled);

  try {
    await page.getByRole('button', { name: /^actuar$/i }).first().click({ timeout: 5000 });
    console.log('Click OK');
  } catch (e) {
    console.log('Click FALLÓ:', e.message);
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/ronda3_debug.png', fullPage: true });
  await browser.close();
})();
