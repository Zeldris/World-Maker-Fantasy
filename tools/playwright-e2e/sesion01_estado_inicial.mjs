import { chromium } from 'playwright';

const SAVE_ID = 'cmteuqm0k0001ri7jqoo86e7q';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
console.log('URL:', page.url());
await page.screenshot({ path: 'screenshots/sesion01_estado_inicial.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('BODY TEXT:\n', bodyText.slice(0, 2500));
await browser.close();
console.log('OK');
