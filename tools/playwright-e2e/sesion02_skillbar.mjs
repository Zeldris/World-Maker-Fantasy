import { chromium } from 'playwright';

const SAVE_ID = 'cmteuqm0k0001ri7jqoo86e7q';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

// Escribo algo en el composer primero, para comprobar que la habilidad general SUSTITUYE el texto.
const composer = page.locator('[contenteditable="true"]').first();
await composer.click();
await composer.type('texto que debería desaparecer');
await page.waitForTimeout(300);
console.log('Composer ANTES de pulsar habilidad:', await composer.innerText());

// Pulso el primer icono de la barra de habilidades (fila bajo el composer).
const skillSlots = page.locator('.skill-slot');
const count = await skillSlots.count();
console.log('Número de slots en la barra:', count);
if (count > 0) {
  await skillSlots.first().click();
  await page.waitForTimeout(500);
  console.log('Composer DESPUÉS de pulsar habilidad:', await composer.innerText());
}

await page.screenshot({ path: 'screenshots/sesion02_skillbar.png', fullPage: false });
await browser.close();
console.log('OK');
