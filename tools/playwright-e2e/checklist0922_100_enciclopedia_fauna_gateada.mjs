import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const enciclopediaBtn = page.locator('button', { hasText: 'Enciclopedia' }).first();
await enciclopediaBtn.click();
await page.waitForTimeout(1500);

await page.getByRole('button', { name: /fauna/i }).click();
await page.waitForTimeout(1000);

await page.screenshot({ path: 'checklist0922_100_fauna_partida.png', fullPage: true });

// Expandir el primer grupo con contenido
const grupos = await page.locator('button, [role="button"]').filter({ hasText: /\(\d+\)/ }).all();
console.log(`Grupos/chips con conteo: ${grupos.length}`);

const ht = await page.locator('body').innerText();
const lockCount = (ht.match(/🔒/g) || []).length;
console.log('Candados visibles sin expandir nada:', lockCount);

await browser.close();
