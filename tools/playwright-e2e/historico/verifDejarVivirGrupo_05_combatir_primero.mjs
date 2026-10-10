import { chromium } from 'playwright';
const SAVE_ID = 'cmtl4xp2u0001ri0l9lgozq9h';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);

// Abre el panel de combate PRIMERO (openCombat() real, siembra combatNpcStates).
const combatirBtn = page.getByRole('button', { name: /combatir/i });
await combatirBtn.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/verifDejarVivirGrupo_05_panel_abierto.png', fullPage: true });

const clementeBtn = page.getByRole('button', { name: /^clemente$/i });
await clementeBtn.click();
await page.waitForTimeout(2500);

const bodyText = await page.locator('body').innerText();
console.log('DESPUÉS de Combatir+Clemente — ¿Contiene "ESTÁ CONVALECIENTE"?', bodyText.includes('ESTÁ CONVALECIENTE'));
await page.screenshot({ path: 'screenshots/verifDejarVivirGrupo_05_tras_clemente.png', fullPage: true });

await browser.close();
console.log('OK');
