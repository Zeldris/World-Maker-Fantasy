import { chromium } from 'playwright';

const SAVE_ID = 'cmteh1ax3003frietev2anlpo';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

await page.screenshot({ path: 'screenshots/verif04_ver_resultado_rastreo.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('=== estado tras rastreo ===');
console.log(bodyText.slice(0, 4500));

// Comprobar si hay panel de combate visible
const combatirBtn = page.getByRole('button', { name: /combatir/i });
console.log('\nboton Combatir presente:', await combatirBtn.count());
const huirBtn = page.getByRole('button', { name: /huir/i });
console.log('boton Huir presente:', await huirBtn.count());

await browser.close();
console.log('OK');
