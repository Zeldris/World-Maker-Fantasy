// QA-125: una pelea en una orden: si hay `x` e `y`, se acerca (mover.js); pulsa «Interactuar»
// (interactuar.js); si la escena ofrece «Combatir», la elige (opcion.js), y juega `rondas` de combate con
// `ataque` y `defensa` (combate.js). Solo con `orden.sh --ayuda pelear`: lee las otras ayudas del disco.
async (page) => {
  const tk = await page.evaluate(() => window.tk || {});
  const fs = await import('node:fs');
  const dir = globalThis.AYUDAS_DIR; // lo pone orden.sh
  if (!dir) return 'pelear.js solo va con orden.sh --ayuda pelear';
  const ayuda = (n) => eval(fs.readFileSync(`${dir}/${n}.js`, 'utf8'));
  const con = async (n, params) => {
    await page.evaluate((p) => { window.tk = p }, params);
    return await ayuda(n)(page);
  };
  const salida = [];
  if (tk.x != null && tk.y != null) salida.push('MOVER: ' + (await con('mover', { x: tk.x, y: tk.y })).slice(0, 300));
  let escena = await con('interactuar', {});
  salida.push('ESCENA: ' + escena.slice(0, 400));
  if (!/^COMBATE/.test(escena)) {
    if (!(await page.locator('[data-opcion]', { hasText: /Combatir/i }).count())) return salida.join('\n') + '\nSin «Combatir» en la escena: sigue con opcion.js';
    escena = await con('opcion', { opcion: 'Combatir' });
    if (!/^COMBATE/.test(escena)) return salida.join('\n') + '\nTras «Combatir»: ' + escena.slice(0, 300);
  }
  salida.push('COMBATE: ' + (await con('combate', { ataque: tk.ataque, defensa: tk.defensa, rondas: tk.rondas ?? 3 })));
  return salida.join('\n');
}
