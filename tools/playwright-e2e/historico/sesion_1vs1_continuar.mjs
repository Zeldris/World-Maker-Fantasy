import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const SHOTS_DIR = 'screenshots/sesion_1vs1';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS_DIR}/continuar_000_estado.png` });

// El panel de combate se cierra al recargar/navegar de nuevo (gotcha ya documentado) — hay que
// reabrirlo con COMBATIR si el combate sigue activo mecánicamente.
const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.count()) {
  await combatirBtn.click();
  await page.waitForTimeout(1000);
}

const composerContainer = page.locator('div.border-t.border-red-900\\/50');
const composer = composerContainer.locator('input[placeholder="O describe tu acción..."]');
const actuarBtn = composerContainer.getByRole('button', { name: /^actuar$/i });

async function atacar(texto, label) {
  for (let tries = 0; tries < 40; tries++) {
    const disabled = await composer.isDisabled().catch(() => true);
    if (!disabled) break;
    await page.waitForTimeout(500);
  }
  await composer.click();
  await composer.fill(texto);
  await page.waitForTimeout(150);
  await actuarBtn.click();
  console.log(`Ataque "${label}" enviado — esperando resolución (hasta 35s)...`);
  for (let tries = 0; tries < 70; tries++) {
    await page.waitForTimeout(500);
    const disabled = await composer.isDisabled().catch(() => true);
    if (!disabled) break;
  }
  await page.screenshot({ path: `${SHOTS_DIR}/continuar_${label}.png` });
}

await atacar('Ataco de nuevo con todas mis fuerzas.', 'ataque3');
await atacar('Sigo atacando sin descanso.', 'ataque4');
await atacar('Remato con un golpe certero.', 'ataque5');

await browser.close();
console.log('Sesión de continuación completada.');
