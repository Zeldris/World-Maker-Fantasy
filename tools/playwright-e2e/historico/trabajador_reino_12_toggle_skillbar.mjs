import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
const cerrar = page.getByRole('button', { name: /cerrar/i });
if (await cerrar.count() > 0) await cerrar.first().click().catch(() => {});
await page.waitForTimeout(500);

const starButton = page.locator('button').filter({ hasText: '✨' });
await starButton.nth(1).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/tr12_skillbar_abierta.png', fullPage: true });
const text = await page.locator('body').innerText();
console.log('contiene "Aprender oficio":', text.includes('Aprender oficio'));
console.log('body tail:', text.slice(-800));
await browser.close();
