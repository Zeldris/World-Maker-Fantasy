import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/bonus_02_panel_combate.png', fullPage: true });

await browser.close();
