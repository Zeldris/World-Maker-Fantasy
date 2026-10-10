import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
for (let i = 0; i < 20; i++) {
  const composerVal = page.getByRole('textbox', { name: 'Acción de tu personaje' });
  const enabled = await composerVal.isEnabled().catch(() => false);
  const ariaDisabled = await composerVal.getAttribute('aria-disabled').catch(() => null);
  if (ariaDisabled !== 'true') { console.log('Narración terminada, intento', i); break; }
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: 'screenshots/paso17_narracion_lista.png', fullPage: true });
await browser.close();
