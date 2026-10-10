import { chromium } from 'playwright';

const SAVE_ID = 'cmtmn2kqp0001rijc91hspbom';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const composer = page.getByRole('textbox');
await composer.click();
await composer.fill('Mino un poco de Mena de Yerreo antes de seguir.');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^actuar$/i }).first().click();
console.log('Turno enviado, esperando...');
await page.waitForTimeout(4000);

const minarBtn = page.getByRole('button', { name: /^minar$/i });
if (await minarBtn.count()) {
  await minarBtn.first().click();
  console.log('Minar pulsado, misma sesión');
  await page.waitForTimeout(1200);
} else {
  console.log('Botón Minar no visible tras el turno');
}
await page.screenshot({ path: 'screenshots/pc_05_modal_minar.png', fullPage: true });
console.log('done');
await browser.close();
