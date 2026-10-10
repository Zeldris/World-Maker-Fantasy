import { chromium } from 'playwright';

const SAVE_ID = 'cmtj2rzh50005ririptsnf82i';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill("Ataco a 'Rondador de Brasas' con mi arma, directo al cuello.");
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Actuar' }).nth(0).click();
console.log('Turno enviado, esperando resolución (hasta 40s)...');
await page.waitForTimeout(40000);
await page.screenshot({ path: 'screenshots/audit_17_tras_ataque.png', fullPage: true });
console.log('done');

await browser.close();
