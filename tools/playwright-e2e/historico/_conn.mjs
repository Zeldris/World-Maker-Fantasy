import { chromium } from 'playwright';

// Helper compartido: conecta a la sesión de Chromium persistente ya lanzada (_launch_persistent.mjs,
// puerto 9222) y devuelve la primera página abierta (o crea una si no hay ninguna).
export async function getPage() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();
  const page = pages[0] ?? (await context.newPage());
  return { browser, page };
}
