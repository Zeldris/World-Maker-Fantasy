import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const aceptar = page.getByRole('button', { name: /aceptar/i });
console.log('Botón Aceptar visible:', await aceptar.isVisible());
await aceptar.click();
await page.waitForTimeout(4000);

await page.screenshot({ path: 'screenshot-mi-29-tras-aceptar.png', fullPage: false });

const habilidadesTab = page.getByRole('button', { name: /habilidades/i }).first();
console.log('Habilidades disabled tras Aceptar:', await habilidadesTab.isDisabled());

await browser.close();
