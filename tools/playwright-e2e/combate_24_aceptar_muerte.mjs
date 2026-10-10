import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2500);

const aceptarBtn = page.getByRole('button', { name: /^aceptar$/i });
if (await aceptarBtn.count()) {
  await aceptarBtn.click();
  console.log('Pulsado ACEPTAR (resolviendo muerte permanente).');
  await page.waitForTimeout(4000);
} else {
  console.log('No se encontró el botón ACEPTAR — puede que ya se haya resuelto.');
}
await page.screenshot({ path: 'screenshots/tras_aceptar_muerte.png' });
console.log('Captura final guardada.');
await browser.close();
