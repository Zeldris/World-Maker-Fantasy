import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/paso4_partida_test.png', fullPage: true });
console.log('URL:', page.url());
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones:', JSON.stringify(buttons.slice(0, 20)));
await browser.close();
