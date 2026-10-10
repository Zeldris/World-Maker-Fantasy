import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const requests = [];
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('image-prompt')) requests.push(req.url());
});

await page.goto('http://localhost:5173/admin/enciclopedia', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByText(/ORCOS.*HIJOS DEL ESTALLIDO/i).click();
await page.waitForTimeout(1000);
await page.getByText('Orco enfurecido', { exact: true }).click();
await page.waitForTimeout(1000);

const generarBtn = page.getByRole('button', { name: /generar miniatura/i });
await generarBtn.click();
console.log('Pulsado Generar miniatura, esperando...');
await page.waitForTimeout(6000);

await page.screenshot({ path: 'checklist0922_80_prompt_generado.png', fullPage: true });
console.log('Peticiones a image-prompt:', requests);

const ht = await page.locator('body').innerText();
console.log(ht.slice(ht.indexOf('Generar miniatura') - 50, ht.indexOf('Generar miniatura') + 600));

await browser.close();
