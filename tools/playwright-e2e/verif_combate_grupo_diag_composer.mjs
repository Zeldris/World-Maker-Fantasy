import { chromium } from 'playwright';

const SAVE_ID = 'cmtmlfk420025ri85hnrpxy66';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(30000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const combatirBtn = page.getByRole('button', { name: /Combatir/i });
if (await combatirBtn.count()) {
  await combatirBtn.first().click();
  await page.waitForTimeout(1200);
}

const textboxes = await page.getByRole('textbox').all();
console.log('Número de textbox encontrados:', textboxes.length);
for (const tb of textboxes) {
  const name = await tb.getAttribute('aria-label').catch(() => null);
  const placeholder = await tb.getAttribute('data-placeholder').catch(() => null);
  console.log('  textbox aria-label:', name, '| data-placeholder:', placeholder);
}

await browser.close();
