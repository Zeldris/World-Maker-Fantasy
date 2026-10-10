import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/tr13_estado_inicial.png', fullPage: true });

const starButton = page.locator('button').filter({ hasText: '✨' });
await starButton.nth(1).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/tr13_skillbar.png', fullPage: true });
const text = await page.locator('body').innerText();
console.log('contiene "Aprender oficio":', text.includes('Aprender oficio'));
await browser.close();
