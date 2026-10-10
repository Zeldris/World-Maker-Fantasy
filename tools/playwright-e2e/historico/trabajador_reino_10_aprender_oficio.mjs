import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);

// Cerrar cualquier modal abierto de estado previo
const cerrar = page.getByRole('button', { name: /cerrar/i });
if (await cerrar.count() > 0) await cerrar.first().click().catch(() => {});
await page.waitForTimeout(500);

// Abrir barra de habilidades generales
await page.getByRole('button', { name: /habilidades/i }).first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/tr10_habilidades.png', fullPage: true });
const text = await page.locator('body').innerText();
console.log('contiene "Aprender oficio":', text.includes('Aprender oficio'));
await browser.close();
