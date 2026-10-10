import { chromium } from 'playwright';

const SAVE_ID = 'cmteh1ax3003frietev2anlpo';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

await page.screenshot({ path: 'screenshots/verif03_esperar_resultado.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('=== estado tras esperar ===');
console.log(bodyText.slice(0, 4000));

await browser.close();
console.log('OK');
