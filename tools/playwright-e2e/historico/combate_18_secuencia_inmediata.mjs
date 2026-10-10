import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

const composer = page.locator('input[placeholder="O describe tu acción..."], textarea[placeholder="O describe tu acción..."]');
await composer.fill('Ataco con mi arma.');
await page.waitForTimeout(200);
await page.getByRole('button', { name: /^actuar$/i }).last().click();
console.log('Ataque enviado, empezando captura INMEDIATA cada 400ms...');

// Captura desde el instante 0, cada 400ms durante 40s (para cubrir espera de red + animación)
for (let i = 1; i <= 100; i++) {
  await page.screenshot({ path: `screenshots/iniciativa_secuencia/${String(i).padStart(3, '0')}.png` });
  await page.waitForTimeout(400);
}
console.log('Secuencia capturada, 100 frames');
await browser.close();
