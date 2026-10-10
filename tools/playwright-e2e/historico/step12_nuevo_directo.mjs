import { chromium } from 'playwright';

const SAVE_ID = 'cmteh3cle0054riet4kmyj0rt';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
let bodyText = await page.locator('body').innerText();
console.log('t=3s len=', bodyText.length, bodyText.slice(0,200));
for (let i=0;i<10;i++){
  if (!bodyText.includes('Cargando')) break;
  await page.waitForTimeout(3000);
  bodyText = await page.locator('body').innerText();
  console.log(`t=${(i+2)*3}s len=`, bodyText.length);
}
await page.screenshot({ path: 'screenshots/step12_nuevo_directo.png', fullPage: true });
console.log('FINAL:\n', bodyText.slice(0, 3000));
await browser.close();
console.log('OK');
