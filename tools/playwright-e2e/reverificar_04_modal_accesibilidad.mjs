import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s'; // "TEST Claude - no tocar"

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

// Abrir Habilidades (ya no bloqueado tras resolver la muerte) y usar "Recoger" o "Viajar", que
// usan SelectionModalShell (confirmado en el screenshot anterior: Recoger/Entregar/Aprender
// oficio/Volver al campamento/Viajar/Descansar/Saquear/Cazar/Curar/Comer-Beber).
const habilidadesTab = page.getByRole('button', { name: /habilidades/i }).first();
await habilidadesTab.click();
await page.waitForTimeout(1000);

const viajarBtn = page.getByText('Viajar', { exact: true });
await viajarBtn.click();
await page.waitForTimeout(1500);

const dialog = page.getByRole('dialog');
console.log('role=dialog visible:', await dialog.isVisible().catch(() => false));
console.log('aria-modal:', await dialog.getAttribute('aria-modal').catch(() => null));
console.log('aria-label:', await dialog.getAttribute('aria-label').catch(() => null));

await page.screenshot({ path: 'screenshot-04-modal-viajar.png', fullPage: false });

// Escape debe cerrar el modal.
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
console.log('Dialog visible tras Escape (debe ser false):', await dialog.isVisible().catch(() => false));

await browser.close();
