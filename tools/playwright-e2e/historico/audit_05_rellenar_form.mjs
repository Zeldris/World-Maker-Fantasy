import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(10000);

await page.goto('http://localhost:5173/solitario');
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /Helek Sirik/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Crear desde cero' }).click();
await page.waitForTimeout(500);

await page.getByPlaceholder('Nombre de tu personaje').fill('PruebaAuditoria3');
await page.getByPlaceholder('Ej. Ladrona, clérigo, mercenario...').fill('Guerrera de prueba de auditoría');
await page.getByPlaceholder('¿Qué persigue tu personaje?').fill('Probar que las habilidades de nivel 1 aparecen bien.');

await page.screenshot({ path: 'screenshots/audit_05_form_filled.png', fullPage: true });
console.log('Formulario rellenado');

const confirmBtn = page.getByRole('button', { name: 'Confirmar personaje' });
const isEnabled = await confirmBtn.isEnabled();
console.log('Confirmar habilitado?', isEnabled);

await browser.close();
