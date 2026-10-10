import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
// Recargar de nuevo por si el frontend ya lo resolvió solo tras un rato
await page.reload();
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/paso9_tras_reload.png', fullPage: true });
const cancelBtn = page.getByRole('button', { name: 'Cancelar acción' });
console.log('Sigue ocupado:', await cancelBtn.isVisible().catch(() => false));
await browser.close();
