import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

let narrateBody = null;
page.on('request', (req) => {
  if (req.url().includes('/turn/narrate')) {
    narrateBody = req.postDataJSON();
    console.log('capturado /turn/narrate en', new Date().toISOString());
  }
});

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Examino con atención el diseño de las armas colgadas en la pared.');
await page.getByRole('button', { name: /^actuar$/i }).first().click();
await page.waitForTimeout(4000);
if (narrateBody) {
  const fs = await import('fs');
  fs.writeFileSync('/tmp/claude_real_narrate_body.json', JSON.stringify(narrateBody, null, 2));
  console.log('guardado, promptLength:', narrateBody.action);
} else {
  console.log('NO capturado');
}
await browser.close();
