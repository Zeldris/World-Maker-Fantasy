import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await snap(page, 'step13_before');

// Panel de acción libre: div contenteditable con aria-label, y botón "Actuar" (nth 0 según gotcha del README)
const input = page.getByRole('textbox', { name: /acción de tu personaje/i });
await input.click();
await input.fill('Gorhorn explora los alrededores de La Hondonada del Eco en busca de fauna para cazar.');
await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();

// Esperar resolución (Ollama puede tardar 20-30s)
console.log('Esperando resolución del turno...');
await page.waitForTimeout(30000);
await snap(page, 'step13_after');
await browser.close();
console.log('OK');
