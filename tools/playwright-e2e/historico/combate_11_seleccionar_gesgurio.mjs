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
await page.getByText('Gesgurio', { exact: false }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Cazar', exact: true }).last().click();
console.log('Cazar Gesgurio enviado, esperando resolución...');
await page.waitForTimeout(30000);
await page.screenshot({ path: 'screenshots/combate_11_tras_cazar.png', fullPage: true });
console.log('OK');
await browser.close();
