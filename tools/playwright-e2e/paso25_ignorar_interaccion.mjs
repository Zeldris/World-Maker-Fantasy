import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const ignorarBtn = page.getByRole('button', { name: 'Ignorar' });
if (await ignorarBtn.isVisible().catch(() => false)) {
  await ignorarBtn.click();
  await page.waitForTimeout(1500);
  console.log('Ignorado el recurso');
}
await page.screenshot({ path: 'screenshots/paso25_tras_ignorar.png', fullPage: true });
await browser.close();
