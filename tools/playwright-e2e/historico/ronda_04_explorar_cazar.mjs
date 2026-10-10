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

const habilidadesTab = page.getByRole('button', { name: /habilidades/i }).first();
await habilidadesTab.click();
await page.waitForTimeout(1000);
await page.getByText('Cazar', { exact: true }).click();
await page.waitForTimeout(1500);

const explorarBtn = page.getByRole('button', { name: /explorar/i });
console.log('Botón Explorar visible:', await explorarBtn.isVisible().catch(() => false));
await explorarBtn.click();
await page.waitForTimeout(2500);

await page.screenshot({ path: 'screenshot-mi-04-tras-explorar.png', fullPage: false });
const bodyText = await page.textContent('body');
console.log('Longitud body:', bodyText.length);

await browser.close();
