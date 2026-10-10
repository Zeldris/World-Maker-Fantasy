import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

// Seleccionar Gesgurio #1 como objetivo y pulsar Actuar con texto libre de ataque
await page.getByText('Gesgurio #1', { exact: true }).click();
await page.waitForTimeout(300);
const composer = page.locator('input[placeholder="O describe tu acción..."], textarea[placeholder="O describe tu acción..."]');
await composer.fill('Ataco con mi arma.');
await page.waitForTimeout(200);
await page.getByRole('button', { name: /^actuar$/i }).last().click();
console.log('Ataque de combate enviado, esperando resolución del turno...');
await page.waitForTimeout(15000);
await page.screenshot({ path: 'screenshots/iniciativa_secuencia/00_tras_turno.png', fullPage: true });
console.log('Turno resuelto, empezando captura de la animación de iniciativa...');

// Captura rápida cada 500ms durante ~11s (más que 2xROLL_DURATION_MS=10s)
for (let i = 1; i <= 22; i++) {
  await page.screenshot({ path: `screenshots/iniciativa_secuencia/${String(i).padStart(2, '0')}.png` });
  await page.waitForTimeout(500);
}
console.log('Secuencia capturada');
await browser.close();
