import { chromium } from 'playwright';

const SAVE_ID = 'cmtmla2kk0001ri85rljt2ixw';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/verif_grupo_02_estado_inicial.png', fullPage: true });

const combatirBtn = page.getByRole('button', { name: /Combatir/ });
if (await combatirBtn.count()) {
  await combatirBtn.first().click();
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: 'screenshots/verif_grupo_03_panel_combate.png', fullPage: true });
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones visibles tras abrir combate:', JSON.stringify(buttons));

await browser.close();
