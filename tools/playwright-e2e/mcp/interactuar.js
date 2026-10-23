// QA-57: pulsa «Interactuar» en el aviso del encuentro (el del mapa de zona si está abierto; si no, el
// del diario; o el «Interactuar» del menú que abre pulsar un NPC en el mapa, QA-125) y devuelve la escena que se abre: título de la vuelta, texto y opciones numeradas.
async (page) => {
  const enMapa = page.getByTestId('encuentro-en-mapa').getByRole('button', { name: 'Interactuar' });
  const enMenu = page.getByRole('menuitem', { name: 'Interactuar' });
  const boton = (await enMapa.count()) ? enMapa.first() : (await enMenu.count()) ? enMenu.first() : page.getByRole('button', { name: 'Interactuar' }).last();
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
  return 'No se abrió ninguna escena: mira con estado.js o una captura';
}
