// QA-46: manda una acción (window.tk.accion) por el cuadro que esté a mano (el de combate o el de texto
// libre), espera a que el turno acabe y devuelve el estado en texto. Cabe en el límite de 60 s del MCP.
// Antes: browser_evaluate con () => { window.tk = { accion: 'Ataco al orco' } }
async (page) => {
  const { accion } = await page.evaluate(() => window.tk || {});
  if (!accion) return 'Falta window.tk.accion';
  const combate = page.getByPlaceholder('O describe tu acción...');
  const libre = page.getByRole('textbox', { name: 'Acción de tu personaje' });
  const usaCombate = (await combate.count()) > 0 && (await combate.isVisible());
  const campo = usaCombate ? combate : libre;
  const listo = async () => (usaCombate ? await campo.isEnabled() : (await campo.getAttribute('aria-disabled')) !== 'true');
  for (let i = 0; i < 10 && !(await listo()); i++) await page.waitForTimeout(1000);
  if (usaCombate) await campo.fill(accion);
  else { await campo.click(); await page.keyboard.type(accion); }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  for (let i = 0; i < 38 && !(await listo().catch(() => true)); i++) await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  const texto = await page.locator('body').innerText();
  const hud = ((await page.locator('banner, header').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const iDiario = texto.indexOf('Lo que haces, dices y percibes');
  const iMundo = texto.indexOf('\nEl mundo\n');
  const diario = iDiario >= 0 ? texto.slice(iDiario, iMundo > iDiario ? iMundo : undefined).trim().slice(-700) : '';
  const iCombate = texto.search(/Combate —|COMBATE —/);
  const combateTxt = iCombate >= 0 ? texto.slice(iCombate, iCombate + 500).replace(/\n{2,}/g, '\n') : '';
  return ['HUD: ' + hud, 'DIARIO (final):\n' + diario, combateTxt ? 'COMBATE:\n' + combateTxt : ''].filter(Boolean).join('\n\n');
}
