import { chromium } from 'playwright';

const SAVE_ID = 'cmteuqm0k0001ri7jqoo86e7q';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

// PASO 1: composer visible por defecto (barra plegada) — escribo texto.
const composer = page.locator('[contenteditable="true"]').first();
await composer.click();
await composer.type('texto que debería desaparecer');
await page.waitForTimeout(300);
console.log('Composer ANTES:', JSON.stringify(await composer.innerText()));

// PASO 2: despliego la barra (el composer se sustituye por SkillBar).
const toggle = page.getByRole('button', { name: /^Habilidades$/ });
await toggle.click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'screenshots/sesion05_barra_desplegada.png', fullPage: false });

// PASO 3: pulso "Descansar" (no abre modal, cae en el camino de setText).
const descansar = page.getByRole('button', { name: 'Descansar' });
await descansar.click();
await page.waitForTimeout(600);
await page.screenshot({ path: 'screenshots/sesion05_tras_click.png', fullPage: false });

// PASO 4: el composer debería haber reaparecido con el texto sustituido.
const composerAfter = page.locator('[contenteditable="true"]').first();
const visible = await composerAfter.count();
console.log('Composer visible tras pulsar habilidad:', visible > 0);
if (visible > 0) {
  console.log('Composer DESPUÉS:', JSON.stringify(await composerAfter.innerText()));
}

await browser.close();
console.log('OK');
