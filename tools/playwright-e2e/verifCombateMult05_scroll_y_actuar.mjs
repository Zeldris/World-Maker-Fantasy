import { chromium } from 'playwright';

const SAVE_ID = 'cmteqawx90001rijcmmtqvv7v';
const SHOT_DIR = '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad';

async function actuar(page, texto, label, waitMs = 8000) {
  const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
  await campo.click();
  await campo.fill(texto);
  await page.waitForTimeout(300);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
  const disabled = await actuarBtn.isDisabled();
  console.log(`Botón actuar disabled=${disabled}`);
  if (disabled) {
    console.log('No se puede actuar todavía, saliendo sin enviar.');
    return null;
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

// Scroll panel "TU PERSONAJE" hasta el final
const panel = page.locator('text=TU PERSONAJE').locator('..').locator('..');
await page.mouse.wheel(0, 3000);
await page.waitForTimeout(500);

const bodyText = await page.locator('body').innerText();
console.log('=== ULTIMO TEXTO VISIBLE ===');
console.log(bodyText.slice(-2500));

await page.screenshot({ path: `${SHOT_DIR}/verifCombateMult05_scroll.png`, fullPage: true });

await actuar(
  page,
  'Insisto y avanzo más rápido, siguiendo el rastro y los sonidos, decidido a encontrar y enfrentarme a un grupo numeroso de Kirelon Arenoso o Gesgurio juntos en la Hondonada del Eco.',
  'verifCombateMult05_insistir',
  8000
);

await page.screenshot({ path: `${SHOT_DIR}/verifCombateMult05_tras_enviar.png`, fullPage: true });

await browser.close();
console.log('OK');
