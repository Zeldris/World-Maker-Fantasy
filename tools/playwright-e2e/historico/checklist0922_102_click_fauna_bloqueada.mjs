import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const enciclopediaBtn = page.locator('button', { hasText: 'Enciclopedia' }).first();
await enciclopediaBtn.click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /fauna/i }).click();
await page.waitForTimeout(1000);
await page.getByText(/LLANURAS DEL VIENTO ROJO/i).click();
await page.waitForTimeout(1000);

// Clicar el primer elemento bloqueado con candado
const primerBloqueado = page.locator('button', { hasText: '🔒' }).first();
const visible = await primerBloqueado.isVisible().catch(() => false);
console.log('Primer bloqueado visible?', visible);
if (visible) {
  await primerBloqueado.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'checklist0922_102_detalle_bloqueado.png', fullPage: true });
}

await browser.close();
