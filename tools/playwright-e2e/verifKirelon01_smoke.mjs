import { chromium } from 'playwright';

const SAVE_ID = 'cmtegz0b4001qrieti2l0z1iu';

async function actuar(page, texto, label, waitMs = 30000) {
  const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
  await campo.click();
  await campo.fill(texto);
  await page.waitForTimeout(300);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
  const t0 = Date.now();
  await actuarBtn.click();
  console.log(`--- turno enviado: ${label} (t=${new Date().toISOString()}) ---`);
  await page.waitForTimeout(waitMs);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  await page.screenshot({ path: `screenshots/${label}.png`, fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log(`=== ${label} (elapsed ~${elapsed}s desde click) ===`);
  console.log(bodyText.slice(0, 2500));
  return bodyText;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/verifKirelon01_estado_inicial.png', fullPage: true });
console.log('Cargado. URL:', page.url());

await actuar(page, 'Miro alrededor y observo el paisaje de la Hondonada del Eco.', 'verifKirelon01_smoke_turno', 35000);

await browser.close();
console.log('OK - fin script');
