import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
const cerrar = page.getByRole('button', { name: /cerrar/i });
if (await cerrar.count() > 0) await cerrar.first().click().catch(() => {});
await page.waitForTimeout(500);

// Buscar el toggle de la barra de habilidades generales (icono cerca del composer, ✨ o similar)
await page.screenshot({ path: 'screenshots/tr11_composer.png', fullPage: true });

// Intentar el botón de estrellas cerca del composer (visto en screenshots anteriores, abajo izq)
const starButton = page.locator('button').filter({ hasText: '✨' });
console.log('botones con estrella:', await starButton.count());
for (let i = 0; i < await starButton.count(); i++) {
  console.log(i, await starButton.nth(i).innerText().catch(() => '(sin texto)'));
}
await browser.close();
