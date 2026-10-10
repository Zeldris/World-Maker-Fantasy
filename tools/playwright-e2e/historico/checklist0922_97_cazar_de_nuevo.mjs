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

const checkbox = page.locator('input[type="checkbox"]').first();
await checkbox.check();
await page.getByRole('button', { name: /^cazar$/i }).click();
console.log('Caza confirmada, esperando...');
await page.waitForTimeout(30000);

const estado = await leerEstado();
console.log('Gorhorn:', estado.condicionFisica, 'combate:', JSON.stringify(estado.combateIniciado));
await page.screenshot({ path: 'checklist0922_97_resultado.png', fullPage: true });

await browser.close();
