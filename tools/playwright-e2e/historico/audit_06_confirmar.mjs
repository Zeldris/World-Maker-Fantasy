import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15000);

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

await page.getByRole('button', { name: 'Confirmar personaje' }).click();
await page.waitForTimeout(1500);
console.log('URL tras confirmar:', page.url());
await page.screenshot({ path: 'screenshots/audit_06_after_confirm.png', fullPage: true });
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones:', JSON.stringify(buttons));

await browser.close();
