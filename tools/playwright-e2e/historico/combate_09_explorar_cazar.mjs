import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);
await page.getByText('Habilidades', { exact: true }).click();
await page.waitForTimeout(800);
await page.getByText('Cazar', { exact: true }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Explorar' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/combate_09_tras_explorar.png', fullPage: true });
console.log('OK');
await browser.close();
