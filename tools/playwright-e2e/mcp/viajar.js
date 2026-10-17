// QA-96 (retro del 2026-10-17): cruza a otra zona por una salida del mapa de zona. `window.tk.x`, `window.tk.y`:
// la salida en píxeles de pantalla (`puntos.js` los da). Abre el mapa si hace falta, anda hasta la salida, pasa
// los encuentros tranquilos con «Seguir mi camino», confirma el diálogo de la salida («Viajar», «Entrar» o
// «Salir») y espera a que acabe «Ocupado». Para y lo dice ante un encuentro hostil, un combate o si se queda
// quieto sin llegar. Devuelve los encuentros pasados, el diálogo de la salida y el HUD al llegar.
async (page) => {
  const { x, y } = await page.evaluate(() => window.tk || {});
  if (x == null || y == null) return 'Faltan window.tk.x y window.tk.y';
  if (!(await page.getByText('Moverte por la zona').first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Moverte por la zona' }).click();
    await page.waitForTimeout(2000);
  }
  const hud = async () => (await page.locator('header').first().innerText()).replace(/\s+/g, ' ');
  // Con un hostil cortando el paso se pelea o se huye; salir por una salida es P206, no un viaje.
  if (/Te cortan el paso/.test(await hud())) return 'PARADO: te cortan el paso (pelea o huye antes de viajar)';
  await page.mouse.click(x, y);
  await page.waitForTimeout(900);
  const ir = page.getByText('Ir hasta aquí');
  if (await ir.count()) await ir.first().click();
  const salida = [];
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(1000);
    // Solo en el diálogo de la salida: un menú de NPC abierto en el diario también tiene «Salir».
    const confirmar = page.locator('[role=dialog]').getByRole('button', { name: /^(Viajar|Entrar|Salir)$/ });
    if (await confirmar.count()) {
      salida.push('SALIDA: ' + (await page.locator('[role=dialog]').last().innerText().catch(() => '')).replace(/\n+/g, ' · ').slice(0, 200));
      await confirmar.last().click();
      // Espera a ver «Ocupado» y a que se vaya (el HUD tarda en ponerlo).
      let visto = false;
      for (let j = 0; j < 150; j++) {
        await page.waitForTimeout(1000);
        const ocupado = /Ocupado/.test(await hud());
        if (ocupado) visto = true;
        if ((visto && !ocupado) || (!visto && j > 10)) break;
      }
      salida.push('HUD: ' + (await hud()));
      return salida.join('\n');
    }
    // La tarjeta del encuentro puede ser SVG: `textContent`, no `innerText`.
    const tarjeta = page.getByTestId('encuentro-en-mapa');
    if (await tarjeta.count()) {
      const texto = (await tarjeta.first().textContent()) || '';
      salida.push('ENCUENTRO: ' + texto.slice(0, 80));
      const seguir = tarjeta.getByRole('button', { name: /Seguir mi camino/i });
      if (/te corta el paso/i.test(texto) || !(await seguir.count())) return salida.concat('PARADO: el encuentro no deja seguir').join('\n');
      await seguir.click();
      await page.waitForTimeout(1200);
      const reanudar = page.getByRole('button', { name: /Reanudar/ });
      if (await reanudar.count()) await reanudar.first().click();
      continue;
    }
    if (/Combate —/.test(await page.locator('body').innerText())) return salida.concat('COMBATE abierto: usa combate.js').join('\n');
    const andando = (await page.getByRole('button', { name: 'Parar' }).count()) || (await page.getByRole('button', { name: /Reanudar/ }).count());
    if (i > 4 && !andando) return salida.concat('PARADO sin llegar a la salida: mira una captura').join('\n');
  }
  return salida.concat('Tiempo agotado').join('\n');
}
