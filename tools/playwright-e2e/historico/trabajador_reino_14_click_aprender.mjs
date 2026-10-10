import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);

const starButton = page.locator('button').filter({ hasText: '✨' });
await starButton.nth(1).click();
await page.waitForTimeout(1000);

// El botón con el emoji del pergamino 📜
const pergamino = page.locator('button').filter({ hasText: '📜' });
console.log('botones pergamino:', await pergamino.count());
const title = await pergamino.first().getAttribute('title').catch(() => null);
const aria = await pergamino.first().getAttribute('aria-label').catch(() => null);
console.log('title:', title, 'aria-label:', aria);
await pergamino.first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/tr14_tras_click_aprender.png', fullPage: true });
await browser.close();
