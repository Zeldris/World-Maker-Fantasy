// QA-41 (retro de QA-27, 2026-10-12): navegador que se queda abierto entre órdenes, para jugar paso a
// paso cuando el MCP de Playwright no conecta. Cada orden es un trozo de JS (con `page`, `shot`,
// `log`, `FRONT` y `BACK` a mano) que llega por POST y devuelve lo que registre, más los errores de
// la página desde la orden anterior. Ejecuta lo que le llegue, así que solo escucha en 127.0.0.1, pide
// la clave de `driver.token` (nueva en cada arranque; `orden.sh` la manda) y rechaza toda petición que
// traiga `Origin` (la mandaría una página web, también la que maneja el propio driver).
//
// Arrancar:  nohup node tools/playwright-e2e/driver.mjs > tools/playwright-e2e/driver.log 2>&1 &
// Capturas (QA-149): shot('n') = JPEG calidad 50; shot('n',{selector:'…'}|{clip}|{completo:true}|{png:true}|{calidad:n});
// selector no admite clip ni completo (error).
// Usar:      bash tools/playwright-e2e/orden.sh "await page.click('text=Nueva partida'); return await shot('menu')"
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { abrirNavegador, FRONT, BACK } from './lib.mjs';

const PUERTO = Number(process.env.DRIVER_PORT ?? 9333);
const SHOTS = process.env.SHOTS ?? new URL('./shots', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const CLAVE = randomBytes(24).toString('hex');
writeFileSync(new URL('./driver.token', import.meta.url), CLAVE, { mode: 0o600 });

const { browser, page } = await abrirNavegador();
// `kill <pid>` lo cierra: sin esto, el navegador abierto lo mantenía vivo.
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    browser.close().finally(() => process.exit(0));
  });
}
const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errores.push(`console: ${m.text().slice(0, 300)}`);
});
// Sin el frontend levantado arranca igual: la primera orden puede hacer `await page.goto(FRONT)`.
await page.goto(FRONT).catch((e) => console.log(`aviso: ${FRONT} no responde (${e.message.split('\n')[0]})`));

http
  .createServer((req, res) => {
    if (req.headers.origin || req.headers['x-driver-token'] !== CLAVE) {
      res.statusCode = 403;
      res.end('Prohibido: falta la clave de driver.token o la petición viene de una página.');
      req.resume();
      return;
    }
    let codigo = '';
    req.on('data', (c) => (codigo += c));
    req.on('end', async () => {
      const salida = [];
      const log = (...a) => salida.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
      // QA-149: por defecto JPEG de calidad 50 (unas 4-5 veces menos bytes que el PNG). Opciones: {calidad:n}
      // la calidad, {png:true} PNG, {completo:true} PNG de la página entera, {clip:{x,y,width,height}} una región,
      // {selector} recorta a ese elemento (no admite clip ni completo: locator.screenshot los ignoraría).
      // Misma semántica que mcp/captura.js.
      const shot = async (nombre, o = {}) => {
        if (o.selector && (o.clip || o.completo)) throw new Error('shot: con `selector` no se puede usar `clip` ni `completo`');
        const png = o.png || o.completo;
        const ruta = `${SHOTS}/${nombre}.${png ? 'png' : 'jpg'}`;
        const opc = { path: ruta, ...(png ? { type: 'png' } : { type: 'jpeg', quality: o.calidad ?? 50 }) };
        if (o.completo) opc.fullPage = true;
        if (o.clip) opc.clip = o.clip;
        if (o.selector) await page.locator(o.selector).first().screenshot(opc);
        else await page.screenshot(opc);
        return ruta;
      };
      try {
        const orden = new Function('page', 'shot', 'log', 'FRONT', 'BACK', `return (async () => { ${codigo} })()`);
        const r = await orden(page, shot, log, FRONT, BACK);
        if (r !== undefined) log(r);
      } catch (e) {
        salida.push(`EXC: ${e.message.split('\n').slice(0, 6).join('\n')}`);
      }
      if (errores.length) {
        salida.push(`ERRORES: ${JSON.stringify(errores.slice(0, 5))}`);
        errores.length = 0;
      }
      res.end(salida.join('\n'));
    });
  })
  .listen(PUERTO, '127.0.0.1', () => console.log(`driver en 127.0.0.1:${PUERTO}, capturas en ${SHOTS}`));
