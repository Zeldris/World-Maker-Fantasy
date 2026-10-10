import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Enciclopedia' }).click();
await page.waitForTimeout(1000);
await page.getByText('Lugares', { exact: true }).click();
await page.waitForTimeout(1000);
await page.getByText('LAS LLANURAS DEL VIENTO ROJO').click();
await page.waitForTimeout(1000);
await page.mouse.wheel(0, 800);
await page.waitForTimeout(500);
await page.getByText('Karot Veku — Ketg\'lukar').click();
await page.waitForTimeout(1000);

// Scroll dentro del modal de la ficha para ver el resto de bloques
const dialog = page.locator('text=Generar miniatura (icono)').locator('..');
await dialog.scrollIntoViewIfNeeded();
await page.mouse.wheel(0, 500);
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/genmapaint_05_scroll_ficha.png', fullPage: true });

await browser.close();
