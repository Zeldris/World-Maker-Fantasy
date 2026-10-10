import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /helek sirik/i }).click().catch(async () => {
  await page.locator('text=Helek Sirik').click();
});
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/fix03_02_personaje.png', fullPage: true });

await browser.close();
