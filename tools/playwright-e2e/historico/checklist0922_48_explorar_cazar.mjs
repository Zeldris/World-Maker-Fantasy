import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const habilidadesBtn = page.locator('button', { hasText: 'Habilidades' }).first();
await habilidadesBtn.click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /cazar/i }).click();
await page.waitForTimeout(1000);

const explorarBtn = page.getByRole('button', { name: /explorar/i });
await explorarBtn.click();
console.log('Pulsado Explorar, esperando resultado...');
await page.waitForTimeout(8000);

await page.screenshot({ path: 'checklist0922_48_resultado_explorar.png', fullPage: true });
const ht = await page.locator('body').innerText();
console.log(ht.slice(-2000));

await browser.close();
