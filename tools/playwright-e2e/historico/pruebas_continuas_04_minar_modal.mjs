import { chromium } from 'playwright';

const SAVE_ID = 'cmtmn2kqp0001rijc91hspbom';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const minarBtn = page.getByRole('button', { name: /^minar$/i });
if (await minarBtn.count()) {
  await minarBtn.first().click();
  console.log('Minar pulsado');
  await page.waitForTimeout(1200);
} else {
  console.log('Botón Minar no visible');
}
await page.screenshot({ path: 'screenshots/pc_04_modal_minar.png', fullPage: true });
console.log('done');
await browser.close();
