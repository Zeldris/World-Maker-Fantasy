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

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
for (let i = 0; i < 6; i++) {
  const bt = await page.textContent('body');
  if (bt.includes('MUERTO') || bt.includes('VICTORIA') || bt.includes('SALIR')) {
    console.log(`Iteración ${i}: parece terminado`);
    break;
  }
  await page.getByText('Tajo Horizontal', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);
  if (await actuarBtn.isDisabled().catch(() => true)) {
    console.log(`Iteración ${i}: Actuar disabled, esperando`);
    await page.waitForTimeout(4000);
    continue;
  }
  await actuarBtn.click();
  console.log(`Iteración ${i}: atacado`);
  await page.waitForTimeout(20000);
}

const salirBtn = page.getByRole('button', { name: /^salir$/i });
if (await salirBtn.isVisible().catch(() => false)) {
  await salirBtn.click();
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: 'screenshot-ux-definitivo.png', fullPage: false });

await browser.close();
