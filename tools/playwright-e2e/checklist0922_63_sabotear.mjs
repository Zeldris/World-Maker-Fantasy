import { chromium } from 'playwright';

const SAVE_ID = 'cmubqa3ev000iri4u4d4lcko6';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const requests = [];
page.on('response', async (res) => {
  if (res.request().method() === 'POST' && res.url().includes('sabotear')) {
    console.log('Respuesta sabotear:', res.status(), await res.text().catch(() => ''));
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const reinoBtn = page.locator('button', { hasText: 'Reino' }).first();
await reinoBtn.click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /diplomacia/i }).click();
await page.waitForTimeout(1000);
await page.getByText('Clan Helsig').click();
await page.waitForTimeout(1000);

const sabotearBtn = page.getByRole('button', { name: /^sabotear$/i });
await sabotearBtn.click();
console.log('Pulsado SABOTEAR, esperando respuesta...');
await page.waitForTimeout(5000);

await page.screenshot({ path: 'checklist0922_63_tras_sabotear.png', fullPage: true });
const ht = await page.locator('body').innerText();
console.log(ht.slice(-1500));

await browser.close();
