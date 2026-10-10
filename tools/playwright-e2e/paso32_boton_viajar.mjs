import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const buttons = await page.getByRole('button').allTextContents();
const viajarBtns = buttons.filter(b => /viajar/i.test(b));
console.log('Botones con "Viajar":', JSON.stringify(viajarBtns));
await browser.close();
