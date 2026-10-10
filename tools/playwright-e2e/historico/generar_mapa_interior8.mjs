import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('image-prompt')) {
    console.log(res.request().method(), res.url(), '->', res.status());
    try { console.log(await res.text()); } catch (e) {}
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Enciclopedia' }).click();
await page.waitForTimeout(1500);
await page.getByText('Lugares', { exact: true }).click();
await page.waitForTimeout(1500);
await page.getByText('LAS LLANURAS DEL VIENTO ROJO').click();
await page.waitForTimeout(1500);
await page.mouse.wheel(0, 800);
await page.waitForTimeout(500);
await page.getByText('Karot Veku — Ketg\'lukar').click();
await page.waitForTimeout(2000);

await page.getByText('Generar mapa (fondo de la vista zona)').click();
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/genmapaint_08_tras_generar_mapa.png', fullPage: true });

await browser.close();
