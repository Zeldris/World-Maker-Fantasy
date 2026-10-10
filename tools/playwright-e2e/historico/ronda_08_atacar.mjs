import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('response', (res) => {
  if (res.status() >= 400 && !res.url().includes('/resume')) console.log('[response error]', res.status(), res.url());
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(2000);

await page.getByText('Tajo Horizontal', { exact: true }).click();
await page.waitForTimeout(500);
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
console.log('Actuar enabled:', !(await actuarBtn.isDisabled()));
await actuarBtn.click();

console.log('Esperando resolución del combate (dados + narración, hasta 40s)...');
await page.waitForTimeout(35000);

await page.screenshot({ path: 'screenshot-mi-08-tras-atacar.png', fullPage: false });

await browser.close();
