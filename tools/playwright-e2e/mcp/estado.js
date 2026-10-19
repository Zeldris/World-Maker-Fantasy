// QA-46: estado de la partida en texto, sin captura. QA-104 (2026-10-19): en unas 10 líneas lo que hay que
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
          .slice(-lineasDiario)
          .join('\n')
      : '';
  const iCombate = texto.search(/Combate —|COMBATE —/);
  const combate = iCombate >= 0 ? texto.slice(iCombate, iCombate + 500).replace(/\n{2,}/g, '\n') : '';
  // QA-76: los avisos se buscan elemento a elemento (párrafos y encabezados: «¡Victoria!» va en un h3).
  const parrafos = await page
    .locator('p, h1, h2, h3, h4, li')
    .evaluateAll((els) => els.map((el) => Array.from(el.childNodes).map((n) => n.textContent || '').join(' ').replace(/\s+/g, ' ').trim()));
  const avisos = parrafos.filter((t) => /busca tu atención|te corta el paso|Te topas con|te golpea|Has caído|Victoria|Derrota|CONVALECIENTE/i.test(t)).slice(-3);
  return [
    'HUD: ' + hud,
    modales.length ? 'MODALES: ' + modales.join(' > ') : '',
    tarjeta ? 'TARJETA: ' + simulado(tarjeta) : '',
    avisos.length ? 'AVISOS: ' + avisos.join(' | ') : '',
    'DIARIO:\n' + diario,
    combate ? 'COMBATE:\n' + combate : '',
  ]
    .filter(Boolean)
    .join('\n');
}
