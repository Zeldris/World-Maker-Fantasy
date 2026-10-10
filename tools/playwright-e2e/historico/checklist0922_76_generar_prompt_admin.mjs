import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto('http://localhost:5173/admin/enciclopedia', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByText(/ORCOS.*HIJOS DEL ESTALLIDO/i).click();
await page.waitForTimeout(1000);

// Clicar el primer NPC de la lista expandida
const primerNpc = page.locator('button').filter({ hasText: /./ }).nth(20);
await page.screenshot({ path: 'checklist0922_76_lista_orcos.png', fullPage: true });

const ht = await page.locator('body').innerText();
console.log(ht.slice(ht.indexOf('ORCOS'), ht.indexOf('ORCOS') + 800));

await browser.close();
