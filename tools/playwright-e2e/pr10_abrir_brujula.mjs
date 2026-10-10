import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
// El icono de brújula flotante — buscar por posición aproximada o por role de botón sin texto.
const buttons = await page.locator('button').all();
console.log(`Botones encontrados: ${buttons.length}`);
for (const [i, btn] of buttons.entries()) {
  const box = await btn.boundingBox();
  const text = (await btn.innerText().catch(() => '')).trim();
  if (box && box.x > 600 && box.x < 680 && box.y > 540 && box.y < 600) {
    console.log(`Candidato brújula #${i}: text="${text}" box=${JSON.stringify(box)}`);
  }
}
await browser.close();
