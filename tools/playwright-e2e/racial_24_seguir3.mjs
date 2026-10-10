import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);
await page.getByText('FICHA DEL RIVAL').click();
await page.waitForTimeout(500);
await page.getByText('Ataque Básico', { exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();
await page.waitForTimeout(30000);
await page.screenshot({ path: 'screenshots/racial_24_seguir3.png', fullPage: true });

await browser.close();
