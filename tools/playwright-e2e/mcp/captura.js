// QA-46: captura de la pantalla en .playwright-mcp/<window.tk.nombre o «captura»>.png (luego, Read).
async (page) => {
  const { nombre } = await page.evaluate(() => window.tk || {});
  const ruta = `.playwright-mcp/${nombre || 'captura'}.png`;
  await page.screenshot({ path: ruta });
  return ruta;
}
