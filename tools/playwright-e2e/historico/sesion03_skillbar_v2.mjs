import { chromium } from 'playwright';

const SAVE_ID = 'cmteuqm0k0001ri7jqoo86e7q';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const skillSlots = page.locator('.skill-slot');
const count = await skillSlots.count();
console.log('Número de slots en la barra:', count);
for (let i = 0; i < count; i++) {
  const label = await skillSlots.nth(i).getAttribute('aria-label');
  console.log(`slot ${i}: ${label}`);
}

await page.screenshot({ path: 'screenshots/sesion03_antes.png', fullPage: false });

// Escribo algo en el composer primero, para comprobar que la habilidad general SUSTITUYE el texto.
const composer = page.locator('[contenteditable="true"]').first();
await composer.click();
await composer.type('texto que debería desaparecer');
await page.waitForTimeout(300);
console.log('Composer ANTES de pulsar habilidad:', JSON.stringify(await composer.innerText()));

if (count > 0) {
  await skillSlots.first().click();
  await page.waitForTimeout(800);
}

await page.screenshot({ path: 'screenshots/sesion03_despues.png', fullPage: false });
const bodyText = await page.locator('body').innerText();
console.log('BODY TEXT tras el clic (primeros 1500):\n', bodyText.slice(0, 1500));

await browser.close();
console.log('OK');
