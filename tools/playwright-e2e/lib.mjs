import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

/// Librería común para jugar el frontend real (QA-30, retro del 2026-10-09). Viene de
/// `historico/recorrido/lib.mjs`, con dos cambios para que sirva en cualquier máquina:
/// - la partida sale de la variable `SAVE_ID` (antes, una fija de la base de la Steam Deck);
/// - en la nube usa el Chromium de `/opt/pw-browsers` (no hay Chrome de sistema).
export const SAVE_ID = process.env.SAVE_ID ?? '';
export const FRONT = process.env.FRONT ?? 'http://localhost:5173';
export const BACK = process.env.BACK ?? 'http://localhost:3001';

/// Chromium de la nube, si existe; si no, el que trae Playwright.
export function chromiumDeLaMaquina() {
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const ruta = dir ? `${base}/${dir}/chrome-linux/chrome` : undefined;
  return ruta && existsSync(ruta) ? ruta : undefined;
}

export async function abrirNavegador() {
  const browser = await chromium.launch({ executablePath: chromiumDeLaMaquina() });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(15000);
  return { browser, page };
}

// Bug real detectado (2026-09-08): buscar un botón "cerrar/salir/ignorar/continuar" en TODA la
// página, sin acotar al propio overlay, podía resolver contra "← Salir a tus partidas" (fuera del
// overlay, tapado por él). Acotar la búsqueda AL overlay mismo evita ese falso positivo.
export async function abrirPartida(saveId = SAVE_ID) {
  if (!saveId) throw new Error('Falta SAVE_ID (export SAVE_ID=<id de la partida>)');
  const { browser, page } = await abrirNavegador();
  await page.goto(`${FRONT}/solitario/partida/${saveId}`);
  await page.waitForTimeout(2500);
  const overlay = page.locator('.fixed.inset-0.z-50').first();
  if (await overlay.isVisible().catch(() => false)) {
    const cerrar = overlay.getByRole('button', { name: /cerrar|salir|ignorar|continuar/i }).first();
    if (await cerrar.isVisible().catch(() => false)) {
      await cerrar.click();
      await page.waitForTimeout(800);
    }
  }
  return { browser, page };
}

// Espera por CONDICIÓN real (botón "Actuar" vuelve a estar habilitado tras narrar), no por un
// timeout fijo — un turno real con LLM tarda entre 30s y 220s de forma variable, así que un
// tiempo fijo corto deja el composer bloqueado a medio turno (bug real detectado: el script
// anterior se quedó colgado 8+ minutos porque el 2º `actuar()` esperaba con timeout fijo mientras
// el 1er turno seguía narrando).
export async function actuar(page, texto, { timeoutMs = 240000 } = {}) {
  const composer = page.locator('[contenteditable="true"]').first();
  await composer.waitFor({ state: 'visible', timeout: timeoutMs });
  await composer.click();
  await composer.fill(texto);
  await page.waitForTimeout(200);
  const actuarBtn = page.getByRole('button', { name: /^Actuar$/ });
  await actuarBtn.click();
  // Espera a que el composer vuelva a estar vacío Y habilitado — señal real de que el turno
  // terminó de narrar (el propio comentario del frontend confirma que ese es el momento en que
  // "Actuar pasa de deshabilitado a disponible").
  await page.waitForFunction(
    () => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Actuar');
      return btn && !btn.disabled;
    },
    undefined,
    { timeout: timeoutMs, polling: 1000 },
  );
}

export async function verEstado(page, nombreArchivo) {
  await page.screenshot({ path: `screenshots/${nombreArchivo}`, fullPage: true });
}

