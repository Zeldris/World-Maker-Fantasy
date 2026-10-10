import { chromium } from 'playwright';
import { SAVE_ID } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const inputCombate = page.getByPlaceholder('O describe tu acción...');
console.log('Input de combate visible:', await inputCombate.isVisible().catch(() => false));

const botones = await page.locator('button').allTextContents();
console.log('Botones:', JSON.stringify(botones.filter(Boolean).slice(0, 40)));

await page.screenshot({ path: 'screenshots/recorrido_18_full.png', fullPage: true });
await browser.close();
