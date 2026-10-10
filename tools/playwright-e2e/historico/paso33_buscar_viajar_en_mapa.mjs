import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '🗺️ Mapa' }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Mapa', exact: true }).click();
await page.waitForTimeout(1000);
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones en tab Mapa:', JSON.stringify(buttons));
await page.screenshot({ path: 'screenshots/paso33_tab_mapa_mundo.png', fullPage: true });
await browser.close();
