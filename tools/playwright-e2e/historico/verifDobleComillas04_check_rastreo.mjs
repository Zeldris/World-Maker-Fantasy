import { chromium } from 'playwright';

const SAVE_ID = 'cmteqawx90001rijcmmtqvv7v';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/verifDobleComillas04_check_rastreo.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('URL:', page.url());
console.log('BODY:\n', bodyText.slice(0, 4000));
await browser.close();
console.log('OK');
