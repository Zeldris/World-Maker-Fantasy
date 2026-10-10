import { getPage } from './_conn.mjs';

const { page } = await getPage();
// Buscar el botón/tab "Mapa" en la barra inferior
const mapaBtn = page.getByText('Mapa', { exact: true }).first();
await mapaBtn.click({ timeout: 8000 });
await page.waitForTimeout(1000);
const bodyText = await page.evaluate(() => document.body.innerText).catch((e) => `ERROR: ${e.message}`);
console.log(bodyText.slice(0, 2500));
