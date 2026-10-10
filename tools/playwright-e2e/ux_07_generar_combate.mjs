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

const dialogText = await page.getByRole('dialog').textContent().catch(() => '(sin dialog)');
console.log('Lista:', dialogText);

const checkboxes = page.getByRole('dialog').getByRole('checkbox');
const count = await checkboxes.count();
if (count > 0) {
  await checkboxes.first().click();
  await page.waitForTimeout(500);
  const cazarConfirmar = page.getByRole('button', { name: /^cazar$/i });
  await cazarConfirmar.click();
  console.log('Cazando, esperando resolución...');
  await page.waitForTimeout(30000);
}

await page.screenshot({ path: 'screenshot-ux-combate-generado.png', fullPage: false });

await browser.close();
