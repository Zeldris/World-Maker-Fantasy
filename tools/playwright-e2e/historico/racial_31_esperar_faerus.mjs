import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(15000);
await page.screenshot({ path: 'screenshots/racial_31_esperar_faerus.png', fullPage: true });

await browser.close();
