import { chromium } from 'playwright';

const SAVE_ID = 'cmten4peu008aritr6km5hcc9';

async function actuar(page, texto, label, waitMs = 40000) {
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
  console.log(bodyText.slice(-1800));
  return bodyText;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

await actuar(page, 'Ataco a "Kirelon Arenoso" con mi hacha, sin previo aviso, para matarlo.', 'verifConval40_formula_exitosa');

await browser.close();
console.log('OK');
