import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
const ACCION = process.argv[2];
if (!ACCION) { console.error('Falta la acción'); process.exit(1); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const editable = page.locator('[contenteditable="true"]').first();
  await editable.click();
  await page.keyboard.type(ACCION);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^actuar$/i }).click();
  console.log('Turno enviado, esperando 75s SIN tocar nada más...');
  await page.waitForTimeout(75000);

  await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('*')).filter(el => {
      const s = getComputedStyle(el);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    });
    for (const p of panels) p.scrollTop = p.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/ronda2_turno_limpio.png', fullPage: true });
  await browser.close();
})();
