import { chromium } from 'playwright';

const SAVE_ID = 'cmtmn2kqp0001rijc91hspbom';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(60000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const composer = page.getByRole('textbox');
await composer.click();
await composer.fill('Mino un poco de Mena de Yerreo antes de seguir.');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^actuar$/i }).first().click();
await page.waitForTimeout(4000);

const minarBtn = page.getByRole('button', { name: /^minar$/i });
if (await minarBtn.count()) {
  await minarBtn.first().click();
  await page.waitForTimeout(1000);
}

const explorarBtn = page.getByRole('button', { name: /explorar/i });
if (await explorarBtn.count()) {
  await explorarBtn.first().click();
  console.log('Explorar pulsado, esperando resolución...');
  await page.waitForTimeout(20000);
} else {
  console.log('Botón Explorar no visible');
}
await page.screenshot({ path: 'screenshots/pc_06_tras_explorar.png', fullPage: true });
console.log('done');
await browser.close();
