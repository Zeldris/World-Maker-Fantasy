import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/especializacion_10_modal_de_nuevo.png', fullPage: true });

await page.getByText('Ver clases en la Enciclopedia').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/especializacion_11_enciclopedia.png', fullPage: true });

await browser.close();
