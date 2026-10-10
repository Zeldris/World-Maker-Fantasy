import { chromium } from 'playwright';

const SAVE_ID = 'cmteqawx90001rijcmmtqvv7v';
const SHOT_DIR = '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad';

async function actuar(page, texto, label, waitMs = 6000) {
  const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
  await campo.click();
  await campo.fill(texto);
  await page.waitForTimeout(300);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
  const disabled = await actuarBtn.isDisabled();
  console.log(`Botón actuar disabled=${disabled}`);
  if (disabled) {
    console.log('No se puede actuar todavía.');
    return false;
  }
  await actuarBtn.click();
  console.log(`--- turno enviado: ${label} ---`);
  await page.waitForTimeout(waitMs);
  return true;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const ok = await actuar(
  page,
  'Ignoro sus palabras y le asesto un hachazo directo con todas mis fuerzas, sin dudar, para intentar matarlo.',
  'verifCombateMult08_atacar2',
  6000
);
console.log('enviado:', ok);

await browser.close();
console.log('OK');
