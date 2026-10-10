import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const brujula = page.locator('button[title="Moverte por la zona"]');
await brujula.waitFor({ state: 'visible', timeout: 10000 });
await brujula.click();
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_58_mapa_tras_respawn.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
