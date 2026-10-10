import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await page.getByRole('button', { name: /inventario/i }).first().click();
await page.waitForTimeout(800);

const card = page.getByText('Hacha de guerra rota', { exact: true });
await card.hover();
await page.waitForTimeout(300);
const detailBtn = page.getByRole('button', { name: /detalle de hacha de guerra rota/i });
console.log('Detalle visible tras hover:', await detailBtn.isVisible().catch(() => false));
await detailBtn.click({ force: true });
await page.waitForTimeout(600);
await page.screenshot({ path: 'screenshot-ux-detalle-con-boton.png', fullPage: false });

await browser.close();
