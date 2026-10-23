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

    def test_pulsar_da_errores_claros(self):
        js = leer(os.path.join(MCP, 'pulsar.js'))
        for texto in ('falta window.tk.texto', 'tapado por', 'deshabilitado', 'No hay nada visible', 'forzar'):
            self.assertIn(texto, js)
        # `{"contiene":"…"}` solo vale, además de `{"texto":"…","contiene":true}`.
        self.assertIn("typeof tk.contiene === 'string'", js)

    def test_mover_avisa_de_lo_que_no_se_mueve(self):
        js = leer(os.path.join(MCP, 'mover.js'))
        for texto in ('cae fuera del mapa', 'está tapado por', 'SIN MOVIMIENTO', 'POSICIÓN:', 'encuentro abierto', 'deshabilitado'):
            self.assertIn(texto, js)


if __name__ == '__main__':
    unittest.main()
