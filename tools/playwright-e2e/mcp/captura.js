// QA-46, QA-149: captura de la pantalla en .playwright-mcp/<window.tk.nombre o «captura»>.jpg (luego, Read).
// Por defecto JPEG de calidad 50. `tk`: `selector` (recorta a ese elemento), `clip` ({x,y,width,height}),
// `calidad` (1-100), `completo: true` (PNG a tamaño completo y página entera).
async (page) => {
  const { nombre, selector, clip, calidad, completo } = await page.evaluate(() => window.tk || {});
  const ruta = `.playwright-mcp/${nombre || 'captura'}.${completo ? 'png' : 'jpg'}`;
  const opc = { path: ruta, ...(completo ? { type: 'png', fullPage: true } : { type: 'jpeg', quality: calidad ?? 50 }) };
  if (clip) opc.clip = clip;
  if (selector) await page.locator(selector).first().screenshot(opc);
  else await page.screenshot(opc);
  return ruta;
}
