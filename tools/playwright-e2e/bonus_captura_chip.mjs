import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

await page.getByText('Canizor #2').first().click();
await page.waitForTimeout(500);

const composer = page.locator('input[placeholder="O describe tu acción..."]');
await composer.click();
await composer.fill("Uso Tajo Horizontal contra 'Canizor #2'.");
await page.waitForTimeout(500);

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
await actuarBtn.click();
console.log('Turno enviado. Esperando hasta 150s a que aparezca el chip +N habilidad...');

try {
  await page.waitForSelector('text=/\\+\\d+hab/', { timeout: 150000 });
  console.log('¡CHIP ENCONTRADO!');
  await page.screenshot({ path: 'screenshots/bonus_chip_encontrado.png', fullPage: true });
} catch (e) {
  console.log('No apareció el chip en 150s. Puede que el resultado no incluya golpe exitoso con bono.');
  await page.screenshot({ path: 'screenshots/bonus_chip_no_encontrado.png', fullPage: true });
}

await browser.close();
