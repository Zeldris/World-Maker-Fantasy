import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
await page.getByRole('button', { name: /inventario/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/tr02_inventario.png', fullPage: true });
const text = await page.locator('body').innerText();
console.log('contiene emoji goirno (🪙):', text.includes('🪙'));
const idx = text.indexOf('🪙');
console.log('contexto:', text.slice(Math.max(0, idx - 50), idx + 50));
await browser.close();
