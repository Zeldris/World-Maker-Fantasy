import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('response', (res) => {
  if (res.status() >= 400 && !res.url().includes('/resume')) console.log('[response error]', res.status(), res.url());
});

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

const checkbox = page.getByRole('dialog').getByRole('checkbox').first();
console.log('Checkbox count:', await page.getByRole('dialog').getByRole('checkbox').count());
await checkbox.click();
await page.waitForTimeout(500);
const cazarConfirmar = page.getByRole('button', { name: /^cazar$/i });
console.log('Botón CAZAR (confirmar) enabled:', !(await cazarConfirmar.isDisabled()));
await cazarConfirmar.click();

console.log('Esperando resolución de la caza...');
await page.waitForTimeout(30000);

await page.screenshot({ path: 'screenshot-mi-05-tras-cazar.png', fullPage: false });

await browser.close();
