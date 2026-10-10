import { chromium } from 'playwright';
const SAVE_ID = 'cmtmlfk420025ri85hnrpxy66';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(45000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
const combatirBtn = page.getByRole('button', { name: /^⚔️ combatir$/i });
if (await combatirBtn.count()) { await combatirBtn.first().click(); await page.waitForTimeout(1200); }
await page.screenshot({ path: 'screenshots/verif_grupo_d_full_context.png', fullPage: true });
await browser.close();
