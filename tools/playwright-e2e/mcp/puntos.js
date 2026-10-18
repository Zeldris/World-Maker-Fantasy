// QA-96 (retro del 2026-10-17): cada punto del mapa de zona abierto (edificios, NPC, fauna, recursos, salidas)
// con su nombre y sus coordenadas de pantalla, para `mover.js` y `viajar.js`. Lo saca de los `<title>` del SVG.
async (page) => {
  if (!(await page.getByText('Moverte por la zona').first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Moverte por la zona' }).click();
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
