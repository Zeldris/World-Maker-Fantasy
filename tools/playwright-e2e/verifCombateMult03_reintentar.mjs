import { chromium } from 'playwright';

const SAVE_ID = 'cmteqawx90001rijcmmtqvv7v';
const SHOT_DIR = '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad';

async function actuar(page, texto, label, waitMs = 8000) {
  const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
  await campo.click();
  await campo.fill(texto);
  await page.waitForTimeout(300);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
  await actuarBtn.click();
  console.log(`--- turno enviado: ${label} ---`);
  await page.waitForTimeout(waitMs);
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

await actuar(
  page,
  'Sigo explorando la Hondonada del Eco con determinación, esta vez acercándome a las bocas de cueva más profundas, buscando específicamente un grupo o manada de varios Kirelon Arenoso o Gesgurio juntos para cazarlos a todos.',
  'verifCombateMult03_reintentar',
  8000
);

console.log('turno enviado, saliendo');
await browser.close();
console.log('OK');
