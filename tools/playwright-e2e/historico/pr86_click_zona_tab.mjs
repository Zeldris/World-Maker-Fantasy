import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.getByText('Zona', { exact: true }).first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/zona1.png' });
console.log('done');
