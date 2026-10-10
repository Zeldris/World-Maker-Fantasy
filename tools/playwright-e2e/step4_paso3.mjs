import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto('http://localhost:5173/solitario/mundo/helek-sirik');
await page.waitForTimeout(1000);
// Preseleccionado "Gorhorn" ya debería estar seleccionado por defecto o hace falta click
const gorhornCard = page.getByText('Gorhorn', { exact: true }).first();
await gorhornCard.click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /continuar/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/step4_paso3.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('BODY TEXT:\n', bodyText.slice(0, 4000));
console.log('URL:', page.url());
await browser.close();
console.log('OK');
