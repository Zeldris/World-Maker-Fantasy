import { chromium } from 'playwright';

const SAVE_ID = 'cmten4peu008aritr6km5hcc9';

async function actuar(page, texto, label, waitMs = 45000) {
  const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
  await campo.click();
  await campo.fill(texto);
  await page.waitForTimeout(300);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
  await actuarBtn.click();
  console.log(`--- turno enviado: ${label} ---`);
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `screenshots/${label}.png`, fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log(`=== ${label} ===`);
  console.log(bodyText.slice(-2200));
  const buttons = await page.locator('button').all();
  const btnTexts = [];
  for (const b of buttons) {
    const t = (await b.innerText()).trim().replace(/\s+/g, ' ');
    if (t) btnTexts.push(t);
  }
  console.log('--BOTONES--', btnTexts.filter(t => /combatir|huir|matar|capturar|clemente/i.test(t)));
  return bodyText;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

await actuar(page, 'Salgo a rastrear y en cuanto encuentro un Kirelon Arenoso lo ataco directamente con mi hacha, sin previo aviso, para matarlo.', 'verifConval19_atacar1');

await browser.close();
console.log('OK');
