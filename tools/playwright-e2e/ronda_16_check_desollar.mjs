import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const bodyText = await page.textContent('body');
console.log('Menciona "presas caídas sin desollar":', bodyText.includes('presas caídas sin desollar'));
console.log('Menciona "Desollar":', bodyText.includes('Desollar'));

await browser.close();
