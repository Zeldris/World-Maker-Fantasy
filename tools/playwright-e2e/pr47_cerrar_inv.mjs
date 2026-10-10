import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const cerrarBtn = page.getByText('Cerrar', { exact: false }).first();
await cerrarBtn.click({ timeout: 10000 });
await page.waitForTimeout(1000);
console.log(await page.locator('body').innerText());
await browser.close();
