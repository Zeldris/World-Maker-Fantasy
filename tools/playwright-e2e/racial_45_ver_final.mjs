import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.mouse.wheel(0, 5000);
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/racial_45_final.png', fullPage: true });

await browser.close();
