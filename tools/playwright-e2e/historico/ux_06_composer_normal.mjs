import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

// Quitar el chip insertado antes (si sigue) y ver el composer limpio.
await page.screenshot({ path: 'screenshot-ux-composer-estado.png', fullPage: false });

await browser.close();
