import { chromium } from 'playwright';

const SAVE_ID = 'cmthp1jyu0009rij1xf2ri09m';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Mapa' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/control_regional_01.png', fullPage: true });

await browser.close();
