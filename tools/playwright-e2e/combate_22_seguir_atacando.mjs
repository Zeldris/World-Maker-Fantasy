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

for (let ronda = 1; ronda <= 4; ronda++) {
  console.log(`--- Ronda ${ronda}: esperando composer habilitado ---`);
  for (let tries = 0; tries < 40; tries++) {
    const disabled = await composer.isDisabled().catch(() => true);
    if (!disabled) break;
    await page.waitForTimeout(500);
  }
  const texto = `Ataco con todas mis fuerzas, intento ${ronda}.`;
  await composer.click();
  await composer.fill(texto);
  await page.waitForTimeout(150);
  await actuarBtn.click();
  console.log(`Ronda ${ronda} enviada: "${texto}"`);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `screenshots/seguir_atacando/ronda_${ronda}.png` });
}

console.log('4 rondas completadas.');
await browser.close();
