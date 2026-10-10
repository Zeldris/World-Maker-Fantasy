import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const habilidadesBtn = page.locator('button', { hasText: 'Habilidades' }).first();
await habilidadesBtn.click();
await page.waitForTimeout(1000);

const cazarBtn = page.getByRole('button', { name: /cazar/i });
await cazarBtn.click();
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_47_modal_cazar.png', fullPage: true });

const ht = await page.locator('body').innerText();
console.log(ht.slice(-2000));

await browser.close();
