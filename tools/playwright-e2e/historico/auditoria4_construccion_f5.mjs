import { chromium } from 'playwright';

const SAVE_ID = 'cmtj2rzh50005ririptsnf82i';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/aud4_00_inicial.png', fullPage: true });
console.log('Cargado, URL:', page.url());

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Construyo un campamento base aquí mismo, usando la leña, piedra y piel que llevo.');
await page.screenshot({ path: 'screenshots/aud4_01_texto_escrito.png', fullPage: true });

const actuarBtn = page.getByRole('button', { name: /^Actuar$/ }).nth(0);
await actuarBtn.click();
console.log('Actuar pulsado, esperando respuesta...');
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/aud4_02_tras_actuar.png', fullPage: true });

console.log('Contenido del log tras enviar:');
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 3000));

await browser.close();
