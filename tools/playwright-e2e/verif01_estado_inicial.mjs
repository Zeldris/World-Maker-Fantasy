import { chromium } from 'playwright';

const SAVE_ID = 'cmteh1ax3003frietev2anlpo';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

await page.screenshot({ path: 'screenshots/verif01_estado_inicial.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('=== estado inicial ===');
console.log(bodyText.slice(0, 3000));

const editables = await page.locator('[contenteditable="true"]').all();
console.log('\ncontenteditable count:', editables.length);
for (const e of editables) {
  console.log(' aria-label=', await e.getAttribute('aria-label'), 'data-placeholder=', await e.getAttribute('data-placeholder'));
}

await browser.close();
console.log('OK');
