import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await page.getByRole('button', { name: /reino/i }).first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshot-mi-18-reino.png', fullPage: false });

const bodyText = await page.textContent('body');
console.log('Panel Reino, longitud:', bodyText.length);

await browser.close();
