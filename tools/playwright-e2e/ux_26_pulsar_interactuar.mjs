import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const btn = page.getByRole('button', { name: /^interactuar$/i });
await btn.scrollIntoViewIfNeeded();
await btn.click();
console.log('Interactuar pulsado, esperando resolución...');
await page.waitForTimeout(30000);

await page.screenshot({ path: 'screenshot-ux-tras-interactuar.png', fullPage: false });

await browser.close();
