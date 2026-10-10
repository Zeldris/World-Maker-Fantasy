import { chromium } from 'playwright';

const SAVE_ID = 'cmtegz0b4001qrieti2l0z1iu';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const mapaBtn = page.getByRole('button', { name: /mapa/i });
await mapaBtn.click({ timeout: 10000 });
await page.waitForTimeout(1500);
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 3000));
await page.screenshot({ path: 'screenshots/verifKirelon12_mapa.png', fullPage: true });

await browser.close();
console.log('OK');
