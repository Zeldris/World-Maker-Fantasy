import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto('http://localhost:5173/admin/enciclopedia', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: /flora/i }).click();
await page.waitForTimeout(1000);

let ht = await page.locator('body').innerText();
console.log('--- FLORA: chips disponibles ---');
console.log(ht.slice(0, 500));

const chips = await page.locator('button').filter({ hasText: /\(\d+\)/ }).all();
console.log(`Chips encontrados: ${chips.length}`);
if (chips.length > 0) {
  const texto = await chips[0].innerText();
  console.log('Clicando chip:', texto);
  await chips[0].click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'checklist0922_73_flora_filtrada.png', fullPage: true });
}

await browser.close();
