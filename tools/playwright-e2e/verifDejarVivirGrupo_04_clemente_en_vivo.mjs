import { chromium } from 'playwright';
const SAVE_ID = 'cmtl4zuqf0001ritmvznxtjst';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);

let bodyText = await page.locator('body').innerText();
console.log('ANTES — ¿Contiene "ESTÁ CONVALECIENTE"?', bodyText.includes('ESTÁ CONVALECIENTE'));

const clementeBtn = page.getByRole('button', { name: /^clemente$/i });
await clementeBtn.click();
await page.waitForTimeout(2500);

bodyText = await page.locator('body').innerText();
console.log('DESPUÉS (sin recargar) — ¿Contiene "ESTÁ CONVALECIENTE"?', bodyText.includes('ESTÁ CONVALECIENTE'));
await page.screenshot({ path: 'screenshots/verifDejarVivirGrupo_04_tras_clemente_en_vivo.png', fullPage: true });

await browser.close();
console.log('OK');
