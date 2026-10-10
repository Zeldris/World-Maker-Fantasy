import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/skillbar_00_composer_normal.png' });

// El icono de estrellitas (✨) junto al composer abre el menú de barras.
const estrellitasBtn = page.locator('button:has-text("✨")').first();
if (await estrellitasBtn.count()) {
  await estrellitasBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/skillbar_01_menu_abierto.png' });
} else {
  console.log('No se encontró el botón de estrellitas — probando otro selector...');
}

await browser.close();
