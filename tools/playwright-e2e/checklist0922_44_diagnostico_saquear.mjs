import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const requests = [];
page.on('request', (req) => {
  if (req.method() !== 'GET') requests.push(`${req.method()} ${req.url()}`);
});
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[console.error]', msg.text());
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Reviso el cadáver del Orco enfurecido en busca de objetos.');
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
await actuarBtn.click();
console.log('Turno enviado...');
await page.waitForTimeout(30000);

const saquearBtn = page.getByRole('button', { name: /^saquear$/i });
const visible = await saquearBtn.isVisible().catch(() => false);
console.log('Botón SAQUEAR visible?', visible);

if (visible) {
  console.log('--- Peticiones ANTES del click ---');
  requests.forEach(r => console.log(r));
  requests.length = 0;

  await saquearBtn.click();
  await page.waitForTimeout(5000);

  console.log('--- Peticiones DESPUÉS del click ---');
  requests.forEach(r => console.log(r));
  if (requests.length === 0) console.log('(ninguna petición POST/PATCH/DELETE disparada)');
}

await page.screenshot({ path: 'checklist0922_44_diagnostico.png', fullPage: true });
await browser.close();
