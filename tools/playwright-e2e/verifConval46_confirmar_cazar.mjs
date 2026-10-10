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

// Marcar la casilla de Kirelon Arenoso
const checkbox = page.locator('input[type="checkbox"]').first();
await checkbox.click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/verifConval46_checkbox_marcado.png', fullPage: true });

const cazarConfirmBtn = page.locator('button', { hasText: 'CAZAR' });
await cazarConfirmBtn.click();
console.log('--- Cazar confirmado ---');
await page.waitForTimeout(40000);
await page.screenshot({ path: 'screenshots/verifConval46_despues_cazar.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-2500));

await browser.close();
console.log('OK');
