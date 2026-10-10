import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: '✨ Habilidades' }).click();
await page.waitForTimeout(1000);
await page.getByText('Combate', { exact: true }).click();
await page.waitForTimeout(1000);

// Buscar el botón "Tajo Horizontal" y ver su detalle (clic normal abre el detalle, no lo activa)
await page.getByText('Tajo Horizontal', { exact: true }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/bonus_tooltip_00.png', fullPage: true });

const bodyText = await page.locator('body').innerText();
console.log('Contiene "bono fijo":', bodyText.includes('bono fijo'));
const idx = bodyText.indexOf('bono fijo');
if (idx >= 0) console.log('Contexto:', bodyText.slice(Math.max(0, idx - 80), idx + 40));

await browser.close();
