import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto('http://localhost:5173/solitario');
await page.waitForTimeout(1000);
await page.getByText('Helek Sirik', { exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /continuar/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/step3_paso2.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('BODY TEXT:\n', bodyText.slice(0, 4000));
console.log('URL:', page.url());
await browser.close();
console.log('OK');
