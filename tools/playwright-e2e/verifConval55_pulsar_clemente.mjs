import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const clementeBtn = page.getByRole('button', { name: /^clemente$/i });
await clementeBtn.click();
console.log('--- Clemente pulsado ---');
await page.waitForTimeout(20000);
await page.screenshot({ path: 'screenshots/verifConval55_tras_clemente.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('¿Contiene "CONVALECIENTE"?', bodyText.includes('CONVALECIENTE'));
console.log('¿Contiene "MATAR"?', bodyText.includes('MATAR'));
console.log(bodyText.slice(-2000));

await browser.close();
console.log('OK');
