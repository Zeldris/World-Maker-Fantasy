import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

const el = page.getByText('O describe tu acción...');
console.log('count:', await el.count());
const tag = await el.first().evaluate(e => e.tagName);
console.log('tag:', tag);
const attrs = await el.first().evaluate(e => Array.from(e.attributes).map(a => `${a.name}=${a.value}`));
console.log('attrs:', attrs);

await browser.close();
