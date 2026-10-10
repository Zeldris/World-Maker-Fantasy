import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Saqueo el cuerpo del Orco enfurecido antes de seguir.');
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
await actuarBtn.click();
console.log('Turno de saqueo enviado, esperando...');

await page.waitForTimeout(45000);

await page.screenshot({ path: 'checklist0922_41_tras_saquear.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
