import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
await page.getByText('En solitario', { exact: false }).first().click();
await page.waitForTimeout(1500);
await page.getByText('Helek Sirik').first().click();
await page.waitForTimeout(500);
await page.getByText('Continuar', { exact: false }).click();
await page.waitForTimeout(1500);
await page.getByText('Crear desde cero', { exact: false }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/verif_contador_pts.png', fullPage: true });
console.log('OK');
await browser.close();
