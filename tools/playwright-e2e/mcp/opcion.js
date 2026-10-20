// QA-57: elige una opción de la escena abierta (modo dinámico): `window.tk.opcion` es su número (1, 2…)
// o un trozo de su texto («Huir»). Espera a la vuelta siguiente o a que la escena se cierre y la devuelve.
async (page) => {
  const { opcion } = await page.evaluate(() => window.tk || {});
  if (opcion == null) return 'Falta window.tk.opcion (número o texto)';
  // Las opciones son los botones `[data-opcion]` del modal. Por número, la n-ésima: el número que se ve
  // va en un `span aria-hidden` y no forma parte del nombre del botón (QA-125). Por texto, el trozo tal cual.
  const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const opciones = page.locator('[data-opcion]');
  const boton = typeof opcion === 'number' ? opciones.nth(opcion - 1) : opciones.filter({ hasText: new RegExp(escapar(String(opcion)), 'i') }).first();
  if (!(await boton.count())) return `No hay opción ${JSON.stringify(opcion)}: ${(await opciones.allInnerTexts()).join(' · ') || 'ninguna escena abierta'}`;
  const antes = await page.locator('body').innerText();
  await boton.click();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1500);
    const t = await page.locator('body').innerText();
    if (/Resolviendo/.test(t) || t === antes) continue;
    const k = t.search(/Vuelta \d/);
    if (k >= 0) return t.slice(k, k + 700);
    if (/Combate —/.test(t)) return 'COMBATE abierto: usa combate.js';
    return 'Escena cerrada: mira con estado.js';
  }
  return 'Sin cambios tras 60 s: mira con una captura';
}
