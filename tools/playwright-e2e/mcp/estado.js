// QA-46: estado de la partida en texto, sin captura: HUD, últimas líneas del diario y, si hay combate,
// el panel de combate. Uso: browser_run_code_unsafe con filename "tools/playwright-e2e/mcp/estado.js".
async (page) => {
  const texto = await page.locator('body').innerText();
  const hud = ((await page.locator('banner, header').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const iDiario = texto.indexOf('Lo que haces, dices y percibes');
  const iMundo = texto.indexOf('\nEl mundo\n');
  const diario = iDiario >= 0 ? texto.slice(iDiario, iMundo > iDiario ? iMundo : undefined).trim().slice(-900) : '';
  const iCombate = texto.search(/Combate —|COMBATE —/);
  const combate = iCombate >= 0 ? texto.slice(iCombate, iCombate + 700).replace(/\n{2,}/g, '\n') : '';
  const avisos = (texto.match(/[^\n]*(busca tu atención|te corta el paso|Te topas con|Has caído|Victoria|Derrota|CONVALECIENTE)[^\n]*/gi) || []).slice(-4);
  return ['HUD: ' + hud, 'AVISOS: ' + avisos.join(' | '), 'DIARIO (final):\n' + diario, combate ? 'COMBATE:\n' + combate : ''].filter(Boolean).join('\n\n');
}
