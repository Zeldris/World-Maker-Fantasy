import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.isVisible().catch(() => false)) {
  await combatirBtn.click();
  await page.waitForTimeout(2000);
}

const actuarButtons = page.getByRole('button', { name: /^actuar$/i });
const count = await actuarButtons.count();
console.log('Cantidad de botones "Actuar":', count);
for (let i = 0; i < count; i++) {
  const btn = actuarButtons.nth(i);
  console.log(`  [${i}] disabled=${await btn.isDisabled()} texto="${await btn.textContent()}"`);
}

// Click en Tajo Horizontal, ver si algo cambia visualmente (selección resaltada).
const tajoBtn = page.getByText('Tajo Horizontal', { exact: true });
console.log('Tajo Horizontal visible:', await tajoBtn.isVisible().catch(() => false));
await tajoBtn.click();
await page.waitForTimeout(500);

for (let i = 0; i < count; i++) {
  const btn = actuarButtons.nth(i);
  console.log(`  tras click [${i}] disabled=${await btn.isDisabled()}`);
}

await page.screenshot({ path: 'screenshot-mi-11-diagnostico.png', fullPage: false });
await browser.close();
