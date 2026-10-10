import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
for (let i = 0; i < 30; i++) {
  const cancelBtn = page.getByRole('button', { name: 'Cancelar acción' });
  const busy = await cancelBtn.isVisible().catch(() => false);
  if (!busy) { console.log('Llegó, ya no está ocupado. Intento', i); break; }
  await page.waitForTimeout(8000);
  await page.reload();
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: 'screenshots/paso15_llegada2.png', fullPage: true });
await browser.close();
