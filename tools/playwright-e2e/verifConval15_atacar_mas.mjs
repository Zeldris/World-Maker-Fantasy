import { chromium } from 'playwright';

const SAVE_ID = 'cmtegylxo0001rietdx8zyloy';

async function actuar(page, texto, label, waitMs = 45000) {
  const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
  await campo.click();
  await campo.fill(texto);
  await page.waitForTimeout(300);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
  await actuarBtn.click();
  console.log(`--- turno enviado: ${label} ---`);
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `screenshots/${label}.png`, fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log(`=== ${label} ===`);
  console.log(bodyText.slice(-2000));
  const buttons = await page.locator('button').all();
  console.log('--BOTONES--');
  for (const b of buttons) {
    const text = (await b.innerText()).trim().replace(/\s+/g, ' ');
    if (text) console.log(' -', text);
  }
  return bodyText;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

await actuar(page, 'Ataco de nuevo al Kirelon Arenoso, sin retirarme, buscando derribarlo con un tajo de hacha.', 'verifConval15_atacar_mas');

await browser.close();
console.log('OK');
