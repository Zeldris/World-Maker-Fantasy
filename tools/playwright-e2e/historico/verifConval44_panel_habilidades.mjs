import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const habilidadesBtn = page.locator('button', { hasText: 'Habilidades' });
await habilidadesBtn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/verifConval44_panel_habilidades.png', fullPage: true });

const cazarChip = page.getByText('Cazar', { exact: true });
console.log('Cazar count:', await cazarChip.count());

await browser.close();
console.log('OK');
