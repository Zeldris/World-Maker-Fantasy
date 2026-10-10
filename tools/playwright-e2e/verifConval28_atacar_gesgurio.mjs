import { chromium } from 'playwright';

const SAVE_ID = 'cmtd4qgfk003lriuof6id16e0';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

// Pulsar Combatir para abrir el panel
const combatirBtn = page.locator('button', { hasText: 'COMBATIR' }).last();
await combatirBtn.click();
await page.waitForTimeout(1000);

// Seleccionar Gesgurio #2 como objetivo (ya viene seleccionado por defecto según captura anterior)
const objetivo = page.locator('button', { hasText: 'Gesgurio #2' });
await objetivo.click();
await page.waitForTimeout(500);

await page.screenshot({ path: 'screenshots/verifConval28_antes_atacar.png', fullPage: true });

// Escribir la acción de ataque básico en el campo de combate
const campo = page.locator('[contenteditable="true"]').last();
await campo.click();
await campo.fill('Ataco a Gesgurio #2 con mi hacha, un golpe controlado sin intención de matar.');
await page.waitForTimeout(300);

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
await actuarBtn.click();
console.log('--- turno de combate enviado ---');
await page.waitForTimeout(40000);
await page.screenshot({ path: 'screenshots/verifConval28_despues_atacar.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-3000));

await browser.close();
console.log('OK');
