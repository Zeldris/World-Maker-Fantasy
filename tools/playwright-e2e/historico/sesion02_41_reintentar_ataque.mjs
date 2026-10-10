import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
const visible = await composer.count();
console.log('composer visible count:', visible);

if (visible > 0) {
  await composer.click();
  await composer.fill('Ataco a Ruptidar con mi hacha.');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  console.log('Turno enviado, esperando...');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'screenshots/sesion02_41_tras_reintentar.png', fullPage: true });
  console.log(await page.locator('body').innerText());
} else {
  console.log('Composer no visible, body:');
  console.log(await page.locator('body').innerText());
}

await browser.close();
console.log('OK');
