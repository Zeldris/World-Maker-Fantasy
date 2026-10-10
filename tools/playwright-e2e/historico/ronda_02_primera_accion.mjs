import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('response', (res) => {
  if (res.status() >= 400 && !res.url().includes('/resume')) console.log('[response error]', res.status(), res.url());
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Miro a mi alrededor, examinando el terreno de la Hondonada del Eco con atención.');
await page.getByRole('button', { name: /^actuar$/i }).first().click();

console.log('Esperando resolución del turno (Ollama, hasta 30s)...');
await page.waitForTimeout(28000);

await page.screenshot({ path: 'screenshot-mi-02-primera-accion.png', fullPage: false });
const bodyText = await page.textContent('body');
console.log('Longitud del log:', bodyText.length);
console.log('Contiene "Miro a mi alrededor":', bodyText.includes('Miro a mi alrededor'));

await browser.close();
