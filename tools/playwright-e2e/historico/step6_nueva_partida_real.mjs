import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto('http://localhost:5173/solitario/mundo/helek-sirik/personaje/char-gorhorn');
await page.waitForTimeout(1000);

// Click en el botón de dificultad "Novato" dentro del panel "Dificultad para tu próxima partida nueva"
// Ese panel está identificado por el texto de cabecera; el botón es un <button> hijo con <p>Novato</p>
const panel = page.locator('div', { has: page.getByText('Dificultad para tu próxima partida nueva', { exact: false }) }).last();
await page.getByRole('button').filter({ hasText: 'Novato' }).filter({ hasText: 'Sin límite de muertes' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/step6_before_new.png', fullPage: true });

await page.locator('button', { hasText: '+ Nueva partida' }).click();
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/step6_after_new.png', fullPage: true });
console.log('URL:', page.url());
const bodyText = await page.locator('body').innerText();
console.log('BODY TEXT:\n', bodyText.slice(0, 3000));
await browser.close();
console.log('OK');
