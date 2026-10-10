import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/mundo/helek-sirik/personaje/custom-1788297134535', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: '+ Nueva partida' }).click();
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/fix03_04_modal_clase.png', fullPage: true });
console.log('URL:', page.url());

await browser.close();
