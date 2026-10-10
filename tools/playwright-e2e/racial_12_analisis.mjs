import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByRole('tab', { name: 'Análisis' }).click().catch(() => page.getByText('Análisis', { exact: true }).click());
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/racial_12_analisis.png', fullPage: true });

await browser.close();
