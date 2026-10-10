import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.isVisible().catch(() => false)) {
  await combatirBtn.click();
  await page.waitForTimeout(1500);
}

await page.getByText('Tajo Horizontal', { exact: true }).click();
await page.waitForTimeout(500);
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
console.log('Actuar enabled:', !(await actuarBtn.isDisabled()));
await actuarBtn.click();

console.log('Esperando resolución del intercambio...');
await page.waitForTimeout(15000);
await page.screenshot({ path: 'screenshot-ux-tras-defender-1.png', fullPage: false });

await page.waitForTimeout(15000);
await page.screenshot({ path: 'screenshot-ux-tras-defender-2.png', fullPage: false });

await browser.close();
