import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

const habilidadesBtn = page.getByRole('button', { name: 'Habilidades', exact: true });
await habilidadesBtn.click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/skillbar_03_menu_barras.png' });
console.log('Menú de barras capturado.');

await browser.close();
