import { chromium } from 'playwright';

const SAVE_ID = 'cmtj2rzh50005ririptsnf82i';
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/aud4_f5_01_recien_cargado.png', fullPage: true });
console.log('Cargado tras F5, URL:', page.url());

const bodyText = await page.locator('body').innerText();
console.log('--- BODY TEXT (primeros 2500 chars) ---');
console.log(bodyText.slice(0, 2500));

// Comprobar estado del composer/Actuar
const actuarBtn = page.getByRole('button', { name: /^Actuar$/ }).nth(0);
const disabled = await actuarBtn.isDisabled().catch(() => 'N/A');
console.log('--- ACTUAR disabled?', disabled);

await browser.close();
