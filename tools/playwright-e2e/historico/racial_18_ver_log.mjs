import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/racial_18_ver_log.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.includes('racial') ? 'CONTIENE "racial" en pantalla' : 'NO contiene "racial" en pantalla');

await browser.close();
