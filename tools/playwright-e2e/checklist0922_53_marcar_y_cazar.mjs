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
await page.waitForTimeout(1500);

const checkbox = page.locator('input[type="checkbox"]').first();
await checkbox.check();
await page.waitForTimeout(500);

const cazarConfirmBtn = page.getByRole('button', { name: /^cazar$/i });
await cazarConfirmBtn.click();
console.log('Caza confirmada, esperando resolución...');
await page.waitForTimeout(40000);

await page.screenshot({ path: 'checklist0922_53_resultado.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
