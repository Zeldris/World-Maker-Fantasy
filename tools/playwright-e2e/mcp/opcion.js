// QA-57: elige una opción de la escena abierta (modo dinámico): `window.tk.opcion` es su número (1, 2…)
// o un trozo de su texto («Huir»). Espera a la vuelta siguiente o a que la escena se cierre y la devuelve.
async (page) => {
  const { opcion } = await page.evaluate(() => window.tk || {});
  if (opcion == null) return 'Falta window.tk.opcion (número o texto)';
  // Las opciones son botones «<n><texto>»: por número, el dígito sin otro detrás (1 no casa con 10); por
  // texto, el trozo tal cual (escapado). Solo botones: un «1 hora después» del diario no cuenta.
  const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patron = typeof opcion === 'number' ? new RegExp(`^\\s*${opcion}(?!\\d)\\s*\\S`) : new RegExp(escapar(String(opcion)), 'i');
  const antes = await page.locator('body').innerText();
  await page.getByRole('button', { name: patron }).first().click();
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
