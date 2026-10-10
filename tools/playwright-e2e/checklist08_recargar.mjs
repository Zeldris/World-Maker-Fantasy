import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.reload();
await page.waitForTimeout(2000);

await page.getByRole('button', { name: '✨ Habilidades' }).click();
await page.waitForTimeout(1000);
await page.getByText('Aprender oficio').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/checklist08_01_tras_recargar.png', fullPage: true });

await browser.close();
