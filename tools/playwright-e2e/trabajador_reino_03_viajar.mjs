import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);

// Cerrar inventario si sigue abierto de estado previo (no debería, pero por si acaso)
const cerrar = page.getByRole('button', { name: /cerrar/i });
if (await cerrar.count() > 0) await cerrar.first().click().catch(() => {});
await page.waitForTimeout(500);

// Abrir habilidades generales / barra de skill para ver "Actuar" con texto libre de viaje
await page.getByRole('button', { name: /^actuar$/i }).first().waitFor({ timeout: 5000 });
const input = page.locator('[contenteditable="true"]').first();
await input.click();
await input.fill('Viajo a Ketg\'lukar');
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/tr03_antes_viajar.png', fullPage: true });
await page.getByRole('button', { name: /^actuar$/i }).first().click();
await page.waitForTimeout(6000);
await page.screenshot({ path: 'screenshots/tr03_despues_viajar.png', fullPage: true });
const text = await page.locator('body').innerText();
console.log('body (ultimos 800):', text.slice(-800));
await browser.close();
