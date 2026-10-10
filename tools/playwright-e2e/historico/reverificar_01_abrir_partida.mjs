import { chromium } from 'playwright';

const SAVE_ID = 'cmtpq01bm0001rik3sb7hw6nn';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('console', (msg) => console.log(`[console.${msg.type()}]`, msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure()?.errorText));
page.on('response', (res) => {
  if (res.status() >= 400) console.log('[response error]', res.status(), res.url());
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(6000);

await page.screenshot({ path: 'screenshot-01-abrir.png', fullPage: false });
console.log('URL:', page.url());
console.log('Título de pestaña:', await page.title());

const bodyText = await page.textContent('body');
console.log('Contiene "Cargando":', bodyText.includes('Cargando'));
console.log('Contiene "Error":', bodyText.includes('Error'));
console.log('Longitud bodyText:', bodyText.trim().length);
console.log('Primeros 500 chars:', JSON.stringify(bodyText.trim().slice(0, 500)));

const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML ?? '(no root)');
console.log('innerHTML de #root:', rootHtml);

await browser.close();
