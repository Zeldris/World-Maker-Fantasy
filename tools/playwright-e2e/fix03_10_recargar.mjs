import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtj5zvk1003uriri0iuzjw6m', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const modalVisible = await page.getByText('Elige tu clase').isVisible().catch(() => false);
console.log('Modal visible tras recargar:', modalVisible);

await browser.close();
