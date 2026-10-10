import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/verifConval56_check_final.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-1500));

const actuarLibre = page.getByRole('button', { name: /^actuar$/i }).first();
const disabled = await actuarLibre.isDisabled().catch(() => 'N/A');
console.log('Botón Actuar (composer libre) deshabilitado:', disabled);

const combatirCount = await page.locator('button', { hasText: 'COMBATIR' }).count();
console.log('Botón COMBATIR presente:', combatirCount > 0);

await browser.close();
console.log('OK');
