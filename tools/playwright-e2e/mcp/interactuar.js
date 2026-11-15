// QA-57: pulsa «Interactuar» en el aviso del encuentro (el del mapa de zona si está abierto; si no, el
// del diario; o el «Interactuar» del menú que abre pulsar un NPC en el mapa, QA-125) y devuelve la escena que se abre: título de la vuelta, texto y opciones numeradas.
async (page) => {
  const enMapa = page.getByTestId('encuentro-en-mapa').getByRole('button', { name: 'Interactuar' });
  const enMenu = page.getByRole('menuitem', { name: 'Interactuar' });
  // P463: nunca `.last()` a ciegas (podía ser la tarjeta de otro punto, p. ej. un recurso): sin tarjeta del mapa ni menú de NPC,
  // solo vale un único «Interactuar» a la vista; con varios, error con los títulos de las tarjetas para elegir.
  const todos = page.getByRole('button', { name: 'Interactuar' });
  if (!(await enMapa.count()) && !(await enMenu.count()) && (await todos.count()) > 1) {
    return 'ERROR: hay ' + (await todos.count()) + ' «Interactuar» a la vista (tarjetas de otros puntos): abre el menú del NPC en el mapa y pulsa su «Interactuar» (mover.js), o cierra/ignora las tarjetas que sobran; mira estado.js';
  }
  const boton = (await enMapa.count()) ? enMapa.first() : (await enMenu.count()) ? enMenu.first() : todos.first();
  if (!(await boton.count())) return 'No hay ningún «Interactuar» a la vista: acércate (mover.js) o abre el menú del NPC';
  // QA-218: si lo tapa un modal (mapa, ficha) o está deshabilitado, lo dice en vez de esperar 15 s.
  if (await boton.isDisabled().catch(() => false)) return 'ERROR: «Interactuar» está deshabilitado: ¿escena o combate abiertos? mira estado.js';
  try { await boton.click({ timeout: 5000 }); } catch {
    return 'ERROR: «Interactuar» está tapado por otro panel (el mapa o una ficha está abierto sobre el diario): ciérralo («Cerrar») y repite; mira estado.js';
  }
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    const t = await page.locator('body').innerText();
    const k = t.search(/Vuelta \d/);
    if (k >= 0) return t.slice(k, k + 700);
    if (/Combate —/.test(t)) return 'COMBATE abierto (te vieron primero): usa combate.js';
  }
  // P429: un modal (ficha, edificio, menú de un NPC) no es una escena: se dice cuál se abrió en vez de «ninguna escena».
  const modal = page.getByRole('dialog');
  if (await modal.count()) return 'No se abrió una escena de vuelta, sino un MODAL: ' + (((await modal.first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 200)) + ' (ciérralo con «Cerrar» o mira estado.js)';
  return 'No se abrió ninguna escena: mira con estado.js o una captura';
}
