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

const matarBtn = page.getByRole('button', { name: /^matar$/i });
console.log('Matar visible:', await matarBtn.isVisible().catch(() => false));
await page.screenshot({ path: 'screenshot-ux-antes-matar.png', fullPage: false });

if (await matarBtn.isVisible().catch(() => false)) {
  await matarBtn.click();
  await page.waitForTimeout(3000);
}

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
for (let i = 0; i < 4; i++) {
  const bt = await page.textContent('body');
  if (bt.includes('MUERTO') || bt.includes('VICTORIA')) {
    console.log('Ya terminó');
    break;
  }
  await page.getByText('Tajo Horizontal', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);
  if (await actuarBtn.isDisabled().catch(() => true)) {
    await page.waitForTimeout(4000);
    continue;
  }
  await actuarBtn.click();
  await page.waitForTimeout(20000);
}

await page.screenshot({ path: 'screenshot-ux-final-remate.png', fullPage: false });

await browser.close();
