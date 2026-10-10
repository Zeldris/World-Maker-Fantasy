import { chromium } from 'playwright';

const SAVE_ID = 'cmubqa3ev000iri4u4d4lcko6';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const reinoBtn = page.locator('button', { hasText: 'Reino' }).first();
await reinoBtn.click();
await page.waitForTimeout(1500);

const tabs = ['Visión general', 'Edificios', 'Producción', 'Súbditos', 'Diplomacia'];
for (const tab of tabs) {
  await page.getByRole('button', { name: tab }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `checklist0922_61_tab_${tab.replace(/[^a-zA-Z]/g, '')}.png`, fullPage: true });
  console.log(`--- ${tab} capturado ---`);
}

console.log('Errores de consola/página detectados:', errors.length);
errors.forEach(e => console.log(' -', e));

await browser.close();
