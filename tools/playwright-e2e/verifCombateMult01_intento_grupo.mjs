import { chromium } from 'playwright';

const SAVE_ID = 'cmteqawx90001rijcmmtqvv7v';
const SHOT_DIR = '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad';

async function actuar(page, texto, label, waitMs = 40000) {
  const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
  await campo.click();
  await campo.fill(texto);
  await page.waitForTimeout(300);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
  await actuarBtn.click();
  console.log(`--- turno enviado: ${label} ---`);
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${SHOT_DIR}/${label}.png`, fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log(`=== ${label} ===`);
  console.log(bodyText.slice(-4000));
  return bodyText;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

await actuar(
  page,
  'Ignoro al Kirelon Arenoso y a Gistera Koh por un momento. Me interno más en la Hondonada del Eco buscando activamente una manada o grupo de varias criaturas de la misma especie (Gesgurio o Kirelon Arenoso) para cazar a varias a la vez.',
  'verifCombateMult01_intento_grupo',
  45000
);

await browser.close();
console.log('OK');
