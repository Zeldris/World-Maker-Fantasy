import { chromium } from 'playwright';

const SAVE_ID = 'cmtj2rzh50005ririptsnf82i';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '✨ Habilidades' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Combate' }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/audit_10_habilidades_combate_sin_clase.png', fullPage: true });

const text = await page.locator('body').innerText();
console.log(text.substring(text.indexOf('Habilidades'), text.indexOf('Habilidades') + 2000));

await browser.close();
