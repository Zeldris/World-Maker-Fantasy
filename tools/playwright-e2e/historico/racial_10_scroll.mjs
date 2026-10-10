import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const logPanel = page.locator('text=Ver historial completo en el Diario').locator('..').locator('..');
await page.mouse.wheel(0, 5000);
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/racial_10_scroll.png', fullPage: true });

await browser.close();
