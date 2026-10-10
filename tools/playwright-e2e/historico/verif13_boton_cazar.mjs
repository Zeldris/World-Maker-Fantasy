import { chromium } from 'playwright';

const SAVE_ID = 'cmtegz0b4001qrieti2l0z1iu';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

// Buscar boton de habilidad "Cazar" en el panel de habilidades/acciones rapidas
const cazarBtn = page.getByText('Cazar', { exact: true });
console.log('elementos "Cazar" encontrados:', await cazarBtn.count());

await page.screenshot({ path: 'screenshots/verif13_estado_previo.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 3000));

await browser.close();
console.log('OK');
