// QA-46: en «Moverte por la zona», pulsa un punto del mapa (window.tk.x, window.tk.y: píxeles de la
// pantalla, como en una captura de 1280×720), acepta «Ir hasta aquí» si sale y espera a llegar o a un
// encuentro. Devuelve el aviso del encuentro (si hay) y la cabeza de la lista de la zona.
async (page) => {
  const { x, y } = await page.evaluate(() => window.tk || {});
  if (x == null || y == null) return 'Faltan window.tk.x y window.tk.y';
  // El título del mapa abierto es el único texto «Moverte por la zona» (la brújula solo lo lleva de aria-label).
  if (!(await page.getByText('Moverte por la zona').first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Moverte por la zona' }).click();
    await page.waitForTimeout(2000);
  }
  await page.mouse.click(x, y);
  await page.waitForTimeout(1200);
  const ir = page.getByText('Ir hasta aquí');
  if (await ir.count()) await ir.first().click();
  // Solo el aviso del encuentro en el mapa (`encuentro-en-mapa`): en el texto de toda la página, una
  // entrada vieja del diario («se abalanza…») daba un encuentro que no había.
  let aviso = '';
  const tarjeta = page.getByTestId('encuentro-en-mapa');
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    if (await tarjeta.count()) { aviso = (await tarjeta.first().innerText()).replace(/\n+/g, ' · '); break; }
    if (/Combate —/.test(await page.locator('body').innerText())) { aviso = 'COMBATE abierto (te vieron primero): usa combate.js'; break; }
    if (!(await page.getByRole('button', { name: 'Parar' }).count())) break;
  }
  const t = await page.locator('body').innerText();
  const iZona = t.indexOf('Territorio de');
  return ['AVISO: ' + (aviso || '(ninguno)'), 'ZONA:\n' + (iZona >= 0 ? t.slice(iZona, iZona + 500) : '')].join('\n\n');
}
