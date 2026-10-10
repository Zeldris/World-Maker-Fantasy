import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Helek Sirik/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/audit_02_after_continuar.png', fullPage: true });
console.log('URL:', page.url());
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones:', JSON.stringify(buttons));
