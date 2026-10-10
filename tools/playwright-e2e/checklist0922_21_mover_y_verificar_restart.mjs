import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

async function leerPosicionJugador() {
  const res = await fetch(`http://localhost:3001/saves/${SAVE_ID}/zona`);
  const data = await res.json();
  return data.jugador;
}

console.log('Posición ANTES de mover:', JSON.stringify(await leerPosicionJugador()));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const brujula = page.locator('button[title="Moverte por la zona"]');
await brujula.click();
await page.waitForTimeout(1500);

// Clic en un punto claramente distinto al actual (centro-derecha del mapa, zona vacía)
await page.mouse.click(650, 450);
console.log('Clic de movimiento enviado, esperando...');
await page.waitForTimeout(4000);

await page.screenshot({ path: 'checklist0922_21_tras_mover.png', fullPage: true });

const posicionMovida = await leerPosicionJugador();
console.log('Posición DESPUÉS de mover:', JSON.stringify(posicionMovida));

await browser.close();

// Reiniciar la partida
const restartRes = await fetch(`http://localhost:3001/saves/${SAVE_ID}/restart`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
console.log('Restart status:', restartRes.status);

const posicionTrasRestart = await leerPosicionJugador();
console.log('Posición TRAS REINICIO:', JSON.stringify(posicionTrasRestart));

if (JSON.stringify(posicionMovida) === JSON.stringify(posicionTrasRestart)) {
  console.log('*** BUG CONFIRMADO: la posición NO se reinició, se mantuvo igual que antes del restart ***');
} else {
  console.log('OK: la posición cambió tras el reinicio (no se quedó "sucia").');
}
