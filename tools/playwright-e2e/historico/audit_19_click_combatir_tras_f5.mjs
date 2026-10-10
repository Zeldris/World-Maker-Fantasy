import { chromium } from 'playwright';

const SAVE_ID = 'cmtj2rzh50005ririptsnf82i';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /Combatir/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/audit_19_panel_combate_tras_f5.png', fullPage: true });
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones:', JSON.stringify(buttons));
await browser.close();
