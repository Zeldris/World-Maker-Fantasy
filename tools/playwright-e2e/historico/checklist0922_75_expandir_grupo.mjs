import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const enciclopediaBtn = page.locator('button', { hasText: 'Enciclopedia' }).first();
await enciclopediaBtn.click();
await page.waitForTimeout(1500);

await page.getByText(/ORCOS.*HIJOS DEL ESTALLIDO/i).click();
await page.waitForTimeout(1000);

await page.screenshot({ path: 'checklist0922_75_grupo_expandido.png', fullPage: true });

const ht = await page.locator('body').innerText();
const lockCount = (ht.match(/🔒/g) || []).length;
console.log('Candados 🔒 encontrados:', lockCount);
console.log('Total "(52)" visible?', ht.includes('(52)'));

await browser.close();
