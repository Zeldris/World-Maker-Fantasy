import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Defenderte', exact: true }).click();
await page.waitForTimeout(30000);
await page.mouse.wheel(0, 5000);
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/racial_37_resultado_defensa.png', fullPage: true });

await browser.close();
