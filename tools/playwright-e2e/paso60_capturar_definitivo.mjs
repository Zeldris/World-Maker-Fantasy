import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch();
const page = await browser.newPage();

let narrateBody = null;
let narrateResponse = null;
page.on('request', (req) => {
  if (req.url().includes('/turn/narrate')) {
    narrateBody = req.postDataJSON();
    console.log('[REQ] /turn/narrate enviado en', new Date().toISOString());
  }
});
page.on('response', async (res) => {
  if (res.url().includes('/turn/narrate')) {
    console.log('[RES] /turn/narrate respondió en', new Date().toISOString(), 'status', res.status());
  }
});

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Examino con atención el diseño de las armas colgadas en la pared.');
await page.getByRole('button', { name: /^actuar$/i }).first().click();

const esperando = page.getByText('Esperando la narración de tu último turno...');
await esperando.waitFor({ state: 'hidden', timeout: 150000 });
console.log('turno completo');
if (narrateBody) {
  fs.writeFileSync('/tmp/claude_real_narrate_body.json', JSON.stringify(narrateBody, null, 2));
  console.log('guardado body, action:', narrateBody.action);
}
await browser.close();