// Bug real detectado (2026-09-08): cuando aparece una OfferCard (NPC/fauna/recurso "busca tu
// atención"), el composer de texto libre y "Actuar" quedan deshabilitados hasta que el jugador
// pulsa INTERACTUAR o IGNORAR — un script que solo sabe escribir texto se queda colgado
// indefinidamente esperando un botón que nunca se habilita. Detectarlo explícitamente en vez de
// asumir que siempre hay composer disponible.
export async function hayOfertaPendiente(page) {
  const interactuar = page.getByRole('button', { name: 'INTERACTUAR' });
  return interactuar.isVisible().catch(() => false);
}

// El clic en INTERACTUAR dispara el primer turno del modal de diálogo (DynamicModeModal), que
// tarda como cualquier turno real (LLM) — se espera por la condición real: el botón deja de decir
// "INTERACTUANDO..." (loading) y aparecen opciones o el botón "Salir" del modal.
export async function pulsarInteractuar(page, { timeoutMs = 240000 } = {}) {
  await page.getByRole('button', { name: 'INTERACTUAR' }).click();
  await page.waitForFunction(
    () => !Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('INTERACTUANDO')),
    undefined,
    { timeout: timeoutMs, polling: 1000 },
  );
  await page.waitForTimeout(500);
}

// Lee las opciones de diálogo disponibles en el DynamicModeModal (botones dentro del overlay,
// excluyendo "Salir").
export async function opcionesDialogo(page) {
  const overlay = page.locator('.fixed.inset-0.z-50').first();
  const botones = await overlay.getByRole('button').allTextContents();
  return botones.map((t) => t.trim()).filter((t) => t && t !== 'Salir');
}

export async function elegirOpcionDialogo(page, textoOpcion, { timeoutMs = 240000 } = {}) {
  const overlay = page.locator('.fixed.inset-0.z-50').first();
  await overlay.getByRole('button', { name: textoOpcion, exact: false }).first().click();
  await page.waitForTimeout(1000);
  // Tras elegir, el modal narra la siguiente vuelta (turno real) — el texto real de carga es
  // "Resolviendo..." (DynamicModeModal.tsx), no un atributo aria-busy genérico. Esperar a que
  // desaparezca antes de leer las opciones nuevas o intentar salir.
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Resolviendo...'),
    undefined,
    { timeout: timeoutMs, polling: 1000 },
  ).catch(() => {});
}

// El combate usa un composer DISTINTO al normal (CombatComposer.tsx): un <input> con placeholder
// "O describe tu acción..." en vez de [contenteditable], con su propio botón "Actuar" que se
// deshabilita mientras `busy`. Confundir ambos deja el script esperando un elemento que no existe.
// Bug real detectado (2026-09-08): nada más iniciarse el combate, la vista muestra solo un aviso
// "En combate — usa el panel de combate para actuar" con botones "⚔️ Combatir"/"🏃 Huir" — el
// input de texto libre vive DENTRO del panel de combate real, que solo aparece tras pulsar
// "Combatir". Sin ese clic previo, esperar el input se queda colgado indefinidamente (8+ minutos
// reales en esta sesión antes de diagnosticarlo).
export async function atacarEnCombate(page, texto, { timeoutMs = 240000 } = {}) {
  const combatirBtn = page.getByRole('button', { name: /Combatir/ });
  if (await combatirBtn.isVisible().catch(() => false)) {
    await combatirBtn.click();
    await page.waitForTimeout(500);
  }
  const input = page.getByPlaceholder('O describe tu acción...');
  await input.waitFor({ state: 'visible', timeout: timeoutMs });
  await input.fill(texto);
  // Dos botones "Actuar" coexisten en el DOM durante el combate: el del composer normal (oculto
  // tras el panel, deshabilitado) y el real del CombatComposer, habilitado — acotar al que está
  // habilitado evita el "strict mode violation" de Playwright (2 elementos, ninguno preferido).
  const actuarBtn = page.getByRole('button', { name: /^Actuar$/ }).and(page.locator(':not([disabled])'));
  await actuarBtn.click();
  // Bug real detectado (2026-09-08): cuando el rival queda CONVALECIENTE, `pendingDecisions`
  // (CombatComposer.tsx) bloquea el input HASTA que el jugador pulse Matar/Capturar/Clemente en su
  // tarjeta — nunca se habilita solo. Esperar solo "input habilitado" deja el script colgado
  // indefinidamente en ese caso; hay que aceptar TAMBIÉN la aparición de "Matar" como fin de esta
  // espera, no solo el input libre.
  await page.waitForFunction(
    () => {
      const inp = document.querySelector('input[placeholder="O describe tu acción..."]');
      const hayMatar = Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Matar');
      return !inp || !inp.disabled || hayMatar;
    },
    undefined,
    { timeout: timeoutMs, polling: 1000 },
  );
}

