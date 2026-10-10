import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Entro en Karot Veku y busco a Ulkha Ketg.');
await page.getByRole('button', { name: /^actuar$/i }).first().click();
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/paso22_reintento.png', fullPage: true });
await browser.close();
