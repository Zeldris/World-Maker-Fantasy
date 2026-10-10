import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Un Goirnte Renegado aparece entre las rocas imantadas y lo ataco directamente con mi hacha.');
await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();
await page.waitForTimeout(30000);
await page.screenshot({ path: 'screenshots/racial_08_reintentar.png', fullPage: true });

await browser.close();
