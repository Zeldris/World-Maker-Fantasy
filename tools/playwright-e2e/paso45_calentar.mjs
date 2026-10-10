import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Escucho atentamente su respuesta.');
await page.getByRole('button', { name: /^actuar$/i }).first().click();
const esperando = page.getByText('Esperando la narración de tu último turno...');
await esperando.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
await esperando.waitFor({ state: 'hidden', timeout: 90000 }).catch((e) => console.log('sigue:', e.message));
console.log('listo (o timeout)');
await browser.close();
