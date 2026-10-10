import { chromium } from 'playwright';
const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(10000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/debug_estado_colgado.png', fullPage: true });
await browser.close();
