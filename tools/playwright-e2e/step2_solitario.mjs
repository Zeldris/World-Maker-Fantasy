import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto('http://localhost:5173');
await page.waitForTimeout(1000);
await page.getByText('En solitario', { exact: false }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/step2_solitario.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('BODY TEXT:\n', bodyText.slice(0, 3000));
console.log('URL:', page.url());
await browser.close();
console.log('OK');
