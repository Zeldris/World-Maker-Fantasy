import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

console.log('=== Recargando la página (F5 real) ===');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

await page.getByRole('button', { name: /combatir/i }).click().catch(() => console.log('No se encontró botón Combatir tras recargar'));
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_14_tras_reload.png', fullPage: true });
const ht = await page.locator('body').innerText();
console.log('--- Contiene tarjeta MATAR/CLEMENTE tras F5? ---');
console.log('MATAR presente:', /MATAR/.test(ht));
console.log('CLEMENTE presente:', /CLEMENTE/.test(ht));
console.log('CONVALECIENTE mencionado:', /CONVALECIENTE/i.test(ht));
console.log('--- Extracto final ---');
console.log(ht.slice(-1500));

await browser.close();
