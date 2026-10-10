import { getPage } from './_conn.mjs';

const { page } = await getPage();
// Icono de salida inferior izquierda, aprox (74, 626) en el screenshot anterior
await page.locator('svg').filter({ hasText: '' }).first();
const box = await page.locator('text=Moverte por la zona').isVisible().catch(() => false);
console.log('Modal de zona visible:', box);

// Click directo por coordenadas del SVG (relativo al viewport, aproximado del screenshot)
await page.mouse.click(74, 626);
await page.waitForTimeout(1000);
await page.screenshot({ path: 'salida_region_01_modal.png' });
console.log('Screenshot tomado.');
