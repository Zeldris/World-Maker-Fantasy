import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('response', async (res) => {
  if (res.url().includes('/saves/') && res.request().method() !== 'GET') {
    console.log(res.status(), res.request().method(), res.url());
  }
});
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-800));
await browser.close();
console.log('OK');
