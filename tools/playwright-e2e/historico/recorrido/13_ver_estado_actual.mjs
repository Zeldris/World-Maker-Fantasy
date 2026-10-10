import { chromium } from 'playwright';
import { SAVE_ID, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await verEstado(page, 'recorrido_13a.png');

const overlay = page.locator('.fixed.inset-0.z-50').first();
console.log('Overlay visible:', await overlay.isVisible().catch(() => false));
const botones = await page.locator('button').allTextContents();
console.log('Botones:', JSON.stringify(botones.filter(Boolean)));

await browser.close();
