import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Enciclopedia' }).click();
await page.waitForTimeout(1500);
await page.getByText('Lugares', { exact: true }).click();
await page.waitForTimeout(1500);
await page.getByText('LAS LLANURAS DEL VIENTO ROJO').click();
await page.waitForTimeout(1500);
await page.mouse.wheel(0, 800);
await page.waitForTimeout(500);
await page.getByText('Karot Veku — Ketg\'lukar').click();
await page.waitForTimeout(2000);

// Obtener el texto completo del modal para ver si "Mapa" está ahí, aunque no sea visible en el screenshot
const bodyText = await page.locator('text=Generar miniatura (icono)').locator('../..').innerText();
console.log('--- TEXTO DEL BLOQUE ---');
console.log(bodyText);

await browser.close();
