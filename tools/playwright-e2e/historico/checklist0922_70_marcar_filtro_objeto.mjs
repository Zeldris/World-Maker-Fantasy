import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto('http://localhost:5173/admin/enciclopedia', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /objetos/i }).click();
await page.waitForTimeout(1000);

// Expandir sección EQUIPABLES antes de contar
const equipablesToggle = page.getByText(/^EQUIPABLES/i);
await equipablesToggle.click().catch(() => {});
await page.waitForTimeout(500);

const htAntes = await page.locator('body').innerText();
console.log('--- Antes de marcar filtro ---');
console.log(htAntes.slice(htAntes.indexOf('EQUIPABLES'), htAntes.indexOf('EQUIPABLES') + 500));

// Marcar el chip "Armas (16)"
await page.getByText('Armas (16)', { exact: true }).click();
await page.waitForTimeout(1000);

await page.screenshot({ path: 'checklist0922_70_filtro_armas.png', fullPage: true });
const htDespues = await page.locator('body').innerText();
console.log('--- Después de marcar Armas ---');
console.log(htDespues.slice(htDespues.indexOf('EQUIPABLES'), htDespues.indexOf('EQUIPABLES') + 500));

await browser.close();
