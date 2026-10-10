import { chromium } from 'playwright';
const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/check_ahora3.png' });
console.log('Captura guardada.');
await browser.close();
