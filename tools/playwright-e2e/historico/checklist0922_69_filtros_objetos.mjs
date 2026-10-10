import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto('http://localhost:5173/admin/enciclopedia', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: /objetos/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'checklist0922_69_tab_objetos.png', fullPage: true });

const ht = await page.locator('body').innerText();
console.log(ht.slice(0, 2000));

await browser.close();
