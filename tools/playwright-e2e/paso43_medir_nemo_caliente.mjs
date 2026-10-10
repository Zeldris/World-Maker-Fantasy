import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
let classifyMs = null, narrateMs = null, classifyStart = null, narrateStart = null;

page.on('request', (req) => {
  if (req.url().includes('/turn/classify')) classifyStart = Date.now();
  if (req.url().includes('/turn/narrate')) narrateStart = Date.now();
});
page.on('response', (res) => {
  if (res.url().includes('/turn/classify') && classifyStart) classifyMs = Date.now() - classifyStart;
  if (res.url().includes('/turn/narrate') && narrateStart) narrateMs = Date.now() - narrateStart;
});

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Le pregunto a Ulkha Ketg por la situación del clan.');
await page.getByRole('button', { name: /^actuar$/i }).first().click();
const esperando = page.getByText('Esperando la narración de tu último turno...');
await esperando.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
await esperando.waitFor({ state: 'hidden', timeout: 90000 });
console.log('classify ms:', classifyMs, '| narrate ms:', narrateMs);
await page.screenshot({ path: 'screenshots/paso43_nemo_caliente.png', fullPage: true });
await browser.close();
