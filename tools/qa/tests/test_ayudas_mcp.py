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
        for texto in ('falta window.tk.texto', 'tapada por', 'deshabilitado', 'No hay nada visible', 'forzar'):
            self.assertIn(texto, js)
        # `{"contiene":"…"}` solo vale, además de `{"texto":"…","contiene":true}`.
        self.assertIn("typeof tk.contiene === 'string'", js)
        # `contiene` truthy activa la búsqueda parcial; el atajo es un solo dígito + espacio y exacto prueba antes el texto tal cual.
        self.assertIn('const contiene = !!tk.contiene;', js)
        self.assertIn('/^\\d\\s+/', js)
        self.assertIn('[false, true]', js)
        self.assertIn('casó sin el número', js)
        # Orden exacto: capa de arriba tal cual, capa sin atajo, documento tal cual, documento sin atajo (un botón de detrás
        # del modal no gana a «1 Reanudar» de dentro).
        self.assertIn('[[false, true], [true, true], [false, false], [true, false]]', js)
        # Con varias coincidencias no pulsa otra si la pedida está tapada; no desplaza candidato a candidato.
        self.assertNotIn('todos.map', js)
        self.assertIn("closest('button,[role=\"button\"]')", js)
        self.assertIn('new MouseEvent', js)

    def test_mover_avisa_de_lo_que_no_se_mueve(self):
        js = leer(os.path.join(MCP, 'mover.js'))
        for texto in ('cae fuera del mapa', 'está tapado por', 'SIN MOVIMIENTO', 'POSICIÓN:', 'encuentro abierto', 'deshabilitado'):
            self.assertIn(texto, js)
        # Un encuentro abierto es AVISO (pelear.js sigue con interactuar.js); la comprobación previa solo bloquea por paneles.
        self.assertIn("'AVISO: hay un encuentro abierto", js)
        self.assertIn('hago el clic igualmente', js)
        self.assertIn('solo cambió la hora', js)
        self.assertIn("const enModal = page.getByRole('dialog')", js)

    def test_mover_mide_el_svg_del_mapa_no_la_leyenda(self):
        # Tanda 24a: medía un svg de 20×20 de la leyenda («cae fuera del mapa, que ocupa x 59–79»).
        js = leer(os.path.join(MCP, 'mover.js'))
        self.assertIn("querySelectorAll('svg title, [data-testid=\"jugador-zona\"]')", js)
        self.assertIn("m.closest('[role=\"dialog\"]')", js)

        # Los svg pequeños (iconos con <title> dentro del modal) no cuentan como mapa; sin grandes, cae a los de la página.
        self.assertIn('area(m) >= 100 * 100', js)
        self.assertIn("grandes(candidatos.filter((m) => m.closest('[role=\"dialog\"]')))", js)


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
