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

for (let i = 1; i <= 4; i++) {
  const matarButtons = await page.getByRole('button', { name: /^matar$/i }).all();
  console.log(`Ronda ${i}: botones Matar visibles = ${matarButtons.length}`);
  if (matarButtons.length === 0) {
    console.log('Sin más tarjetas Matar — saliendo del bucle.');
    break;
  }
  await matarButtons[0].click();
  console.log('  Matar pulsado sobre la primera tarjeta');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `screenshots/verif_grupo_e_ronda_${i}.png`, fullPage: true });
}

await page.screenshot({ path: 'screenshots/verif_grupo_e_final.png', fullPage: true });
console.log('done');
await browser.close();
