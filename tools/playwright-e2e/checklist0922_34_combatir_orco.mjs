import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const combatirBtn = page.getByRole('button', { name: /^combatir$/i });
await combatirBtn.waitFor({ state: 'visible', timeout: 10000 });
await combatirBtn.click();
console.log('Elegido "Combatir", esperando apertura del combate...');

await page.waitForTimeout(30000);

await page.screenshot({ path: 'checklist0922_34_tras_combatir.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
