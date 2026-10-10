import { chromium } from 'playwright';

const SAVE_ID = 'cmteuqm0k0001ri7jqoo86e7q';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const toggle = page.getByRole('button', { name: /^Habilidades$/ });
const toggleExists = await toggle.count();
console.log('Toggle "Habilidades" existe:', toggleExists);
if (toggleExists === 0) {
  console.log('No hay toggle visible — probablemente combateIniciado bloquea la barra (según GameView.tsx). Saliendo.');
  await page.screenshot({ path: 'screenshots/sesion04_sin_toggle.png', fullPage: false });
  await browser.close();
  process.exit(0);
}

await toggle.click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/sesion04_barra_desplegada.png', fullPage: false });

const slots = page.locator('.skill-slot[aria-label]:not([aria-label="Texto libre"]):not([aria-label="Habilidades"])');
const count = await slots.count();
console.log('Habilidades reales en la barra:', count);
for (let i = 0; i < count; i++) console.log(` - ${await slots.nth(i).getAttribute('aria-label')}`);

const composer = page.locator('[contenteditable="true"]').first();
await composer.click();
await composer.type('texto que debería desaparecer');
await page.waitForTimeout(300);
console.log('Composer ANTES:', JSON.stringify(await composer.innerText()));

if (count > 0) {
  await slots.first().click();
  await page.waitForTimeout(500);
  console.log('Composer DESPUÉS:', JSON.stringify(await composer.innerText()));
}

await page.screenshot({ path: 'screenshots/sesion04_tras_click.png', fullPage: false });
await browser.close();
console.log('OK');
