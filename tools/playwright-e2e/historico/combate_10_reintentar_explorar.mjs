import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);
await page.getByText('Habilidades', { exact: true }).click();
await page.waitForTimeout(800);
await page.getByText('Cazar', { exact: true }).click();
await page.waitForTimeout(800);

for (let i = 0; i < 5; i++) {
  const btn = page.getByRole('button', { name: 'Explorar' });
  const count = await btn.count();
  if (count === 0) break;
  await btn.click();
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: 'screenshots/combate_10_reintentos.png', fullPage: true });
console.log('OK');
await browser.close();
