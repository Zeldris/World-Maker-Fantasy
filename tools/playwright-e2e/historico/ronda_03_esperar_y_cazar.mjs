import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('response', (res) => {
  if (res.status() >= 400 && !res.url().includes('/resume')) console.log('[response error]', res.status(), res.url());
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

// Confirmar si sigue resolviendo el turno anterior, esperar hasta que el composer esté libre.
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
for (let i = 0; i < 10; i++) {
  const disabled = await composer.getAttribute('aria-disabled');
  console.log(`Intento ${i}: composer aria-disabled=${disabled}`);
  if (disabled !== 'true') break;
  await page.waitForTimeout(5000);
}

await page.screenshot({ path: 'screenshot-mi-03-tras-espera.png', fullPage: false });

// Abrir Habilidades → Cazar.
const habilidadesTab = page.getByRole('button', { name: /habilidades/i }).first();
await habilidadesTab.click();
await page.waitForTimeout(1000);
const cazarBtn = page.getByText('Cazar', { exact: true });
console.log('Botón Cazar visible:', await cazarBtn.isVisible().catch(() => false));
await cazarBtn.click();
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshot-mi-03b-modal-cazar.png', fullPage: false });

const dialog = page.getByRole('dialog');
console.log('Modal Cazar: role=dialog visible:', await dialog.isVisible().catch(() => false));
console.log('Modal Cazar: aria-label:', await dialog.getAttribute('aria-label').catch(() => null));

await browser.close();
