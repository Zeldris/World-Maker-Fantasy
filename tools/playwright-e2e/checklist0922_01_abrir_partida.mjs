import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[console.error]', msg.text());
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

await page.screenshot({ path: 'checklist0922_01_inicial.png', fullPage: true });
console.log('URL final:', page.url());
console.log('Título:', await page.title());

const bodyText = await page.locator('body').innerText();
console.log('--- Extracto body (primeros 1500 chars) ---');
console.log(bodyText.slice(0, 1500));

await browser.close();
