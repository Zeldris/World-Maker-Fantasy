import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '🗺️ Mapa' }).click();
await page.waitForTimeout(1500);
// El cuadrado naranja (EDIFICIO) en la posición 640,622 aprox del screenshot anterior
await page.locator('rect').first().click({ force: true }).catch((e) => console.log('click rect falló:', e.message));
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/paso30_click_edificio.png', fullPage: true });
await browser.close();
