import { chromium } from 'playwright';

const SAVE_ID = 'cmtmlfk420025ri85hnrpxy66';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const combatirBtn = page.getByRole('button', { name: /Combatir/i });
if (await combatirBtn.count()) {
  await combatirBtn.first().click();
  await page.waitForTimeout(1200);
}

const matarBtn = page.getByRole('button', { name: /^matar$/i });
if (await matarBtn.count()) {
  await matarBtn.first().click();
  console.log('Matar pulsado');
  await page.waitForTimeout(4000);
} else {
  console.log('Botón Matar no visible');
}
await page.screenshot({ path: 'screenshots/verif_grupo_08_tras_matar.png', fullPage: true });
console.log('done');
await browser.close();
