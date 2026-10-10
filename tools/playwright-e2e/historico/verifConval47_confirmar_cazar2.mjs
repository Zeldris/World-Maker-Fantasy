import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const habilidadesBtn = page.locator('button', { hasText: 'Habilidades' });
await habilidadesBtn.click();
await page.waitForTimeout(1000);

const cazarChip = page.getByText('Cazar', { exact: true });
await cazarChip.click();
await page.waitForTimeout(1500);

// Acotar al modal: el texto "Cazar" (título h?) está en el modal, buscar el contenedor con la casilla
const checkbox = page.locator('input[type="checkbox"]').first();
await checkbox.click();
await page.waitForTimeout(500);

// El botón de confirmar "CAZAR" es el segundo botón en el footer del modal (junto a CANCELAR)
const modalCazarBtn = page.locator('button:has-text("CAZAR"):not(:has-text("Kirelon"))');
console.log('candidatos CAZAR (sin Kirelon):', await modalCazarBtn.count());
await modalCazarBtn.last().click();
console.log('--- Cazar confirmado ---');
await page.waitForTimeout(40000);
await page.screenshot({ path: 'screenshots/verifConval47_despues_cazar.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-2500));

await browser.close();
console.log('OK');
