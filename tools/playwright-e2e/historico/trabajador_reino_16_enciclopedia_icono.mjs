import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
await page.getByText('Enciclopedia', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/tr16_enciclopedia.png', fullPage: true });
const text = await page.locator('body').innerText();
console.log('body (primeros 1000):', text.slice(0, 1000));
await browser.close();
