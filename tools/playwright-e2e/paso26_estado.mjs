import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
const disabled = await page.getByRole('textbox', { name: 'Acción de tu personaje' }).getAttribute('aria-disabled');
console.log('Composer disabled:', disabled);
const anyModal = await page.locator('[role="dialog"]').count();
console.log('Modales abiertos:', anyModal);
await page.screenshot({ path: 'screenshots/paso26_estado.png', fullPage: true });
await browser.close();
