import { chromium } from 'playwright';

const SAVE_ID = 'cmtmlfk420025ri85hnrpxy66';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(30000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3500);
await page.screenshot({ path: 'screenshots/verif_grupo_09_diag.png', fullPage: true });

const bodyText = await page.locator('body').innerText();
console.log('--- ultimos 800 caracteres visibles ---');
console.log(bodyText.slice(-800));

await browser.close();
