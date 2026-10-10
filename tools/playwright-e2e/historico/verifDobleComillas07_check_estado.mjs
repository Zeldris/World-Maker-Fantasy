import { chromium } from 'playwright';

const SAVE_ID = 'cmteqawx90001rijcmmtqvv7v';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/verifDobleComillas07_check_estado.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('BODY:\n', bodyText.slice(0, 5000));
await browser.close();
console.log('OK');
