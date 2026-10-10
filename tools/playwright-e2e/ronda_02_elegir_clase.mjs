import { chromium } from 'playwright';

const SAVE_ID = 'cmts9uaom001prijp2ly3xa5w';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('response', (res) => {
  if (res.status() >= 400) console.log('[response error]', res.status(), res.url());
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const cazadorOption = page.getByText('Cazador', { exact: true });
console.log('Opción Cazador visible:', await cazadorOption.isVisible());
await cazadorOption.click();
await page.waitForTimeout(2500);

await page.screenshot({ path: 'screenshot-ronda-02-clase-elegida.png', fullPage: false });

const bodyText = await page.textContent('body');
console.log('Menciona "Cazador" tras elegir:', bodyText.includes('Cazador'));
console.log('Sigue mostrando "Elige tu clase":', bodyText.includes('Elige tu clase'));

await browser.close();
