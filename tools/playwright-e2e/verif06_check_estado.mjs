import { chromium } from 'playwright';

const SAVE_ID = 'cmteh1ax3003frietev2anlpo';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

await page.screenshot({ path: 'screenshots/verif06_check_estado.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 4500));

await browser.close();
console.log('OK');
