import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('response', (res) => {
  if (res.url().includes('cancel') || res.url().includes('viaje')) {
    console.log('RED:', res.status(), res.url());
  }
});

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const cancelBtn = page.getByRole('button', { name: 'Cancelar acción' });
const visible = await cancelBtn.isVisible().catch(() => false);
console.log('Botón cancelar visible:', visible);
if (visible) {
  await cancelBtn.click();
  await page.waitForTimeout(2000);
}
await page.screenshot({ path: 'screenshots/paso8_final.png', fullPage: true });
await browser.close();
