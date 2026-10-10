import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto('http://localhost:5173/admin/enciclopedia', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByText(/ORCOS.*HIJOS DEL ESTALLIDO/i).click();
await page.waitForTimeout(1000);

await page.getByText('Orco enfurecido', { exact: true }).click();
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_77_detalle_orco.png', fullPage: true });

const buttons = await page.getByRole('button').all();
for (const b of buttons) {
  const name = await b.innerText().catch(() => '');
  const visible = await b.isVisible().catch(() => false);
  if (visible && /generar|prompt|imagen/i.test(name)) console.log('botón:', JSON.stringify(name.trim()));
}

await browser.close();
