import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Me acerco a la boca de cueva y ataco al Kirelon Arenoso con mi hacha, sin darle tiempo a reaccionar.');
await page.getByRole('button', { name: /^actuar$/i }).click();
await page.waitForTimeout(2000);
console.log('turno de ataque enviado');
await browser.close();
console.log('OK');
