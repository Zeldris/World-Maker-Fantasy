import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

// Buscar por atributo placeholder directamente
const withPlaceholder = page.locator('[placeholder]');
const n = await withPlaceholder.count();
console.log('elementos con placeholder:', n);
for (let i = 0; i < n; i++) {
  const el = withPlaceholder.nth(i);
  console.log(i, await el.evaluate(e => e.tagName), 'placeholder=', await el.getAttribute('placeholder'));
}

await browser.close();
