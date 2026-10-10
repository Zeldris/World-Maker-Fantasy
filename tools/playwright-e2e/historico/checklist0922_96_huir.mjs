import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /combatir/i }).click().catch(() => {});
await page.waitForTimeout(1500);

const huirBtn = page.getByRole('button', { name: /^huir$/i });
await huirBtn.click();
console.log('Pulsado HUIR, esperando resolución...');
await page.waitForTimeout(30000);

await page.screenshot({ path: 'checklist0922_96_tras_huir.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
