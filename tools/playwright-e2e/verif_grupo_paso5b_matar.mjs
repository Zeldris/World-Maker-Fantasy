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
  console.log('Combatir pulsado');
  await page.waitForTimeout(1500);
} else {
  console.log('Botón Combatir no encontrado con ese selector, listando botones...');
  const buttons = await page.getByRole('button').allTextContents();
  console.log(JSON.stringify(buttons.filter((b) => b.toLowerCase().includes('combat'))));
}

await page.screenshot({ path: 'screenshots/verif_grupo_10_panel_reabierto.png', fullPage: true });

const matarBtn = page.getByRole('button', { name: /^matar$/i });
if (await matarBtn.count()) {
  await matarBtn.first().click();
  console.log('Matar pulsado');
  await page.waitForTimeout(4000);
} else {
  console.log('Botón Matar aún no visible tras reabrir combate');
}
await page.screenshot({ path: 'screenshots/verif_grupo_11_tras_matar2.png', fullPage: true });
console.log('done');
await browser.close();
