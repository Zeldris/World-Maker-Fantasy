import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto('http://localhost:5173/admin/enciclopedia', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.screenshot({ path: 'checklist0922_68_admin_enciclopedia.png', fullPage: true });

const ht = await page.locator('body').innerText();
console.log(ht.slice(0, 1500));

await browser.close();
