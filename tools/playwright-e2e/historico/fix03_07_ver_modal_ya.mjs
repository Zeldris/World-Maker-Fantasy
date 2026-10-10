import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmtj5zvk1003uriri0iuzjw6m', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/fix03_07_modal_real.png', fullPage: true });

await browser.close();
