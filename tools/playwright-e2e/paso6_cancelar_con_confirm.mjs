import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('dialog', async (dialog) => { console.log('dialog:', dialog.message()); await dialog.accept(); });

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const cancelBtn = page.getByRole('button', { name: 'Cancelar acción' });
await cancelBtn.click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/paso6_tras_click.png', fullPage: true });
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones tras click:', JSON.stringify(buttons.slice(0, 10)));
await browser.close();
