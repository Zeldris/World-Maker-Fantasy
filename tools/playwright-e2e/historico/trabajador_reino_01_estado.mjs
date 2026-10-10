import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/tr01_estado_inicial.png', fullPage: true });
console.log('title:', await page.title());
console.log('body text (primeros 500):', (await page.locator('body').innerText()).slice(0, 500));
await browser.close();
