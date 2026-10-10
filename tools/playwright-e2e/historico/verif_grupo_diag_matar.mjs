import { chromium } from 'playwright';

const SAVE_ID = 'cmtmlfk420025ri85hnrpxy66';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const combatirBtn = page.getByRole('button', { name: /^⚔️ combatir$/i });
if (await combatirBtn.count()) {
  await combatirBtn.first().click();
  await page.waitForTimeout(1200);
}

const matarButtons = await page.getByRole('button', { name: /matar/i }).all();
console.log('Botones que matchean /matar/i:', matarButtons.length);
for (const b of matarButtons) {
  const text = await b.innerText().catch(() => '?');
  const visible = await b.isVisible().catch(() => false);
  const box = await b.boundingBox().catch(() => null);
  console.log('  texto:', JSON.stringify(text), '| visible:', visible, '| box:', JSON.stringify(box));
}

await browser.close();
