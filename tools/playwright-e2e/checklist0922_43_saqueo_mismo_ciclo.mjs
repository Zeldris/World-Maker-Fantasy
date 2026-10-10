import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Registro el cadáver del Orco enfurecido.');
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
await actuarBtn.click();
console.log('Turno enviado, esperando resolución...');
await page.waitForTimeout(30000);

await page.screenshot({ path: 'checklist0922_43_modal_reabierto.png', fullPage: true });

const saquearBtn = page.getByRole('button', { name: /^saquear$/i });
const visible = await saquearBtn.isVisible().catch(() => false);
console.log('Botón SAQUEAR visible?', visible);

if (visible) {
  await saquearBtn.click();
  console.log('Pulsado SAQUEAR (mismo ciclo de página), esperando...');
  await page.waitForTimeout(15000);
  await page.screenshot({ path: 'checklist0922_43_tras_saquear_real.png', fullPage: true });
}

await browser.close();
