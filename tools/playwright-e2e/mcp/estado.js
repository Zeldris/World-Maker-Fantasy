// QA-46: estado de la partida en texto, sin captura: HUD, últimas líneas del diario y, si hay combate,
// el panel de combate. Uso: browser_run_code_unsafe con filename "tools/playwright-e2e/mcp/estado.js".
async (page) => {
  // QA-60: lo que escribe el Ollama simulado (`narrationFor` de tools/ci/mock-ollama.mjs, sus dos frases
  // fijas) sale como «[simulado]», para no confundirlo con un fallo del juego.
  const texto = (await page.locator('body').innerText()).replace(
    /El personaje (lleva a cabo lo que se propone|observa con atención a su alrededor)[^\n]*?nada fuera de lo común ocurre\./g,
    '[simulado]',
  );
  const hud = ((await page.locator('banner, header').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const iDiario = texto.indexOf('Lo que haces, dices y percibes');
  const iMundo = texto.indexOf('\nEl mundo\n');
  const diario = iDiario >= 0 ? texto.slice(iDiario, iMundo > iDiario ? iMundo : undefined).trim().slice(-900) : '';
  const iCombate = texto.search(/Combate —|COMBATE —/);
  const combate = iCombate >= 0 ? texto.slice(iCombate, iCombate + 700).replace(/\n{2,}/g, '\n') : '';
  // QA-76: los avisos se buscan elemento a elemento (párrafos y encabezados: «¡Victoria!» va en un h3).
  // En `innerText` los nombres van en fichas (chips) en otra línea y la frase quedaba sin quién («  te
  // golpea…»); aquí cada trozo del elemento se une con un espacio, así tampoco se pegan las palabras.
  const parrafos = await page
    .locator('p, h1, h2, h3, h4, li')
    .evaluateAll((els) => els.map((el) => Array.from(el.childNodes).map((n) => n.textContent || '').join(' ').replace(/\s+/g, ' ').trim()));
  const avisos = parrafos.filter((t) => /busca tu atención|te corta el paso|Te topas con|te golpea|Has caído|Victoria|Derrota|CONVALECIENTE/i.test(t)).slice(-4);
  return ['HUD: ' + hud, 'AVISOS: ' + avisos.join(' | '), 'DIARIO (final):\n' + diario, combate ? 'COMBATE:\n' + combate : ''].filter(Boolean).join('\n\n');
}
