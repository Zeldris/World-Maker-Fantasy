import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const VIDEO_DIR = 'videos';
const SHOTS_DIR = 'screenshots/sesion_1vs1';
fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
  viewport: { width: 1280, height: 720 },
});
const page = await context.newPage();

console.log('1. Cargando partida (combate ya abierto en el backend)...');
await page.goto(SAVE_URL);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS_DIR}/020_antes_combatir.png` });

console.log('2. Pulsando COMBATIR...');
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${SHOTS_DIR}/021_combate_abierto.png` });

const composerContainer = page.locator('div.border-t.border-red-900\\/50');
const composer = composerContainer.locator('input[placeholder="O describe tu acción..."]');
const actuarBtn = composerContainer.getByRole('button', { name: /^actuar$/i });

for (let tries = 0; tries < 30; tries++) {
  const disabled = await composer.isDisabled().catch(() => true);
  if (!disabled) break;
  await page.waitForTimeout(500);
}
await composer.click();
await composer.fill('Ataco al Ruptidar con mi Cuchillo de hielo sílice.');
await page.waitForTimeout(150);
await actuarBtn.click();
console.log('3. Primer ataque enviado — capturando cada 250ms durante 25s...');
for (let i = 1; i <= 100; i++) {
  await page.screenshot({ path: `${SHOTS_DIR}/turno1_${String(i).padStart(3, '0')}.png` });
  await page.waitForTimeout(250);
}
console.log('Primer turno capturado.');

for (let tries = 0; tries < 30; tries++) {
  const disabled = await composer.isDisabled().catch(() => true);
  if (!disabled) break;
  await page.waitForTimeout(500);
}
await composer.click();
await composer.fill('Vuelvo a atacar con todas mis fuerzas.');
await page.waitForTimeout(150);
await actuarBtn.click();
console.log('4. Segundo ataque enviado — capturando cada 250ms durante 25s...');
for (let i = 1; i <= 100; i++) {
  await page.screenshot({ path: `${SHOTS_DIR}/turno2_${String(i).padStart(3, '0')}.png` });
  await page.waitForTimeout(250);
}
console.log('Segundo turno capturado.');

await context.close();
await browser.close();
console.log('Sesión completa. Vídeo guardado en videos/.');
