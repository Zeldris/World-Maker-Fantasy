import { chromium } from 'playwright';

const SAVE_ID = 'cmtegz0b4001qrieti2l0z1iu';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 4500));
await page.screenshot({ path: 'screenshots/verifKirelon06_check_ataque.png', fullPage: true });
await browser.close();
console.log('OK');
