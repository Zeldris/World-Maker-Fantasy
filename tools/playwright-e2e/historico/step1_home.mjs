import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', msg => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto('http://localhost:5173');
await page.waitForTimeout(1500);
console.log('title:', await page.title());
await page.screenshot({ path: 'screenshots/step1_home.png', fullPage: true });
console.log('URL:', page.url());
const bodyText = await page.locator('body').innerText();
console.log('BODY TEXT (first 2000 chars):\n', bodyText.slice(0, 2000));
await browser.close();
console.log('OK');
