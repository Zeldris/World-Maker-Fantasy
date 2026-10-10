import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await page.getByRole('button', { name: /habilidades/i }).first().click();
await page.waitForTimeout(1000);
await page.getByText('Cazar', { exact: true }).click();
await page.waitForTimeout(1500);

const explorarBtn = page.getByRole('button', { name: /explorar/i });
if (await explorarBtn.isVisible().catch(() => false)) {
  await explorarBtn.click();
  await page.waitForTimeout(2000);
}

const checkboxes = page.getByRole('dialog').getByRole('checkbox');
const count = await checkboxes.count();
console.log('Checkboxes:', count);
if (count > 0) {
  await checkboxes.first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^cazar$/i }).click();
  console.log('Cazando...');
  await page.waitForTimeout(30000);
}

await page.screenshot({ path: 'screenshot-ux-combate-paso1.png', fullPage: false });

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.isVisible().catch(() => false)) {
  await combatirBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshot-ux-combate-panel-abierto.png', fullPage: false });
}

await browser.close();
