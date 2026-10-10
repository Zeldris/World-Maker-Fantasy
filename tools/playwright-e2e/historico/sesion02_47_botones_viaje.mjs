import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

await page.getByText('Mapa', { exact: true }).first().click();
await page.waitForTimeout(2000);
const tabs = page.locator('button', { hasText: /^Mapa$/ });
await tabs.last().click();
await page.waitForTimeout(2000);

// Inspeccionar el HTML alrededor de "Paso de los Pilares Rotos" para ver si es un botón real o solo texto.
const html = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => e.textContent.trim() === 'Paso de los Pilares Rotos' && e.children.length === 0);
  if (!el) return 'NO ENCONTRADO';
  let node = el;
  for (let i = 0; i < 4 && node.parentElement; i++) node = node.parentElement;
  return node.outerHTML.slice(0, 1500);
});
console.log('--- HTML ALREDEDOR DEL DESTINO ---');
console.log(html);

await browser.close();
console.log('OK');
