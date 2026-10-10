import { chromium } from 'playwright';

const SAVE_ID = 'cmtmn2kqp0001rijc91hspbom';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(60000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const composer = page.getByRole('textbox');
await composer.click();
await composer.fill('Exploro con calma los alrededores, atento a cualquier rastro o señal.');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^actuar$/i }).first().click();
console.log('Turno 1 enviado, esperando resolución...');
await page.waitForTimeout(20000);
await page.screenshot({ path: 'screenshots/pc_02_turno1.png', fullPage: true });
console.log('done');
await browser.close();
