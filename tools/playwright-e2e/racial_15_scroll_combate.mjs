import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

// Colapsar la ficha del rival para ver el resto del panel de combate
await page.getByText('FICHA DEL RIVAL').click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/racial_15_colapsado.png', fullPage: true });

await browser.close();
