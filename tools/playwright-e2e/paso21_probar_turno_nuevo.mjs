import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('response', (res) => {
  if (res.url().includes('/turn/') || res.url().includes('/classify')) console.log('RED:', res.status(), res.url());
});
page.on('requestfailed', (req) => console.log('FALLÓ:', req.url(), req.failure()?.errorText));

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(1500);
const composerDisabled = await page.getByRole('textbox', { name: 'Acción de tu personaje' }).getAttribute('aria-disabled').catch(() => null);
console.log('Composer disabled:', composerDisabled);
await page.screenshot({ path: 'screenshots/paso21_estado.png', fullPage: true });
await browser.close();
