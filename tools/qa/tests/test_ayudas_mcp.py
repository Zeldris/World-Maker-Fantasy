"""Ayudas de tools/playwright-e2e/mcp (las que lanza `o.sh`): sin navegador solo se puede comprobar que parsean y que
`pulsar.js` y `mover.js` conservan sus errores claros (P-pulsar/mover, tandas 22-24, 2026-10-23): antes pulsar daba
«pulsado» sin haber accionado nada y mover daba «AVISO: (ninguno)» sin decir si el personaje se había movido."""
import glob
import os
import shutil
import subprocess
import unittest

from comun import RAIZ, leer

MCP = os.path.join(RAIZ, 'tools', 'playwright-e2e', 'mcp')
PARSEA = "const fs=require('fs');const AF=Object.getPrototypeOf(async function(){}).constructor;" \
         "for(const f of process.argv.slice(1)){try{new AF('return ('+fs.readFileSync(f,'utf8')+')')}catch(e){console.log(f+': '+e.message);process.exit(1)}}"


class AyudasMcp(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'sin node (en la Deck va por host.sh)')
    def test_todas_parsean(self):
        r = subprocess.run(['node', '-e', PARSEA, *sorted(glob.glob(os.path.join(MCP, '*.js')))], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_pulsar_y_mover_conservan_sus_errores_claros(self):
        # Lo que no cubre el navegador (ramas que necesitan la app): textos de error de pulsar y mover.
        js = leer(os.path.join(MCP, 'pulsar.js'))
        for texto in ('tapada por', 'deshabilitado', 'forzar'):
            self.assertIn(texto, js)
        js = leer(os.path.join(MCP, 'mover.js'))
        for texto in ('está tapado por', 'SIN MOVIMIENTO', 'POSICIÓN:', 'encuentro abierto', 'deshabilitado'):
            self.assertIn(texto, js)
        self.assertIn("'AVISO: hay un encuentro abierto", js)
        self.assertIn('solo cambió la hora', js)

    def test_comportamiento_en_navegador(self):
        # QA-219: pulsar.js y mover.js sobre una página fija con Chromium (el orden de pasadas, el svg del mapa).
        if not os.path.isdir(os.path.join(RAIZ, 'tools', 'playwright-e2e', 'node_modules', 'playwright')):
            self.skipTest('sin Playwright: cd tools/playwright-e2e && npm ci')
        r = subprocess.run(['bash', os.path.join(RAIZ, 'tools', 'qa', 'host.sh'), 'node', 'tools/qa/tests/ayudas_mcp_navegador.mjs'],
                           capture_output=True, text=True, timeout=240)
        if r.returncode == 2:
            self.skipTest('sin Chromium de Playwright: ' + r.stderr.strip())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_combate_leer_no_pulsa_nada(self):
        # QA-218: `leer` (o `rondas:0`) devuelve antes del bucle de rondas; ahí no hay `click`.
        js = leer(os.path.join(MCP, 'combate.js'))
        self.assertIn('leer || rondas === 0', js)
        leer_js = js[js.index('leer || rondas === 0'):js.index('for (let r = 0')]
        for prohibido in ('.click(', 'mouse.', 'press('):
            self.assertNotIn(prohibido, leer_js)
        self.assertIn('return [', leer_js)

    def test_o_sh_atajos(self):
        sh = leer(os.path.join(RAIZ, 'tools', 'qa', 'deck', 'o.sh'))
        self.assertIn('viajar-a:[!{]*', sh)
        self.assertIn('combate:leer', sh)

    def test_viajar_a_dice_que_lugares_hay(self):
        js = leer(os.path.join(MCP, 'viajar-a.js'))
        for texto in ('no está en «Viajar». Hay:', 'solo salen los ya visitados', 'Moverte por la zona', 'combate abierto'):
            self.assertIn(texto, js)

    def test_puntos_e_interactuar_avisan_en_vez_de_esperar(self):
        puntos = leer(os.path.join(MCP, 'puntos.js'))
        for texto in ('ERROR: no está «Moverte por la zona»', 'está deshabilitado', 'tapado por otro panel', 'hay una escena abierta'):
            self.assertIn(texto, puntos)
        self.assertIn('timeout: 5000', puntos)
        interactuar = leer(os.path.join(MCP, 'interactuar.js'))
        self.assertIn('ERROR: «Interactuar» está tapado por otro panel', interactuar)
        self.assertIn('timeout: 5000', interactuar)

    def test_captura_guarda_en_shots_con_orden_sh(self):
        js = leer(os.path.join(MCP, 'captura.js'))
        self.assertIn("globalThis.AYUDAS_DIR", js)
        self.assertIn("/shots`", js)
        self.assertIn("'.playwright-mcp'", js)  # con el MCP, su carpeta (ignorada por git)


if __name__ == '__main__':
    unittest.main()
