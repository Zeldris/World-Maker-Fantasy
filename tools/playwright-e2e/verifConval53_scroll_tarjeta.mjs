import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

// Scroll al final del panel de "Tu personaje"
const logPanel = page.locator('text=Ver historial completo en el Diario').locator('..').locator('..');
await page.evaluate(() => {
  const panels = document.querySelectorAll('div');
  for (const p of panels) {
    if (p.scrollHeight > p.clientHeight && p.scrollHeight > 500) {
      p.scrollTop = p.scrollHeight;
    }
  }
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/verifConval53_scroll_tarjeta.png', fullPage: true });
await browser.close();
console.log('OK');
