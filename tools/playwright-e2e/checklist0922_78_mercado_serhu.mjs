import { chromium } from 'playwright';

const SAVE_ID = 'cmubqa3ev000iri4u4d4lcko6';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const reinoBtn = page.locator('button', { hasText: 'Reino' }).first();
await reinoBtn.click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /diplomacia/i }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /Clan Serhu.*Liderada/ }).click();
await page.waitForTimeout(1000);

await page.screenshot({ path: 'checklist0922_78_serhu_diplomacia.png', fullPage: true });
const ht = await page.locator('body').innerText();
console.log(ht.slice(ht.indexOf('DIPLOMACIA'), ht.indexOf('DIPLOMACIA') + 1000));

await browser.close();
