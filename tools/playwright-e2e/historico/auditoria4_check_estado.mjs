import { chromium } from 'playwright';

const SAVE_ID = 'cmtj2rzh50005ririptsnf82i';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/aud4_check_estado.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 2500));

await browser.close();
