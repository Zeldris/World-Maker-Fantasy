import { chromium } from 'playwright';

const SAVE_ID = 'cmtmlfk420025ri85hnrpxy66';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/verif_grupo_04_estado_inicial.png', fullPage: true });

const combatirBtn = page.getByRole('button', { name: /Combatir/i });
if (await combatirBtn.count()) {
  await combatirBtn.first().click();
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: 'screenshots/verif_grupo_05_panel_combate.png', fullPage: true });
const buttons1 = await page.getByRole('button').allTextContents();
console.log('Botones tras abrir combate:', JSON.stringify(buttons1));

await browser.close();
