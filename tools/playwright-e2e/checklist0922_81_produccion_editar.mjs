import { chromium } from 'playwright';

const SAVE_ID = 'cmubqa3ev000iri4u4d4lcko6';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const requests = [];
page.on('request', (req) => {
  if (['PATCH', 'PUT', 'POST'].includes(req.method()) && req.url().includes('produccion')) {
    requests.push(`${req.method()} ${req.url()}`);
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const reinoBtn = page.locator('button', { hasText: 'Reino' }).first();
await reinoBtn.click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /producción/i }).click();
await page.waitForTimeout(1000);

await page.screenshot({ path: 'checklist0922_81_produccion_antes.png', fullPage: true });

// Buscar el input de prioridad (número) y cambiar su valor
const inputPrioridad = page.locator('input[type="number"]').first();
const valorAntes = await inputPrioridad.inputValue().catch(() => null);
console.log('Prioridad antes:', valorAntes);

await inputPrioridad.fill('8');
await inputPrioridad.blur();
await page.waitForTimeout(2000);

await page.screenshot({ path: 'checklist0922_81_produccion_despues.png', fullPage: true });
console.log('Peticiones de producción:', requests);

await browser.close();
