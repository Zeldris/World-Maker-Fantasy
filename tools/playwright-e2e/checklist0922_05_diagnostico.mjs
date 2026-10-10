import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.screenshot({ path: 'checklist0922_05_estado.png', fullPage: true });

// Listar todos los inputs y textboxes visibles
const inputs = await page.locator('input').all();
console.log(`Inputs encontrados: ${inputs.length}`);
for (const inp of inputs) {
  const ph = await inp.getAttribute('placeholder').catch(() => null);
  const visible = await inp.isVisible().catch(() => false);
  console.log(' - placeholder:', ph, 'visible:', visible);
}

const textboxes = await page.getByRole('textbox').all();
console.log(`Textboxes (role) encontrados: ${textboxes.length}`);
for (const tb of textboxes) {
  const label = await tb.getAttribute('aria-label').catch(() => null);
  const visible = await tb.isVisible().catch(() => false);
  console.log(' - aria-label:', label, 'visible:', visible);
}

const buttons = await page.getByRole('button').all();
console.log(`Botones encontrados: ${buttons.length}`);
for (const b of buttons) {
  const name = await b.innerText().catch(() => '');
  const visible = await b.isVisible().catch(() => false);
  if (visible && name.trim()) console.log(' - botón:', JSON.stringify(name.trim()));
}

await browser.close();
