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

let shotIndex = 10;
async function shot(label) {
  shotIndex += 1;
  await page.screenshot({ path: `${SHOTS_DIR}/${String(shotIndex).padStart(3, '0')}_${label}.png` });
}

console.log('1. Cargando partida y repitiendo Cazar -> Explorar...');
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);
await page.locator('button', { hasText: 'Habilidades' }).first().click();
await page.waitForTimeout(500);
await page.getByText('Cazar', { exact: true }).first().click();
await page.waitForTimeout(800);
const explorarBtn = page.getByRole('button', { name: /explorar/i });
if (await explorarBtn.count()) {
  await explorarBtn.click();
  await page.waitForTimeout(3000);
}
await shot('cazar_explorado');

console.log('2. Seleccionando Ruptidar y pulsando Cazar...');
const ruptidarCheckbox = page.getByText('Ruptidar', { exact: false }).first();
await ruptidarCheckbox.click();
await page.waitForTimeout(300);
const cazarConfirmBtn = page.getByRole('button', { name: /^cazar$/i });
await cazarConfirmBtn.click();
console.log('3. Caza confirmada, esperando resolución (puede tardar por Ollama)...');
await page.waitForTimeout(15000);
await shot('tras_cazar');

console.log('4. Buscando botón COMBATIR...');
const combatirBtn = page.getByRole('button', { name: /combatir/i });
for (let tries = 0; tries < 10 && !(await combatirBtn.count()); tries++) {
  await page.waitForTimeout(2000);
}
if (await combatirBtn.count()) {
  await combatirBtn.click();
  await page.waitForTimeout(1000);
  await shot('combate_abierto');
} else {
  console.log('No apareció el botón COMBATIR tras esperar — revisar tras_cazar.png');
  await context.close();
  await browser.close();
  process.exit(0);
}

console.log('5. Preparando primer ataque en el composer de combate...');
const composerContainer = page.locator('div.border-t.border-red-900\\/50');
const composer = composerContainer.locator('input[placeholder="O describe tu acción..."]');
const actuarBtn = composerContainer.getByRole('button', { name: /^actuar$/i });

for (let tries = 0; tries < 30; tries++) {
  const disabled = await composer.isDisabled().catch(() => true);
  if (!disabled) break;
  await page.waitForTimeout(500);
}
await composer.click();
await composer.fill('Ataco al Ruptidar con mi arma.');
await page.waitForTimeout(150);
await actuarBtn.click();
console.log('6. Primer ataque enviado — capturando cada 250ms durante 25s (primera tirada de iniciativa)...');

for (let i = 1; i <= 100; i++) {
  await page.screenshot({ path: `${SHOTS_DIR}/turno1_${String(i).padStart(3, '0')}.png` });
  await page.waitForTimeout(250);
}
console.log('Primer turno capturado (100 frames, 250ms).');

console.log('7. Segundo ataque para ver la iniciativa siguiente...');
for (let tries = 0; tries < 30; tries++) {
  const disabled = await composer.isDisabled().catch(() => true);
  if (!disabled) break;
  await page.waitForTimeout(500);
}
await composer.click();
await composer.fill('Vuelvo a atacar con todas mis fuerzas.');
await page.waitForTimeout(150);
await actuarBtn.click();
console.log('Segundo ataque enviado — capturando cada 250ms durante 25s...');
for (let i = 1; i <= 100; i++) {
  await page.screenshot({ path: `${SHOTS_DIR}/turno2_${String(i).padStart(3, '0')}.png` });
  await page.waitForTimeout(250);
}
console.log('Segundo turno capturado.');

await context.close();
await browser.close();
console.log('Sesión completa. Vídeo guardado en videos/.');
