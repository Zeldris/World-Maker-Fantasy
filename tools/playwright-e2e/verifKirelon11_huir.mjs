import { chromium } from 'playwright';

const SAVE_ID = 'cmtegz0b4001qrieti2l0z1iu';

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
  console.log(bodyText.slice(-3000));
  return bodyText;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

// Buscamos primero si hay un panel/botón de combate dedicado (Huir/Combatir)
const huirBtn = page.getByRole('button', { name: /^huir$/i });
const count = await huirBtn.count();
console.log('Botones "Huir" encontrados:', count);

await actuar(page, 'El Kirelon Arenoso es demasiado peligroso. Huyo corriendo lo más rápido que puedo, alejándome de la cueva y de la Hondonada del Eco.', 'verifKirelon11_huir_turno');

await browser.close();
console.log('OK');
