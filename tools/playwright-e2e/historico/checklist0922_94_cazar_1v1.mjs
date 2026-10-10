import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

async function leerEstado() {
  const res = await fetch(`http://localhost:3001/saves/${SAVE_ID}`);
  return res.json();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const habilidadesBtn = page.locator('button', { hasText: 'Habilidades' }).first();
await habilidadesBtn.click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /cazar/i }).click();
await page.waitForTimeout(1000);

let ht = await page.locator('body').innerText();
for (let i = 0; i < 10 && !/elige una o varias presas/i.test(ht); i++) {
  await page.getByRole('button', { name: /explorar/i }).click();
  await page.waitForTimeout(3000);
  ht = await page.locator('body').innerText();
}
console.log(ht.slice(ht.lastIndexOf('Cazar'), ht.lastIndexOf('Cazar') + 300));

// Buscar todos los inputs numéricos (cantidad por especie) y ponerlos a 1
const numberInputs = await page.locator('input[type="number"]').all();
console.log(`Inputs numéricos encontrados: ${numberInputs.length}`);
for (const inp of numberInputs) {
  const val = await inp.inputValue().catch(() => null);
  console.log('  valor actual:', val);
  await inp.fill('1').catch(() => {});
}

const checkbox = page.locator('input[type="checkbox"]').first();
await checkbox.check();
await page.waitForTimeout(500);
await page.screenshot({ path: 'checklist0922_94_antes_confirmar.png', fullPage: true });

await page.getByRole('button', { name: /^cazar$/i }).click();
console.log('Caza confirmada, esperando resolución...');
await page.waitForTimeout(30000);

const estado = await leerEstado();
console.log('combateIniciado:', JSON.stringify(estado.combateIniciado));
await page.screenshot({ path: 'checklist0922_94_resultado.png', fullPage: true });

await browser.close();
