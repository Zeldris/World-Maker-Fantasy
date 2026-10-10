import { chromium } from 'playwright';

const SAVE_ID = 'cmts9uaom001prijp2ly3xa5w';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await page.getByText('Cazador', { exact: true }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'ACEPTAR' }).click();
await page.waitForTimeout(3000);

await page.screenshot({ path: 'screenshot-ronda-03-clase-confirmada.png', fullPage: false });
const bodyText = await page.textContent('body');
console.log('Menciona "Cazador":', bodyText.includes('Cazador'));
console.log('Composer visible (aria-label):', await page.getByRole('textbox', { name: 'Acción de tu personaje' }).isVisible());

await browser.close();
