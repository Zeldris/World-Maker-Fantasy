import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Abrir panel de combate
const combatirBtn = page.getByRole('button', { name: /combatir/i }).first();
await combatirBtn.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'checklist0922_03_panel_combate.png', fullPage: true });

const bodyBefore = await page.locator('body').innerText();
console.log('--- Panel de combate (extracto) ---');
console.log(bodyBefore.slice(0, 2500));

await browser.close();
