import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.getByText('Cerrar ✕').first().click({ timeout: 8000 }).catch(async () => {
  await page.getByText('✕', { exact: true }).first().click({ timeout: 8000 });
});
await page.waitForTimeout(800);
console.log('Mapa cerrado');
