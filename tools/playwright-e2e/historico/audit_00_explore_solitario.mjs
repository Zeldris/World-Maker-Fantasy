import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/audit_00_solitario.png', fullPage: true });

console.log('URL:', page.url());
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones visibles:', JSON.stringify(buttons));

await browser.close();
