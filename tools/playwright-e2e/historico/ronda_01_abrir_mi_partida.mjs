import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s'; // "TEST Claude - no tocar"

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('response', (res) => {
  if (res.status() >= 400) console.log('[response error]', res.status(), res.url());
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await page.screenshot({ path: 'screenshot-mi-01-estado.png', fullPage: false });
console.log('URL:', page.url());

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
console.log('Composer visible:', await composer.isVisible().catch(() => false));
console.log('Composer aria-disabled:', await composer.getAttribute('aria-disabled').catch(() => 'N/A'));

await browser.close();
