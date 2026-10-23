// QA-96 (retro del 2026-10-17): cada punto del mapa de zona abierto (edificios, NPC, fauna, recursos, salidas)
// con su nombre y sus coordenadas de pantalla, para `mover.js` y `viajar.js`. Lo saca de los `<title>` del SVG.
// QA-218: con el mapa cerrado lo abre; si no se puede (botón ausente o deshabilitado, escena, combate, modal
// encima) responde `ERROR:` con el motivo en vez de esperar 15 s a un timeout.
async (page) => {
  if (!(await page.getByText('Moverte por la zona').first().isVisible().catch(() => false))) {
    const abrir = page.getByRole('button', { name: 'Moverte por la zona' });
    const t = await page.locator('body').innerText();
    const motivo = /Combate —/.test(t) ? 'hay un combate abierto' : /Vuelta \d/.test(t) ? 'hay una escena abierta (elige opción o «Salir»)'
      : /te corta el paso/i.test(t) ? 'un encuentro hostil corta el paso (pelea o huye)' : (await page.locator('[role=dialog]').count()) ? 'hay un modal abierto («Cerrar»)' : 'no se sabe: mira estado.js';
    if (!(await abrir.count())) return `ERROR: no está «Moverte por la zona» a la vista: ${motivo}`;
    if (await abrir.first().isDisabled()) return `ERROR: «Moverte por la zona» está deshabilitado: ${motivo}`;
    try { await abrir.first().click({ timeout: 5000 }); } catch { return `ERROR: no se pudo pulsar «Moverte por la zona» (tapado por otro panel): ${motivo}`; }
    await page.waitForTimeout(2000);
  }
  const puntos = await page.locator('svg title').evaluateAll((ts) =>
    ts.map((t) => {
      // El centro del icono (su primer círculo), no del grupo: el de una salida incluye su etiqueta.
      const r = (t.parentElement.querySelector('circle') || t.parentElement).getBoundingClientRect();
      return `${t.textContent} @ ${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}`;
    }),
  );
  return puntos.length ? puntos.join('\n') : 'No hay puntos: ¿está abierto el mapa de zona?';
}
