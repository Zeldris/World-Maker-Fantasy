import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const combatir = page.getByRole('button', { name: /combatir/i });
if (await combatir.isVisible({ timeout: 5000 }).catch(() => false)) {
  await combatir.click();
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: 'screenshots/racial_42a_tras_combatir.png', fullPage: true });

await browser.close();
