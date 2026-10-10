import { chromium } from 'playwright';

const SAVE_ID = 'cmtj2rzh50005ririptsnf82i';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Monto un campamento base con los materiales que llevo encima.');
await page.screenshot({ path: 'screenshots/aud4_v3_00_texto.png', fullPage: true });

const actuarBtn = page.getByRole('button', { name: /^Actuar$/ }).nth(0);
await actuarBtn.click();
console.log('Actuar pulsado a las', new Date().toISOString());
await page.waitForTimeout(6000);
await page.screenshot({ path: 'screenshots/aud4_v3_01_tras_actuar.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 2000));

await browser.close();
