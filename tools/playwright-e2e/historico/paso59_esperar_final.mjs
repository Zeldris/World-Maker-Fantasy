import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(1500);
const esperando = page.getByText('Esperando la narración de tu último turno...');
const start = Date.now();
const busy = await esperando.isVisible().catch(() => false);
console.log('Sigue ocupado al cargar:', busy);
if (busy) {
  await esperando.waitFor({ state: 'hidden', timeout: 90000 });
  console.log('Resuelto tras', ((Date.now() - start) / 1000).toFixed(1), 's más de espera');
}
await browser.close();
