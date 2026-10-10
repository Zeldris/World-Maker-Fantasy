import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const brujula = page.locator('button[title="Moverte por la zona"]');
await brujula.click();
await page.waitForTimeout(1500);

// Click en la fila de texto "PRESENTES AHORA" (lista lateral, no el SVG)
const filaPresente = page.getByText('???', { exact: true }).first();
await filaPresente.click().catch(() => console.log('No se pudo clicar la fila de texto directamente'));
await page.waitForTimeout(1000);

await page.screenshot({ path: 'checklist0922_59_modal_presente.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
