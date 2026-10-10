import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto('http://localhost:5173/admin/enciclopedia', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// --- FAUNA ---
await page.getByRole('button', { name: /fauna/i }).click();
await page.waitForTimeout(1000);
let ht = await page.locator('body').innerText();
console.log('--- FAUNA: chips disponibles (primeros 600 chars tras "CATEGORÍA") ---');
const idx = ht.indexOf('CATEGORÍA') !== -1 ? ht.indexOf('CATEGORÍA') : 0;
console.log(ht.slice(idx, idx + 500));

// Buscar el primer chip con conteo y clicarlo
const chipsFauna = await page.locator('button, span').filter({ hasText: /\(\d+\)/ }).all();
console.log(`Chips con conteo encontrados: ${chipsFauna.length}`);
if (chipsFauna.length > 0) {
  const texto = await chipsFauna[0].innerText();
  console.log('Clicando chip:', texto);
  await chipsFauna[0].click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'checklist0922_71_fauna_filtrada.png', fullPage: true });
}

await browser.close();
