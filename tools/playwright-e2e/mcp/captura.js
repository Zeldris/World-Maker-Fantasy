// QA-46, QA-149: captura de la pantalla en .playwright-mcp/<window.tk.nombre o «captura»>.<jpg|png> (luego, Read).
// QA-218: con `orden.sh --ayuda` (`o.sh captura`) guarda en `tools/playwright-e2e/shots/` (ignorado por git), como `shot()`;
// el driver corre con otra carpeta de trabajo y una ruta relativa acababa en `tools/playwright-e2e/.playwright-mcp/`.
// Misma semántica que shot() de driver.mjs. Por defecto JPEG de calidad 50. `tk`: `calidad` (1-100), `png: true`
// (PNG), `completo: true` (PNG de página entera), `clip` ({x,y,width,height}), `selector` (recorta a ese elemento;
// no admite `clip` ni `completo`: error).
async (page) => {
  const { nombre, selector, clip, calidad, completo, png } = await page.evaluate(() => window.tk || {});
  if (selector && (clip || completo)) throw new Error('captura: con `selector` no se puede usar `clip` ni `completo`');
  const pngFinal = png || completo;
  const carpeta = globalThis.AYUDAS_DIR ? `${globalThis.AYUDAS_DIR.replace(/\/mcp\/?$/, '')}/shots` : '.playwright-mcp'; // AYUDAS_DIR: lo pone orden.sh
  const ruta = `${carpeta}/${nombre || 'captura'}.${pngFinal ? 'png' : 'jpg'}`;
  const opc = { path: ruta, ...(pngFinal ? { type: 'png' } : { type: 'jpeg', quality: calidad ?? 50 }) };
  if (completo) opc.fullPage = true;
  if (clip) opc.clip = clip;
  if (selector) await page.locator(selector).first().screenshot(opc);
  else await page.screenshot(opc);
  return ruta;
}
