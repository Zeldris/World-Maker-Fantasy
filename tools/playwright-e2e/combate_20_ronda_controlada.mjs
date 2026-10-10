import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.count()) {
  await combatirBtn.click();
  await page.waitForTimeout(1000);
}

// CombatComposer (input de texto libre) tiene SU PROPIO botón "Actuar" (onSubmit), distinto del
// botón fijo de CombatPanel (onActuar, solo actúa con habilidad/objeto seleccionado). Aislar el
// composer correcto por su contenedor (border-t border-red-900/50) para no ambigüedad.
const composerContainer = page.locator('div.border-t.border-red-900\\/50');
const composer = composerContainer.locator('input[placeholder="O describe tu acción..."]');
const actuarBtn = composerContainer.getByRole('button', { name: /^actuar$/i });

console.log('Esperando a que el composer esté habilitado (sin turno pendiente)...');
for (let tries = 0; tries < 60; tries++) {
  const disabled = await composer.isDisabled().catch(() => true);
  if (!disabled) break;
  await page.waitForTimeout(500);
}
console.log('Composer habilitado:', !(await composer.isDisabled().catch(() => true)));

await composer.click();
await composer.fill('Ataco con mi arma, ronda controlada.');
await page.waitForTimeout(150);
const valorAntes = await composer.inputValue();
console.log('Texto en composer antes de pulsar:', JSON.stringify(valorAntes));

await actuarBtn.click();
console.log('UN SOLO clic en Actuar. Empezando captura cada 300ms...');

let clicksDeMas = 0;
for (let i = 1; i <= 130; i++) {
  await page.screenshot({ path: `screenshots/ronda_controlada/${String(i).padStart(3, '0')}.png` });
  // Verificación de seguridad: confirmar que el composer sigue vacío/deshabilitado (nunca reenviar).
  const val = await composer.inputValue().catch(() => '');
  if (val.trim() === 'Ataco con mi arma, ronda controlada.') clicksDeMas++;
  await page.waitForTimeout(300);
}
console.log('Secuencia capturada, 130 frames. Composer con texto viejo en', clicksDeMas, 'frames (post-envío, deberia ser 0 tras el primer frame).');
await browser.close();
