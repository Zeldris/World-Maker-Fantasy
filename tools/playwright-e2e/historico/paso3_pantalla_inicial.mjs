import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/paso3_pantalla_inicial.png', fullPage: true });
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones pantalla inicial:', JSON.stringify(buttons));
await browser.close();
