import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(1500);
const esperando = page.getByText('Esperando la narración de tu último turno...');
const start = Date.now();
await esperando.waitFor({ state: 'hidden', timeout: 180000 });
console.log('Turno resuelto tras', ((Date.now() - start) / 1000).toFixed(1), 's más de espera');
await page.screenshot({ path: 'screenshots/paso42_nemo_resuelto.png', fullPage: true });
await browser.close();
