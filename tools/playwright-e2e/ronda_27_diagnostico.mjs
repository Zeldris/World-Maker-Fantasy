import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await page.screenshot({ path: 'screenshot-mi-27-diagnostico.png', fullPage: false });
const bodyText = await page.textContent('body');
console.log('Menciona "COMBATIR":', bodyText.includes('COMBATIR'));
console.log('Menciona "Combate":', bodyText.includes('COMBATE'));

await browser.close();
