import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);
await page.getByText('Mapa', { exact: true }).click();
await page.waitForTimeout(1500);
// El punto naranja con "20" — click en las coordenadas aproximadas vistas en el screenshot
await page.mouse.click(490, 664);
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/combate_06_punto_detalle.png', fullPage: true });
console.log('OK');
await browser.close();
