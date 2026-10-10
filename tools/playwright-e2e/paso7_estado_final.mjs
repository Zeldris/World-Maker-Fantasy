import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/paso7_estado_final.png', fullPage: true });
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
console.log('Composer visible:', await composer.isVisible().catch(() => false));
await browser.close();
