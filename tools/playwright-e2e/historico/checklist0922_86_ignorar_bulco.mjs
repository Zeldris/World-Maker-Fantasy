import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const ignorar = page.getByRole('button', { name: /^ignorarlo$/i });
await ignorar.waitFor({ state: 'visible', timeout: 10000 });
await ignorar.click();
console.log('Ignorado, esperando resolución...');
await page.waitForTimeout(30000);

const salir = page.getByRole('button', { name: /^salir$/i });
if (await salir.isVisible().catch(() => false)) {
  await salir.click();
  console.log('Salido del diálogo con Salir.');
  await page.waitForTimeout(1000);
}

await page.screenshot({ path: 'checklist0922_86_estado_final.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