// Fase de defensa (cuando el enemigo actúa primero): el jugador elige "a ciegas" cómo defenderse,
// un botón "DEFENDERTE" simple (sin opciones de habilidad complejas en este punto del combate).
export async function defenderseEnCombate(page, { timeoutMs = 240000 } = {}) {
  const defenderBtn = page.getByRole('button', { name: /DEFENDERTE/i });
  await defenderBtn.click();
  await page.waitForFunction(
    () => {
      const inp = document.querySelector('input[placeholder="O describe tu acción..."]');
      const defBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('DEFENDERTE'));
      return (inp && !inp.disabled) || !defBtn;
    },
    undefined,
    { timeout: timeoutMs, polling: 1000 },
  ).catch(() => {});
}

export async function hayDefensaPendiente(page) {
  return page.getByRole('button', { name: /DEFENDERTE/i }).isVisible().catch(() => false);
}

export async function enCombate(page) {
  return page.getByText('En combate').first().isVisible().catch(() => false);
}

export async function salirDialogo(page) {
  const overlay = page.locator('.fixed.inset-0.z-50').first();
  const salir = overlay.getByRole('button', { name: 'Salir' });
  if (await salir.isVisible().catch(() => false)) {
    await salir.click();
    await page.waitForTimeout(1000);
  }
}

// HTTP directo, sin Playwright — mucho más rápido para turnos de puro texto (reservar Playwright
// para interacciones de UI genuinas: mapa, modales). IMPORTANTE (causa real de los "cuelgues"
// vistos en esta sesión, ver tarkor_bug_saqueo_colgado_registro_cuerpos_2026-09-08 en memoria):
// nunca matar (`kill`/`pkill`) un proceso a mitad de un `/turn/narrate` en curso — el servidor
// sigue procesando el turno en segundo plano ajeno a que el cliente se desconectó, manteniendo
// `claimTurnInFlight` tomado hasta 5 minutos (staleAfterMs). Dejar SIEMPRE que un turno termine
// solo, por largo que parezca (hasta 220s es normal).
export async function turnoDirecto(saveId, action, { enCombate = false, lootItemNames = null, allowAfterEnded = false } = {}) {
  const classifyRes = await fetch(`${BACK}/turn/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saveId, action, enCombate }),
  });
  if (!classifyRes.ok) throw new Error(`classify falló: ${classifyRes.status} ${await classifyRes.text()}`);
  // Bug real detectado (2026-09-08): faltaba reenviar `travel`/`npcsInScene` del classify al
  // narrate — sin `travel`, el backend nunca sabe que la acción es un viaje entre Locations, y el
  // jugador se queda narrativamente "moviéndose" sin cambiar nunca de `currentLocationId`.
  const { classification, roll, travel, npcsInScene } = await classifyRes.json();

  const narrateRes = await fetch(`${BACK}/turn/narrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saveId, action, classification, roll, travel, npcsInScene, enCombate, lootItemNames, allowAfterEnded }),
  });
  if (!narrateRes.ok) throw new Error(`narrate falló: ${narrateRes.status} ${await narrateRes.text()}`);
  const text = await narrateRes.text();
  const lines = text.trim().split('\n').filter(Boolean);
  const lastLine = JSON.parse(lines[lines.length - 1]);
  return lastLine;
}
