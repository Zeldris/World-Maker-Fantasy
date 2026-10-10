import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

// Si el modal de combate ya está abierto de una sesión anterior, no hace falta reabrirlo;
// si no, pulsar COMBATIR.
const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.count()) {
  await combatirBtn.click();
  await page.waitForTimeout(1000);
}

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
const composer = page.locator('input[placeholder="O describe tu acción..."], textarea[placeholder="O describe tu acción..."]');

// Esperar a que el botón Actuar esté REALMENTE habilitado (sin turno pendiente de resolver)
// antes de tocar nada — evita capturar la resolución del turno anterior en vez del nuevo.
console.log('Esperando a que Actuar esté habilitado...');
await actuarBtn.waitFor({ state: 'visible' });
for (let tries = 0; tries < 60; tries++) {
  const disabled = await actuarBtn.isDisabled();
  if (!disabled) break;
  await page.waitForTimeout(500);
}
const stillDisabled = await actuarBtn.isDisabled();
console.log('Actuar habilitado:', !stillDisabled);

await composer.fill('Ataco con mi arma de nuevo.');
await page.waitForTimeout(200);
await actuarBtn.click();
console.log('Ataque enviado, empezando captura INMEDIATA cada 300ms...');

for (let i = 1; i <= 130; i++) {
  await page.screenshot({ path: `screenshots/iniciativa_limpia/${String(i).padStart(3, '0')}.png` });
  await page.waitForTimeout(300);
}
console.log('Secuencia capturada, 130 frames');
await browser.close();
