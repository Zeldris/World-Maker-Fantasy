import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
// Viewport más alto para confirmar si el contenido "perdido" existe pero no cabe, vs. si
// simplemente no se renderiza.
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByText('Mapa', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/sesion02_11_mapa_viewport_grande.png', fullPage: true });
await browser.close();
console.log('OK');
