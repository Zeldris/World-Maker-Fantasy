import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('response', (res) => {
  if (res.status() >= 400 && !res.url().includes('/resume')) console.log('[response error]', res.status(), res.url());
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const bodyBefore = await page.textContent('body');
console.log('Composer aria-disabled ANTES:', await page.getByRole('textbox', { name: 'Acción de tu personaje' }).getAttribute('aria-disabled'));

// Un turno de texto libre normal (no relacionado con Cazar) — debería disparar la limpieza
// natural de pendingCombatNpcSlugs ahora que el fix persiste correctamente el estado.
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Reviso mi equipo tras el combate.');
await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();
console.log('Esperando resolución...');
await page.waitForTimeout(28000);

await page.screenshot({ path: 'screenshot-mi-20-tras-turno-normal.png', fullPage: false });

await browser.close();
