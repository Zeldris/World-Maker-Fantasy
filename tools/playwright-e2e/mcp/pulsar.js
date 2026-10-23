// Pulsa lo que tenga ese texto (window.tk.texto; exacto, o `window.tk.contiene: true`; también vale solo
// `{"contiene":"…"}`), el visible más arriba en capas, con el ratón en su centro: sirve para las tarjetas que Playwright no da por «estables» (animación) y
// para lo que no es un `button` (pestañas de texto). Con `window.tk.mantener: ms`, lo mantiene pulsado (los
// botones «Mantén para…»). Después, `estado.js` para ver qué ha pasado.
async (page) => {
  const tk = await page.evaluate(() => window.tk || {});
  const { mantener = 0, forzar = false } = tk;
  // `{"contiene":"Ir hasta"}` solo: el texto parcial es la búsqueda. `{"texto":"…","contiene":true}` como siempre.
  const texto = tk.texto || (typeof tk.contiene === 'string' ? tk.contiene : '');
  const contiene = tk.contiene === true || (!tk.texto && typeof tk.contiene === 'string');
  if (!texto) return 'ERROR: falta window.tk.texto (o window.tk.contiene con el texto): {"texto":"Reanudar"} exacto, {"contiene":"Ir hasta"} parcial';
  const res = await page.evaluate(
    ({ texto, contiene, forzar }) => {
      // Sin distinguir mayúsculas: el CSS (`uppercase`) cambia lo que se ve, no el texto («MANTÉN PARA FUNDAR»).
      const buscado = texto.toLowerCase();
      // También sin el número de atajo del principio («1 Reanudar» de los menús con `data-opcion`).
      const casa = (t) => {
        const m = t.toLowerCase();
        return [m, m.replace(/^\d+\s+(?=\D)/, '')].some((u) => (contiene ? u.includes(buscado) : u === buscado));
      };
      // Sin el emoji o icono del principio («✨Habilidades», «🏛️Fundar ayuntamiento»).
      const limpio = (t) => t.replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}¿¡«]+/u, '');
      // Primero lo pulsable entero (botones, pestañas, enlaces) por todo su texto; si no, cualquier elemento por
      // su texto propio.
      // Con una capa abierta (modal o cajón), se busca primero dentro de ella: «Reino» es a la vez una pestaña del
      // cajón de Habilidades y una de la barra lateral. La de arriba es la última en el documento (los modales se
      // montan al final del body); si el texto no está en ella (un aviso fuera de la capa), en todo el documento.
      const capas = [
        ...document.querySelectorAll('[role="dialog"]'),
        ...Array.from(document.querySelectorAll('.plank-panel')).filter((el) => /\binset-0\b/.test(el.parentElement?.className ?? '')),
      ]
        .filter((el) => el.offsetParent !== null)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const buscar = (raiz) => {
        const pulsables = Array.from(raiz.querySelectorAll('button,[role="tab"],[role="button"],[role="menuitem"],a')).filter(
          (el) => el.offsetParent !== null && (casa(limpio(el.textContent || '')) || casa((el.getAttribute('aria-label') || '').trim())),
        );
        return pulsables.length ? pulsables : Array.from((raiz === document ? document.body : raiz).querySelectorAll('*')).filter((el) => {
          if (el.offsetParent === null) return false;
          const propio = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
          const etiqueta = (el.getAttribute('aria-label') || '').trim();
          return casa(propio) || casa(etiqueta);
        });
      };
      const arriba = capas.pop();
      let todos = arriba ? buscar(arriba) : [];
      if (!todos.length) todos = buscar(document);
      if (!todos.length) return { error: `No hay nada visible con el texto «${texto}»` };
      // Varias coincidencias: la que de verdad recibe el clic en su centro (no tapada por otro panel), la última del documento
      // (la de más arriba). Una tapada solo se pulsa con `forzar: true` (clic del DOM, no del ratón).
      const midiendo = todos.map((el) => {
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        const desact = el.disabled === true || el.getAttribute('aria-disabled') === 'true';
        return { el, r, desact, libre: !!e && (e === el || el.contains(e)), tapa: e };
      });
      const util = midiendo.filter((m) => m.libre && !m.desact);
      const elegido = util.pop();
      const n = todos.length;
      if (!elegido) {
        const des = midiendo.find((m) => m.desact);
        if (des) return { error: `«${texto}» está deshabilitado (${n} coincidencia${n > 1 ? 's' : ''}); mira estado.js: lo desactivados van entre paréntesis` };
        const t = midiendo[midiendo.length - 1];
        const quien = t.tapa ? `${t.tapa.tagName.toLowerCase()} «${(t.tapa.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)}»` : 'nada (fuera de la pantalla)';
        if (forzar) {
          t.el.click();
          return { forzado: true, n };
        }
        return { error: `«${texto}» está tapado por ${quien}; ciérralo antes (o window.tk.forzar: true para un clic del DOM)` };
      }
      const r = elegido.r;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, n };
    },
    { texto, contiene, forzar },
  );
  if (res.error) return 'ERROR: ' + res.error;
  const varias = res.n > 1 ? ` (${res.n} coincidencias; la visible de más arriba)` : '';
  if (res.forzado) {
    await page.waitForTimeout(1200);
    return `pulsado «${texto}» con clic del DOM (forzado)${varias}`;
  }
  await page.mouse.move(res.x, res.y, { steps: 4 });
  await page.mouse.down();
  await page.waitForTimeout(mantener || 50);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  return `pulsado «${texto}»${varias}`;
}
