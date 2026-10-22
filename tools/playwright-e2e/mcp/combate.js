// QA-57: juega rondas de combate. `window.tk`: `ataque` y `defensa` (nombre de la habilidad, p. ej.
// «Estocada Veloz» y «Defenderse»), `rondas` (1 por defecto). En cada ronda elige la habilidad según la
// fase (Ataque o Defensa) y pulsa el botón del panel de combate. Para y lo dice si el combate acaba,
// si un rival queda CONVALECIENTE (Matar / Clemente) o si la habilidad está desactivada.
async (page) => {
  const { ataque = 'Ataque Básico', defensa = 'Defenderse', rondas = 1 } = await page.evaluate(() => window.tk || {});
  const salida = [];
  // Cuántos resúmenes de intercambio hay ya en pantalla: el de esta ronda es el que aparezca de más (el
  // texto de toda la página trae también los de combates anteriores).
  const resumenes = (t) => t.match(/(Gana [^\n]+|Cada lado se juzga por su cuenta[^\n]+)/g) || [];
  // Mientras se tira la iniciativa o se resuelve el turno, las habilidades salen desactivadas.
  const esperarPanel = async () => {
    for (let i = 0; i < 40; i++) {
      if (!/Tirando iniciativa|Resolviendo/.test(await page.locator('body').innerText())) return;
      await page.waitForTimeout(1000);
    }
  };
  for (let r = 0; r < rondas; r++) {
    await esperarPanel();
    const t = await page.locator('body').innerText();
    const antes = resumenes(t).length;
    const fase = t.match(/Combate — (Ataque|Defensa)/);
    if (!fase) { salida.push(`R${r}: no hay combate en marcha`); break; }
    if (/ESTÁ CONVALECIENTE/i.test(t) && /Matar/.test(t)) { salida.push(`R${r}: rival CONVALECIENTE: elige Matar o Clemente`); break; }
    const nombre = fase[1] === 'Defensa' ? defensa : ataque;
    // El nombre de la tarjeta empieza por el de la habilidad (tras su icono): anclado y escapado, no casa
    // a mitad de otro nombre ni rompe con un «(». Pásalo completo («Ataque Básico», no «Ataque»).
    const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tarjeta = page.getByRole('button', { name: new RegExp(`^\\s*\\S*\\s*${escapado}(\\s|$)`) }).first();
    // Tras la tirada, los dados del intercambio (10 s) y la iniciativa siguiente (otros 10 s) aún giran
    // y las habilidades siguen apagadas: unos 21 s a velocidad «Dramática», más si el turno tarda (P288).
    let apagada = true;
    for (let i = 0; i < 45 && apagada; i++) {
      apagada = (await tarjeta.getAttribute('aria-disabled')) === 'true';
      if (apagada) await page.waitForTimeout(1000);
    }
    if (apagada) { salida.push(`R${r}: «${nombre}» sigue desactivada tras 45 s (¿sin energía?)`); break; }
    await tarjeta.scrollIntoViewIfNeeded();
    await tarjeta.click();
    await page.waitForTimeout(400);
    // El panel tiene su propio «Actuar»/«Defenderte»; el de texto libre de abajo sigue desactivado.
    await page.locator('button:enabled').filter({ hasText: /^(Actuar|Defenderte)$/i }).first().click();
    let u = '';
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      u = await page.locator('body').innerText();
      if (!/Resolviendo/.test(u) && resumenes(u).length > antes) break;
    }
    const hud = u.slice(u.indexOf('Nivel'), u.indexOf('Nivel') + 50).replace(/\s+/g, ' ');
    const nuevos = resumenes(u).slice(antes);
    salida.push(`R${r} ${fase[1]} (${nombre}) | ${hud} | ${nuevos.join(' / ').slice(0, 220) || '(sin resumen nuevo)'}`);
    if (/¡Victoria!|Has caído/.test(u)) { salida.push('Fin del combate'); break; }
  }
  return salida.join('\n');
}
