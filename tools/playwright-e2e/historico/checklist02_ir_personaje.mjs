import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);

await page.getByRole('button', { name: 'Personaje' }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/checklist02_01_personaje.png', fullPage: true });

// Buscar pestaña "Equipo" si existe
const equipoTab = page.getByRole('button', { name: /equipo/i }).first();
if (await equipoTab.count() > 0) {
  await equipoTab.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/checklist02_02_equipo.png', fullPage: true });
}

await browser.close();
