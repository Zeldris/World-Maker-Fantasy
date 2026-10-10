import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage(); // viewport estándar 1280x720
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByText('Mapa', { exact: true }).click();
await page.waitForTimeout(1500);

// Posiciona el ratón DENTRO del modal (sobre el texto "Mapa" del título) antes de rodar la rueda.
await page.mouse.move(640, 300);
await page.mouse.wheel(0, 600);
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/sesion02_12_mapa_scroll_real.png', fullPage: true });
console.log(await page.locator('body').innerText());
await browser.close();
console.log('OK');
