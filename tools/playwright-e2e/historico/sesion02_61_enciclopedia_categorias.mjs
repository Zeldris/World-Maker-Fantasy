import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Enciclopedia', { exact: true }).click();
await page.waitForTimeout(1500);
console.log('--- ENCICLOPEDIA (lista) ---');
console.log(await page.locator('body').innerText());
await page.screenshot({ path: 'screenshots/sesion02_61_enciclopedia_lista.png', fullPage: true });

// Intentar entrar en una categoría (Fauna) y luego en una entrada.
const faunaTab = page.getByText('Fauna', { exact: true }).first();
if (await faunaTab.count() > 0) {
  await faunaTab.click();
  await page.waitForTimeout(1500);
  console.log('--- ENCICLOPEDIA: FAUNA ---');
  console.log(await page.locator('body').innerText());
  await page.screenshot({ path: 'screenshots/sesion02_61_enciclopedia_fauna.png', fullPage: true });

  const ruptidarEntry = page.getByText('Ruptidar', { exact: true }).first();
  if (await ruptidarEntry.count() > 0) {
    await ruptidarEntry.click();
    await page.waitForTimeout(1500);
    console.log('--- ENCICLOPEDIA: RUPTIDAR DETALLE ---');
    console.log(await page.locator('body').innerText());
    await page.screenshot({ path: 'screenshots/sesion02_61_enciclopedia_ruptidar.png', fullPage: true });
  }
}

await browser.close();
console.log('OK');
