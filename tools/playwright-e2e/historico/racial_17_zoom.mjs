import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const box = await page.locator('text=RESOLVIENDO COMBATE').locator('..').boundingBox();
await page.screenshot({ path: 'screenshots/racial_17_zoom.png', clip: { x: box.x - 10, y: box.y - 10, width: 620, height: 200 } });

await browser.close();
