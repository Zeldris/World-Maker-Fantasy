import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5173');
await page.waitForTimeout(1000);
console.log('title:', await page.title());
await page.screenshot({ path: 'screenshots/smoke.png' });
await browser.close();
console.log('OK');
