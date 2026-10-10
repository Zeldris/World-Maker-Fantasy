import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
await page.goto('http://localhost:5173');
await page.waitForTimeout(1500);
const btn = page.getByText('Continuar como Gorhorn', { exact: false }).first();
if (await btn.count() > 0) {
  await btn.click();
  await page.waitForTimeout(3000);
}
console.log(await page.locator('body').innerText());
await browser.close(); // solo cierra la CONEXIÓN, no el navegador persistente (connectOverCDP)
