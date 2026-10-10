import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(30000);
await page.screenshot({ path: 'screenshots/tr04_tras_esperar.png', fullPage: true });
const text = await page.locator('body').innerText();
console.log('body (ultimos 1200):', text.slice(-1200));
await browser.close();
