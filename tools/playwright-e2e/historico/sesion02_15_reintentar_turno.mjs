import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
page.on('console', msg => { if (msg.type() === 'error') console.log('[console error]', msg.text()); });
page.on('response', async (res) => {
  if (res.url().includes('/turn/')) {
    console.log('[response]', res.url(), res.status());
  }
});
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Busco un buen lugar donde acampar y descansar antes de seguir camino.');
await page.getByRole('button', { name: /^actuar$/i }).click();
await page.waitForTimeout(45000);
await page.screenshot({ path: 'screenshots/sesion02_15_reintentar_turno.png', fullPage: true });
console.log('--- BODY ---');
console.log(await page.locator('body').innerText());
await browser.close();
console.log('OK');
