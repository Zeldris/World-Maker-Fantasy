import { chromium } from 'playwright';

const SAVE_ID = 'cmtj2rzh50005ririptsnf82i';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(20000);

for (let i = 1; i <= 5; i++) {
  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `screenshots/audit_13_f5_${i}.png`, fullPage: true });
  console.log(`F5 #${i} hecho`);
}

await browser.close();
