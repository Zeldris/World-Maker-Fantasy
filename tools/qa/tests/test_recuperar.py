"""QA-116: el `recuperar.py` de Galivelop-workflow (antes tools/qa/recuperar.py; piloto 2026-10-22), con un registro de
sesión de prueba (líneas de `comun`, QA-119). Mensajes en inglés; una expresión mala se busca como texto."""
import json
import os
import subprocess
import unittest

from comun import (GW, aviso, carpeta, compactacion, config_gw, escribir, git, orden, registro, respuesta, resultado,
                   ruido, texto, usuaria)

PARTES = [
    *ruido(),
    usuaria('el aviso dice "Territorio de Clan Serhu"\nen la cabecera'),
    respuesta('m1', 100, {'type': 'thinking', 'thinking': '', 'signature': 'x'}, orden('toolu_a', 'npx vitest run zona')),
    resultado('toolu_a', 'FAIL zona.test.ts: ' + 'x' * 40 + ' esperaba 3, llegó 4 ' + 'y' * 40),
    *compactacion(),
    respuesta('m2', 50, texto('otra cosa de Serhu'), isSidechain=True),
    # Una búsqueda anterior con este script y su resultado no se repiten.
    respuesta('m3', 60, orden('toolu_b', 'python3 .claude/gw/scripts/recuperar.py --buscar "Serhu" --max 3')),
    resultado('toolu_b', 'usuaria: Territorio de Clan Serhu'),
    # Nombrar el script no es llamarlo: un diff que lo menciona sí se busca.
    respuesta('m4', 70, texto('cambio en recuperar.py: «Morvath» con comillas')),
    # Lo que inyecta el sistema en un turno de la usuaria no lo dijo ella.
    usuaria('<system-reminder>aviso de Morvath</system-reminder>'),
    aviso('skill cargada sobre Morvath'),
]


class Recuperar(unittest.TestCase):
    def correr(self, *args: str, entrada: str | None = None, sesion: bool = True) -> subprocess.CompletedProcess:
        ruta = registro(os.path.join(carpeta(), 's.jsonl'), *PARTES)
        return subprocess.run(['python3', os.path.join(GW, 'recuperar.py'), *args, *(['--sesion', ruta] if sesion else [])],
                              input=entrada.replace('RUTA', ruta) if entrada else None, capture_output=True, text=True)

    def test_encuentra_lo_de_antes_de_compactar_sin_resumen_ni_subagentes_ni_busquedas_previas(self):
        # Con comillas y salto de línea en el texto: en la línea JSON van escapados.
        r = self.correr('--buscar', '"Territorio de Clan serhu"\nen|resumen')
        self.assertEqual(r.stdout, '[2026-10-19T10:00] user: el aviso dice "Territorio de Clan Serhu" en la cabecera\n'
                                   '1 fragment(s) match /"Territorio de Clan serhu"\nen|resumen/\n')

    def test_menciones_del_script_y_avisos_del_sistema(self):
        r = self.correr('--buscar', '«Morvath»|aviso de|cargada', '--ancho', '200')
        self.assertEqual(r.stdout, '[2026-10-19T10:00] claude: cambio en recuperar.py: «Morvath» con comillas\n'
                                   '[2026-10-19T10:00] system: <system-reminder>aviso de Morvath</system-reminder>\n'
                                   '[2026-10-19T10:00] system: skill cargada sobre Morvath\n'
                                   '3 fragment(s) match /«Morvath»|aviso de|cargada/\n')

    def test_expresion_mala_se_busca_como_texto_y_numero_malo_da_error(self):
        self.assertIn('0 fragment(s)', self.correr('--buscar', '(').stdout)
        r = self.correr('--buscar', 'x', '--max', 'y')
        self.assertEqual(r.returncode, 2)
        self.assertIn('invalid int value', r.stderr)

    def test_resultados_de_ordenes_recortados_y_con_tope(self):
        r = self.correr('--buscar', 'esperaba|vitest', '--ancho', '40', '--max', '1')
        self.assertRegex(r.stdout, r'result: …x+ esperaba 3, llegó 4…\n')
        self.assertIn('2 fragment(s) match /esperaba|vitest/ (the last 1 shown', r.stdout)

    def test_estado_cuenta_las_compactaciones_y_dice_como_recuperar(self):
        r = self.correr('--estado')
        self.assertIn('- Compactions in this session: 1', r.stdout)
        self.assertIn('recuperar.py --sesion', r.stdout)

    def test_estado_desde_el_gancho_lee_el_registro_de_la_entrada(self):
        r = self.correr('--estado', entrada=json.dumps({'transcript_path': 'RUTA', 'source': 'compact'}), sesion=False)
        self.assertIn('- Compactions in this session: 1', r.stdout)
        self.assertRegex(r.stdout, r'--sesion \S+s\.jsonl')

    def test_estado_da_tambien_la_fila_de_cada_worktree(self):
        # IMG-15: el gancho corre en la carpeta donde se abrió la sesión; la que trabaja en un worktree no veía su fila
        # y releía la bitácora entera (22 veces en una sesión).
        repo = os.path.join(carpeta(), 'repo')
        os.makedirs(repo)
        git(repo, 'init', '-q', '-b', 'principal')
        config_gw(repo)
        escribir(os.path.join(repo, 'docs', 'registros', 'traspaso.md'),
                 '| **Tarea en curso · `principal`** | lo de aquí |\n| **Tarea en curso · `otra`** | lo del worktree |\n')
        git(repo, 'add', '-A')
        git(repo, 'commit', '-qm', 'base')
        wt = os.path.join(os.path.dirname(repo), 'wt')
        git(repo, 'worktree', 'add', '-q', '-b', 'otra', wt)
        r = self.correr('--estado', '--root', repo)
        self.assertIn('row for `principal`: lo de aquí', r.stdout)
        self.assertIn(f'- Worktree {wt}, branch otra (its state: python3 {wt}/.claude/gw/scripts/recuperar.py --estado):\n'
                      '  - Log (docs/registros/traspaso.md), row for `otra`: lo del worktree\n', r.stdout)

    def test_sin_patron_da_la_ayuda(self):
        self.assertEqual(self.correr().returncode, 2)


if __name__ == '__main__':
    unittest.main()
