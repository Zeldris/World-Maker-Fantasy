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

// Scroll dentro del modal para ver todas las tarjetas de la región
const modal = page.locator('text=LAS LLANURAS DEL VIENTO ROJO').locator('..').locator('..');
await page.mouse.wheel(0, 800);
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/genmapaint_02_scroll1.png', fullPage: true });

await page.mouse.wheel(0, 800);
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/genmapaint_03_scroll2.png', fullPage: true });

await browser.close();
