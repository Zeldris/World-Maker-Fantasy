// QA-57: pulsa «Interactuar» en el aviso del encuentro (el del mapa de zona si está abierto; si no, el
// del diario) y devuelve la escena que se abre: título de la vuelta, texto y opciones numeradas.
async (page) => {
  const enMapa = page.getByTestId('encuentro-en-mapa').getByRole('button', { name: 'Interactuar' });
  const boton = (await enMapa.count()) ? enMapa.first() : page.getByRole('button', { name: 'Interactuar' }).last();
  await boton.click();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    const t = await page.locator('body').innerText();
    const k = t.search(/Vuelta \d/);
    if (k >= 0) return t.slice(k, k + 700);
    if (/Combate —/.test(t)) return 'COMBATE abierto (te vieron primero): usa combate.js';
  }
  return 'No se abrió ninguna escena: mira con estado.js o una captura';
}
