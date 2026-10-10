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

const composerContainer = page.locator('div.border-t.border-red-900\\/50');
const composer = composerContainer.locator('input[placeholder="O describe tu acción..."]');
const actuarBtn = composerContainer.getByRole('button', { name: /^actuar$/i });

for (let tries = 0; tries < 40; tries++) {
  const disabled = await composer.isDisabled().catch(() => true);
  if (!disabled) break;
  await page.waitForTimeout(500);
}
await composer.click();
await composer.fill('Ataco con todo tras el reinicio, a ver si ahora sí conecta.');
await page.waitForTimeout(150);
await actuarBtn.click();
console.log('Turno enviado. Esperando resolución...');
await page.waitForTimeout(8000);
await page.screenshot({ path: 'screenshots/confirmar_fix.png' });
console.log('Captura guardada.');
await browser.close();
