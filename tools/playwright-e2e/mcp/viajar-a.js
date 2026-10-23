// QA-218: «Viajar» del Mapa por nombre. `window.tk.lugar`: texto (parcial, sin mayúsculas) del lugar. Abre el
// Mapa (y su pestaña «Mapa») si hace falta, pulsa «🧭 Viajar» y elige el lugar de la lista. Si no está,
// dice cuáles hay (la lista solo trae lugares visitados) y cancela. Con `window.tk.lugar` vacío, solo lista.
// No cruza por una salida del mapa de zona: eso es `viajar.js`. Desde la Deck: `o.sh viajar-a "<lugar>"`.
async (page) => {
  const { lugar = '' } = await page.evaluate(() => window.tk || {});
  const hud = async () => (await page.locator('header').first().innerText()).replace(/\s+/g, ' ');
  const boton = page.getByRole('button', { name: /Viajar/ });
  // El diálogo de «Viajar» se llama «Viajar» (aria-label del ModalShell); el texto de ayuda cambia con/sin mapa.
  const dialogo = () => page.getByRole('dialog', { name: 'Viajar', exact: true }).last();
  if (!(await boton.count())) {
    if (await page.getByText('Moverte por la zona').first().isVisible().catch(() => false) && (await page.locator('[role=dialog]').count())) {
      return 'ERROR: el mapa de «Moverte por la zona» está abierto: ciérralo («Cerrar») antes de viajar';
    }
    if (/Combate —/.test(await page.locator('body').innerText())) return 'ERROR: hay un combate abierto; no se puede viajar';
    // Con el modal del Mapa ya abierto (pestaña Zona) solo falta su pestaña «Mapa»; su botón de la barra queda detrás.
    if (!(await page.getByText('Cerrar ✕').count())) {
      await page.getByText('Mapa', { exact: true }).first().click({ force: true, timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
    await page.getByText('Cerrar ✕').first().waitFor({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1500);
    if (!(await boton.count())) await page.getByText('Mapa', { exact: true }).last().click({ force: true, timeout: 5000 }).catch(() => {});
    await boton.first().waitFor({ timeout: 6000 }).catch(() => {});
  }
  if (!(await boton.count())) return 'ERROR: no encuentro «🧭 Viajar» en el Mapa (¿tarjeta de encuentro o panel tapando? mira estado.js)';
  await boton.first().click();
  const d = dialogo();
  await d.waitFor({ timeout: 5000 }).catch(() => {});
  if (!(await d.count())) return 'ERROR: «Viajar» no abrió la lista de lugares';
  // La lista llega del backend: esperar a los destinos o a que acabe «Buscando destinos...» (tope 10 s).
  for (let j = 0; j < 100; j++) {
    if ((await d.locator('[data-opcion]').count()) || !/Buscando destinos/.test(await d.innerText().catch(() => ''))) break;
    await page.waitForTimeout(100);
  }
  const lugares = (await d.locator('[data-opcion]').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s && !/^cancelar$/i.test(s));
  const cancelar = async () => {
    await d.getByRole('button', { name: /cancelar/i }).first().click().catch(() => {});
    await page.getByText('Cerrar ✕').first().click({ force: true, timeout: 3000 }).catch(() => {}); // deja el Mapa cerrado
  };
  if (!lugar) { await cancelar(); return `Lugares a los que se puede viajar: ${lugares.join(' | ') || '(ninguno: solo salen los ya visitados)'}`; }
  const idx = lugares.findIndex((s) => s.toLowerCase().includes(String(lugar).toLowerCase()));
  if (idx < 0) {
    await cancelar();
    return `ERROR: «${lugar}» no está en «Viajar». Hay: ${lugares.join(' | ') || '(ninguno: solo salen los ya visitados; para uno nuevo, a pie con viajar.js)'}`;
  }
  const destino = d.locator('[data-opcion]').nth(idx);
  if (await destino.isDisabled().catch(() => false)) {
    const motivo = (await d.locator('p').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => /^(🔒|🐎)/.test(s)).join(' ')
      || (await destino.getAttribute('title').catch(() => null)) || 'sin motivo visible';
    await cancelar();
    return `ERROR: «${lugares[idx]}» está deshabilitado en «Viajar»: ${motivo}`;
  }
  const antes = await hud();
  await destino.click({ timeout: 5000 });
  // Un posible diálogo de confirmación («Viajar»/«Ir»).
  await page.waitForTimeout(1200);
  const confirmar = page.locator('[role=dialog]').getByRole('button', { name: /^(Viajar|Ir|Entrar|Confirmar)$/ });
  if (await confirmar.count()) await confirmar.last().click();
  let visto = false;
  for (let j = 0; j < 120; j++) {
    await page.waitForTimeout(1000);
    const ocupado = /Ocupado/.test(await hud());
    if (ocupado) visto = true;
    if ((visto && !ocupado) || (!visto && j > 8)) break;
  }
  return `VIAJE a «${lugares[idx]}»\nHUD antes: ${antes}\nHUD ahora: ${await hud()}`;
}
