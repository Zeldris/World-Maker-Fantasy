import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill("Ataco con fiereza al Kirelon Arenoso que se acerca.");
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^actuar$/i }).first().click();
console.log('Ataque enviado, esperando...');
await page.waitForTimeout(35000);
await page.screenshot({ path: 'screenshots/combate_04_tras_atacar.png', fullPage: true });
console.log('OK');
await browser.close();
