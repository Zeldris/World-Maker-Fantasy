import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(30000);

await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);

// "Continuar como Gorhorn de prueba..." es un atajo directo a UNA partida — mejor ir por
// "En solitario" para llegar a la lista completa donde puedo elegir cuál reiniciar.
await page.getByText('En solitario').click();
await page.waitForTimeout(1500);
await page.getByText('Helek Sirik', { exact: false }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/recorrido_00b_personajes.png', fullPage: true });

await browser.close();
