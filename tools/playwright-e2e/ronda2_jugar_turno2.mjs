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
  console.log('Turno enviado');

  let resuelto = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(5000);
    const count = await page.locator('[contenteditable="true"]').count();
    if (count === 0) {
      console.log(`t=${(i+1)*5}s: contenteditable NO existe en el DOM ahora mismo`);
      await page.screenshot({ path: `screenshots/ronda2_sin_composer_${i}.png`, fullPage: true });
      continue;
    }
    await page.locator('[contenteditable="true"]').first().click();
    await page.keyboard.type('.');
    const disabledConTexto = await page.getByRole('button', { name: /^actuar$/i }).isDisabled().catch(() => true);
    await page.keyboard.press('Backspace');
    console.log(`t=${(i+1)*5}s: composerExiste=true disabledConTexto=${disabledConTexto}`);
    if (!disabledConTexto) { resuelto = true; break; }
  }
  if (!resuelto) console.log('NO resuelto tras 100s');
  await page.screenshot({ path: 'screenshots/ronda2_turno_resultado2.png', fullPage: true });
  await browser.close();
})();
