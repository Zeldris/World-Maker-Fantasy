import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Sigo mi camino hacia Karot Veku.');
await page.getByRole('button', { name: /^actuar$/i }).first().click();
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/paso16_retoma.png', fullPage: true });
await browser.close();
