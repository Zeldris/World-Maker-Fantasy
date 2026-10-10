import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Exploro la zona con cautela, buscando cualquier señal de fauna.');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^actuar$/i }).first().click();
console.log('Turno enviado, esperando narración...');
await page.waitForTimeout(20000);
await page.screenshot({ path: 'screenshots/combate_02_tras_explorar.png', fullPage: true });
console.log('OK');
await browser.close();
