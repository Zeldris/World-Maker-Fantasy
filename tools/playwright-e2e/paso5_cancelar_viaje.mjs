import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const cancelBtn = page.getByRole('button', { name: 'Cancelar acción' });
if (await cancelBtn.isVisible().catch(() => false)) {
  await cancelBtn.click();
  await page.waitForTimeout(1500);
  console.log('Viaje cancelado');
} else {
  console.log('No había botón de cancelar visible');
}
await page.screenshot({ path: 'screenshots/paso5_tras_cancelar.png', fullPage: true });
await browser.close();
