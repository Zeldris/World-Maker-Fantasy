import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Vuelvo a hablar con Ulkha Ketg antes de irme.');
const start = Date.now();
await page.getByRole('button', { name: /^actuar$/i }).first().click();
const esperando = page.getByText('Esperando la narración de tu último turno...');
await esperando.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
await esperando.waitFor({ state: 'hidden', timeout: 90000 });
console.log('Tiempo del PRIMER turno tras reinicio (con warm-up de prefijo real):', ((Date.now() - start) / 1000).toFixed(1), 's');
await page.screenshot({ path: 'screenshots/paso52_warmup_real.png', fullPage: true });
await browser.close();
