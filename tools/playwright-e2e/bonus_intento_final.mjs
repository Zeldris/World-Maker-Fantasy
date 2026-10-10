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
console.log('Turno enviado.');

// Polling activo: comprobar cada 5s si el log de personaje cambió (nueva narración real)
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(5000);
  const hasChip = await page.locator('text=/\\+\\d+hab/').count();
  if (hasChip > 0) {
    console.log(`Chip encontrado en el intento ${i}`);
    await page.screenshot({ path: 'screenshots/bonus_final_chip.png', fullPage: true });
    break;
  }
  console.log(`Intento ${i}: sin chip todavía`);
}

await page.screenshot({ path: 'screenshots/bonus_intento_final_ultimo.png', fullPage: true });
await browser.close();
