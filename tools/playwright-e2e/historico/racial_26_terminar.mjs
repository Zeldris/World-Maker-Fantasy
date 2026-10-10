import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(10000);
for (let i = 0; i < 3; i++) {
  await page.getByRole('button', { name: /combatir/i }).click().catch(() => {});
  await page.waitForTimeout(1000);
  await page.getByText('FICHA DEL RIVAL').click().catch(() => {});
  await page.waitForTimeout(500);
  await page.getByText('Ataque Básico', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^actuar$/i }).nth(0).click().catch(() => {});
  await page.waitForTimeout(20000);
}
await page.screenshot({ path: 'screenshots/racial_26_terminar.png', fullPage: true });

await browser.close();
