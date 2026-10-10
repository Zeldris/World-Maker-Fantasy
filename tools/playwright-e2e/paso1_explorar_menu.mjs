import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Helek Sirik/ }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/paso1_menu_mundo.png', fullPage: true });
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones tras elegir mundo:', JSON.stringify(buttons));
await browser.close();
