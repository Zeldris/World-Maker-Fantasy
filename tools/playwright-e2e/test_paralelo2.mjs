import { chromium } from 'playwright';
const SAVE_ID = 'cmthr655x0003rilus98bdifu';
const browser = await chromium.launch();
const page = await browser.newPage();

let classifyResolved = false;
page.on('response', async (res) => {
  if (res.url().includes('/turn/classify') && res.request().method() === 'POST') {
    classifyResolved = true;
    console.log('turn/classify status:', res.status());
    try { console.log((await res.text()).slice(0, 300)); } catch (e) { console.log('error leyendo body:', e); }
  }
  if (res.url().includes('/turn/narrate')) {
    console.log('turn/narrate status:', res.status());
  }
});
page.on('requestfailed', (req) => {
  if (req.url().includes('/turn/')) console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText);
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
const composer = page.locator('[contenteditable="true"]').first();
await composer.click();
await composer.fill('Toco el suelo con la mano.');
await page.waitForTimeout(500);
const btn = page.getByRole('button', { name: /^actuar$/i }).last();
await btn.click();
console.log('Turno enviado, esperando hasta 60s la respuesta real...');
await page.waitForTimeout(60000);
console.log('classifyResolved:', classifyResolved);
await browser.close();
