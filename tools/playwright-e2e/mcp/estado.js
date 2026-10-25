// QA-46: estado de la partida en texto, sin captura. QA-104 (2026-10-19): en unas 10 líneas lo que hay que
// mirar (también los cajones que no son `role="dialog"`, con sus botones, y los tooltips, que antes solo daba una captura).
//
// mirar en cada paso: HUD (hora, estado, energía), modales abiertos, la tarjeta del encuentro con sus
// botones, avisos, las últimas líneas del diario y, si hay combate, su panel. La captura, solo si algo no
// cuadra o la prueba es visual. Uso: browser_run_code_unsafe con filename "tools/playwright-e2e/mcp/estado.js",
// o `orden.sh --ayuda estado`. Con `window.tk = { diario: N }`, N líneas del diario (3 por defecto).
async (page) => {
  const lineasDiario = (await page.evaluate(() => window.tk?.diario).catch(() => undefined)) ?? 3;
  // QA-60: lo que escribe el Ollama simulado (`narrationFor` de tools/ci/mock-ollama.mjs, sus dos frases
  // fijas) sale como «[simulado]», para no confundirlo con un fallo del juego.
  const simulado = (t) =>
    t.replace(/El personaje (lleva a cabo lo que se propone|observa con atención a su alrededor)[^\n]*?nada fuera de lo común ocurre\./g, '[simulado]');
  const texto = simulado(await page.locator('body').innerText());
  const hud = ((await page.locator('banner, header').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const modales = await page
    .locator('[role="dialog"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') || el.querySelector('h1,h2,h3')?.textContent?.trim() || '(sin título)'));
  // Capas que no son `role="dialog"` (el modal de Habilidades, cajones): la superpuesta de encima, con su
  // título, la pestaña activa y lo que se puede pulsar dentro (antes solo se veía en una captura).
  const capa = await page.evaluate(() => {
    // Los cajones y paneles con tablas de madera (`plank-panel`) que no son un modal `role="dialog"`.
    const arriba = Array.from(document.querySelectorAll('.plank-panel'))
      .filter((el) => el.offsetParent !== null && !el.closest('[role="dialog"]') && el.querySelector('h1,h2,h3'))
      // Superpuesto (un cajón sobre la pantalla), no las columnas fijas del juego («Tu personaje», «El mundo»).
      .filter((el) => /\binset-0\b/.test(el.parentElement?.className ?? ''))
      .pop();
    if (!arriba) return '';
    const titulo = arriba.querySelector('h1,h2,h3')?.textContent?.trim() ?? '';
    const pulsables = Array.from(arriba.querySelectorAll('button,[role="tab"],[role="button"]'))
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
        const activa = el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true' ? '*' : '';
        return el.disabled ? `(${t})` : t + activa;
      })
      .filter(Boolean);
    return titulo ? `${titulo}: ${pulsables.join(' | ')}` : '';
  });
  // Lo escrito en el cuadro de acción (las habilidades y menús lo rellenan antes de «Actuar»).
  const escrito = (
    await page
      .locator('textarea, [contenteditable="true"]')
      .evaluateAll((els) => els.filter((e) => e.offsetParent !== null).map((e) => (e.value ?? e.textContent ?? '').trim()).filter(Boolean))
  ).join(' | ');
  // Tooltips a la vista (requisitos de una construcción, explicaciones).
  const tooltips = await page
    .locator('[role="tooltip"], .tooltip-portal-title')
    .evaluateAll((els) => els.filter((el) => el.offsetParent !== null).map((el) => el.textContent.replace(/\s+/g, ' ').trim()));
  // La tarjeta del encuentro en el mapa (`TarjetaEncuentro`): título, aviso y botones.
  const tarjeta = await page
    .locator('[data-testid="encuentro-en-mapa"]')
    .first()
    .evaluate((el) => {
      const ps = Array.from(el.querySelectorAll('p')).map((p) => p.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const botones = Array.from(el.querySelectorAll('button')).map((b) => (b.disabled ? `(${b.textContent.trim()})` : b.textContent.trim()));
      return `${ps.join(' · ')} [${botones.join(' | ')}]`;
    })
    .catch(() => '');
  const iDiario = texto.indexOf('Lo que haces, dices y percibes');
  const iMundo = texto.indexOf('\nEl mundo\n');
  const diario =
    iDiario >= 0
      ? texto
          .slice(iDiario, iMundo > iDiario ? iMundo : undefined)
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 3)
          .slice(lineasDiario > 0 ? -lineasDiario : 0, lineasDiario > 0 ? undefined : 0)
          .join('\n')
      : '';
  const iCombate = texto.search(/Combate —|COMBATE —/);
  const combate = iCombate >= 0 ? texto.slice(iCombate, iCombate + 500).replace(/\n{2,}/g, '\n') : '';
  // QA-76: los avisos se buscan elemento a elemento (párrafos y encabezados: «¡Victoria!» va en un h3).
  const parrafos = await page
    .locator('p, h1, h2, h3, h4, li')
    .evaluateAll((els) => els.map((el) => Array.from(el.childNodes).map((n) => n.textContent || '').join(' ').replace(/\s+/g, ' ').trim()));
  // P246: la tarjeta del encuentro sale en el diario y, con el mapa abierto, junto a la ficha (ZON-5): el mismo
  // aviso dos veces en pantalla no son dos avisos, así que se enseña una vez.
  // P320: solo frases cortas (un aviso, no una ficha): la nota de trasfondo de Gorhorn o la descripción larga
  // de un bestiario también dicen «convaleciente» y acababan pegadas en el cuerpo del aviso.
  const avisos = parrafos
    .filter((t) => t.length <= 160)
    .filter((t) => /busca tu atención|te corta el paso|Te topas con|te golpea|Has caído|Victoria|Derrota|CONVALECIENTE/i.test(t))
    .filter((t, i, todos) => todos.indexOf(t) === i)
    .slice(-3);
  return [
    'HUD: ' + hud,
    modales.length ? 'MODALES: ' + modales.join(' > ') : '',
    capa ? 'CAPA: ' + capa : '',
    tooltips.length ? 'TOOLTIP: ' + tooltips.join(' | ') : '',
    escrito ? 'ESCRITO: ' + escrito : '',
    tarjeta ? 'TARJETA: ' + simulado(tarjeta) : '',
    avisos.length ? 'AVISOS: ' + avisos.join(' | ') : '',
    diario ? 'DIARIO:\n' + diario : '',
    combate ? 'COMBATE:\n' + combate : '',
  ]
    .filter(Boolean)
    .join('\n');
}
