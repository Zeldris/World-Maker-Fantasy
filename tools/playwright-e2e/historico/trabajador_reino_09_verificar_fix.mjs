import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
await page.getByText('Mapa', { exact: true }).click();
await page.waitForTimeout(1500);
const zonaTab = page.getByText('Zona', { exact: true });
await zonaTab.first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/tr09_zona_fix.png', fullPage: true });
const svgCount = await page.locator('svg').count();
console.log('cantidad de <svg>:', svgCount);
await browser.close();
