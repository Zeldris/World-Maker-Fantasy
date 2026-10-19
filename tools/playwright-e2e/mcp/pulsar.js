// Pulsa lo que tenga ese texto (window.tk.texto; exacto, o `window.tk.contiene: true`), el visible más arriba en
// capas, con el ratón en su centro: sirve para las tarjetas que Playwright no da por «estables» (animación) y
// para lo que no es un `button` (pestañas de texto). Con `window.tk.mantener: ms`, lo mantiene pulsado (los
// botones «Mantén para…»). Después, `estado.js` para ver qué ha pasado.
async (page) => {
  const { texto, contiene = false, mantener = 0 } = await page.evaluate(() => window.tk || {});
  if (!texto) return 'Falta window.tk.texto';
  const caja = await page.evaluate(
    ({ texto, contiene }) => {
      // Sin distinguir mayúsculas: el CSS (`uppercase`) cambia lo que se ve, no el texto («MANTÉN PARA FUNDAR»).
      const buscado = texto.toLowerCase();
      const casa = (t) => (contiene ? t.toLowerCase().includes(buscado) : t.toLowerCase() === buscado);
      // Sin el emoji o icono del principio («✨Habilidades», «🏛️Fundar ayuntamiento»).
      const limpio = (t) => t.replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}¿¡«]+/u, '');
      // Primero lo pulsable entero (botones, pestañas, enlaces) por todo su texto; si no, cualquier elemento por
      // su texto propio.
      const pulsables = Array.from(document.querySelectorAll('button,[role="tab"],[role="button"],a')).filter(
        (el) => el.offsetParent !== null && (casa(limpio(el.textContent || '')) || casa((el.getAttribute('aria-label') || '').trim())),
      );
      const todos = pulsables.length ? pulsables : Array.from(document.querySelectorAll('body *')).filter((el) => {
        if (el.offsetParent === null) return false;
        const propio = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
        const etiqueta = (el.getAttribute('aria-label') || '').trim();
        return casa(propio) || casa(etiqueta);
      });
      const el = todos.pop();
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    { texto, contiene },
  );
  if (!caja) return `No hay nada visible con el texto «${texto}»`;
  await page.mouse.move(caja.x, caja.y);
  await page.mouse.down();
  await page.waitForTimeout(mantener || 50);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  return `pulsado «${texto}»`;
}
