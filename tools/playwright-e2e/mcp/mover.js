// QA-46: en «Moverte por la zona», pulsa un punto del mapa (window.tk.x, window.tk.y: píxeles de la
// pantalla, como en una captura de 1280×720), acepta «Ir hasta aquí» si sale y espera a llegar o a un
// encuentro. Devuelve el aviso del encuentro (si hay) y la cabeza de la lista de la zona.
async (page) => {
  const { x, y } = await page.evaluate(() => window.tk || {});
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'ERROR: faltan window.tk.x y window.tk.y (números: píxeles de pantalla, como los de puntos.js)';
  // El título del mapa abierto es el único texto «Moverte por la zona» (la brújula solo lo lleva de aria-label).
  if (!(await page.getByText('Moverte por la zona').first().isVisible().catch(() => false))) {
    const brujula = page.getByRole('button', { name: 'Moverte por la zona' });
    if (!(await brujula.count())) return 'ERROR: no hay mapa de zona abierto ni botón «Moverte por la zona» (¿hay un modal, cajón o escena encima? ciérralo antes)';
    if (!(await brujula.first().isEnabled())) return 'ERROR: «Moverte por la zona» está deshabilitado (un encuentro hostil o un combate corta el paso: resuélvelo antes)';
    await brujula.first().click();
    await page.waitForTimeout(2000);
  }
  // Una tarjeta de encuentro abierta (con «Interactuar», «Ignorar»…) no deja andar hasta resolverla.
  const previa = page.getByTestId('encuentro-en-mapa');
  if (await previa.count()) return 'AVISO: hay un encuentro abierto en el mapa, no me muevo; resuélvelo antes (interactuar.js, o pulsar.js con «Seguir mi camino» / «Ignorar»): ' + (((await previa.first().textContent()) || '').replace(/\n+/g, ' · ').slice(0, 120));
  // Foto del antes: dónde está el personaje (centro de su ficha en pantalla) y la hora del HUD.
  const foto = () =>
    page.evaluate(() => {
      // La ficha más grande (la del mapa; la otra es de la leyenda).
      const js = [...document.querySelectorAll('[data-testid="jugador-zona"]')].map((e) => e.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height);
      const r = js[0];
      return { pos: r ? [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] : null, hora: (document.body.innerText.match(/Día \d+, \d+:\d+/) || ['?'])[0] };
    });
  const antes = await foto();
  // Lo que hay bajo el punto: solo bloquea si cae fuera del mapa o sobre un panel, cajón o modal conocido; si no se
  // puede saber (sin ficha de jugador, otro elemento encima), avisa y hace el clic como antes.
  const bajo = await page.evaluate(
    ({ x, y }) => {
      // El svg del mapa de zona es el exterior más grande de los que llevan puntos (`<title>`, como en puntos.js) o la
      // ficha del jugador. No basta la ficha: la leyenda también la lleva en un svg de 20×20, y si el jugador no está en
      // el mapa (modal sin ficha) se medía ese (QA-46, tanda 24a).
      const exterior = (el) => {
        let m = el.closest('svg');
        while (m?.parentElement?.closest('svg')) m = m.parentElement.closest('svg');
        return m;
      };
      const area = (m) => m.getBoundingClientRect().width * m.getBoundingClientRect().height;
      const candidatos = [...document.querySelectorAll('svg title, [data-testid="jugador-zona"]')].map(exterior).filter(Boolean);
      // Con el modal abierto, el mapa es el del modal; el de la pantalla de detrás no recibe el clic.
      const delModal = candidatos.filter((m) => m.closest('[role="dialog"]'));
      const mapa = (delModal.length ? delModal : candidatos).sort((a, b) => area(b) - area(a))[0];
      const aviso = [];
      if (!mapa) aviso.push('no se encuentra el mapa de zona (sin ficha «jugador-zona»), clic a ciegas');
      const e = document.elementFromPoint(x, y);
      const panel = e?.closest('[role="dialog"],[role="menu"],.plank-panel');
      if (mapa) {
        const m = mapa.getBoundingClientRect();
        if (x < m.x || y < m.y || x > m.x + m.width || y > m.y + m.height)
          return { error: `(${x},${y}) cae fuera del mapa, que ocupa x ${Math.round(m.x)}–${Math.round(m.x + m.width)}, y ${Math.round(m.y)}–${Math.round(m.y + m.height)}` };
      }
      const quien = e ? e.tagName.toLowerCase() + ' «' + (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) + '»' : 'nada';
      if (panel && !(mapa && panel.contains(mapa))) return { error: `(${x},${y}) está tapado por ${quien}, no por el mapa` };
      if (mapa && e && !mapa.contains(e)) aviso.push(`(${x},${y}) cae sobre ${quien}, no sobre el mapa; hago el clic igualmente`);
      return { ok: true, aviso: aviso.join('; ') };
    },
    { x, y },
  );
  if (bajo.error) return 'ERROR: ' + bajo.error;
  const avisos = bajo.aviso ? ['AVISO: ' + bajo.aviso] : [];
  await page.mouse.click(x, y);
  await page.waitForTimeout(1200);
  // Sobre una ficha sale su menú; sobre el suelo, el personaje echa a andar sin menú. «Ir hasta aquí» solo está si no
  // estás ya pegado a la ficha (entonces el menú ofrece «Interactuar»: interactuar.js).
  const menu = page.getByRole('menu');
  let nota = '';
  const enModal = page.getByRole('dialog').getByRole('button', { name: 'Ir hasta aquí' });
  if ((await menu.count()) || (await enModal.count())) {
    // Primero dentro del menú del mapa; si no, en el modal abierto (EdificioFichaModal, ZonePointDetailModal).
    let ir = menu.first().getByRole('menuitem', { name: 'Ir hasta aquí' });
    if (!(await ir.count())) ir = enModal;
    if (await ir.count()) await ir.first().click();
    else {
      const ofrece = ((await menu.first().innerText().catch(() => '')) || '(sin menú)').replace(/\n+/g, ' · ');
      return 'SIN MOVIMIENTO: la ficha no ofrece «Ir hasta aquí» (ya estás junto a ella o no se puede ir). Menú: ' + ofrece + '\nPosición: ' + (antes.pos || '?') + ' · ' + antes.hora;
    }
  }
  // Solo el aviso del encuentro en el mapa (`encuentro-en-mapa`): en el texto de toda la página, una
  // entrada vieja del diario («se abalanza…») daba un encuentro que no había.
  let aviso = '';
  const tarjeta = page.getByTestId('encuentro-en-mapa');
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    if (await tarjeta.count()) { aviso = ((await tarjeta.first().textContent()) || '').replace(/\n+/g, ' · '); break; }
    if (/Combate —/.test(await page.locator('body').innerText())) { aviso = 'COMBATE abierto (te vieron primero): usa combate.js'; break; }
    if (!(await page.getByRole('button', { name: 'Parar' }).count())) break;
  }
  const despues = await foto();
  const t = await page.locator('body').innerText();
  const iZona = t.indexOf('Territorio de');
  const cambioPos = String(antes.pos) !== String(despues.pos);
  const movido = antes.hora !== despues.hora || cambioPos;
  // Sin aviso y sin avance: nada ha pasado (casilla no transitable, ya estabas ahí, clic en una zona muerta del mapa).
  if (movido && !cambioPos && antes.pos && despues.pos) avisos.push('AVISO: solo cambió la hora, la posición del jugador no cambió (¿esperó en el sitio?)');
  if (!movido && !aviso) nota = 'SIN MOVIMIENTO: ni la posición ni la hora cambiaron (¿casilla no transitable, ya estabas ahí o un panel no dejó llegar el clic?)';
  if (await page.getByRole('button', { name: 'Parar' }).count()) nota += (nota ? '\n' : '') + 'SIGUE ANDANDO: el personaje no ha llegado aún (ver estado.js)';
  return [
    ...(nota ? [nota] : []),
    ...avisos,
    'AVISO: ' + (aviso || '(ninguno)'),
    'POSICIÓN: ' + (antes.pos || '?') + ' → ' + (despues.pos || '?') + ' · HORA: ' + antes.hora + ' → ' + despues.hora,
    'ZONA:\n' + (iZona >= 0 ? t.slice(iZona, iZona + 500) : ''),
  ].join('\n\n');
}
