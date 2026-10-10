import { chromium } from 'playwright';
const SAVE_ID = 'cmtl4ocd60001rie88m9lktdu';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);

const clementeBtn = page.getByRole('button', { name: /^clemente$/i });
await clementeBtn.click();
console.log('--- Clemente pulsado ---');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/verifDejarVivirGrupo_02_tras_clemente.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 3000));

await browser.close();
console.log('OK');
