import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const bodyText = await page.textContent('body');
console.log('Menciona "COMBATIR":', bodyText.includes('COMBATIR'));
console.log('Menciona "Ruptidar":', bodyText.includes('Ruptidar'));

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
console.log('Composer aria-disabled:', await composer.getAttribute('aria-disabled').catch(() => 'N/A'));

await page.screenshot({ path: 'screenshot-mi-15-tras-recargar.png', fullPage: false });

await browser.close();
