import { chromium } from 'playwright';

const SAVE_ID = 'cmtj2rzh50005ririptsnf82i';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(60000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);

const texto = "Salgo a cazar y ataco a 'Múrgol', 'Corretolvas'.";
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill(texto);
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Actuar' }).nth(0).click();
console.log('Turno enviado, esperando resolución (hasta 60s)...');
await page.waitForTimeout(35000);
await page.screenshot({ path: 'screenshots/audit_12_tras_turno_grupo.png', fullPage: true });
console.log('Screenshot tomado');

await browser.close();
