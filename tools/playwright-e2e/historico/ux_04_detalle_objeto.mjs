import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await page.getByRole('button', { name: /inventario/i }).first().click();
await page.waitForTimeout(800);

// Clic en un objeto para ver su detalle.
await page.getByText('Hacha de guerra rota', { exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: 'screenshot-ux-detalle-objeto.png', fullPage: false });

await browser.close();
