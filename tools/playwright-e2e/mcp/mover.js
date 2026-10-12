// QA-46: en «Moverte por la zona», pulsa un punto del mapa (window.tk.x, window.tk.y: píxeles de la
// pantalla, como en una captura de 1280×720), acepta «Ir hasta aquí» si sale y espera a llegar o a un
// encuentro. Devuelve el aviso del encuentro (si hay) y la cabeza de la lista de la zona.
async (page) => {
  const { x, y } = await page.evaluate(() => window.tk || {});
  if (x == null || y == null) return 'Faltan window.tk.x y window.tk.y';
  if (!(await page.getByText('Moverte por la zona').nth(1).isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Moverte por la zona' }).click();
    await page.waitForTimeout(2000);
  }
  await page.mouse.click(x, y);
  await page.waitForTimeout(1200);
  const ir = page.getByText('Ir hasta aquí');
  if (await ir.count()) await ir.first().click();
  let aviso = '';
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const t = await page.locator('body').innerText();
    const m = t.match(/[^\n]*(busca tu atención|te corta el paso|se abalanza|Te topas con)[^\n]*(\n[^\n]*){0,3}/i);
    if (m) { aviso = m[0]; break; }
    if (!/llegas a las/.test(t)) break;
  }
  const t = await page.locator('body').innerText();
  const iZona = t.indexOf('Territorio de');
  return ['AVISO: ' + (aviso || '(ninguno)'), 'ZONA:\n' + (iZona >= 0 ? t.slice(iZona, iZona + 500) : '')].join('\n\n');
}
