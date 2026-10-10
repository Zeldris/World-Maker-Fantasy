import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.isVisible().catch(() => false)) {
  await combatirBtn.click();
  await page.waitForTimeout(1500);
}

for (let i = 0; i < 6; i++) {
  const bt = await page.textContent('body');
  if (bt.includes('MUERTO') || bt.includes('VICTORIA') || bt.includes('SALIR')) {
    console.log(`Iteración ${i}: parece terminado`);
    break;
  }
  await page.getByText('Tajo Horizontal', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);

  // El botón principal puede llamarse "Actuar" o "Defenderte" según quién gane la iniciativa.
  const confirmBtn = page.getByRole('button', { name: /^(actuar|defenderte)$/i }).first();
  if (await confirmBtn.isDisabled().catch(() => true)) {
    console.log(`Iteración ${i}: botón de confirmación disabled, esperando`);
    await page.waitForTimeout(4000);
    continue;
  }
  const label = await confirmBtn.textContent();
  await confirmBtn.click();
  console.log(`Iteración ${i}: pulsado "${label}"`);
  await page.waitForTimeout(20000);
}

const salirBtn = page.getByRole('button', { name: /^salir$/i });
if (await salirBtn.isVisible().catch(() => false)) {
  await salirBtn.click();
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: 'screenshot-ux-flexible-final.png', fullPage: false });

await browser.close();
