"""Retro del piloto de Galivelop-workflow (2026-10-23, propuesta 4): `tests-vitest.sh` escribe cada log en un
archivo propio de `mktemp`, no en una ruta fija que pisan dos pushes a la vez (dos sesiones en la Deck); en verde lo
borra, y si no puede crearlo lo dice en vez de dar los tests por rojos."""
import os
import shutil
import subprocess
import unittest

from comun import QA, ENV_GIT, carpeta, escribir, git

ROJO = 'echo "FAIL src/a.test.ts"\nexit 1\n'
VERDE = 'echo "Tests 1 passed"\n'


def repo(host: str = ROJO) -> str:
    """Un repo con `tests-vitest.sh` y un `host.sh` falso que hace de vitest (en rojo o en verde)."""
    r = carpeta()
    git(r, 'init', '-q')
    os.makedirs(os.path.join(r, 'tools', 'qa'))
    shutil.copy(os.path.join(QA, 'tests-vitest.sh'), os.path.join(r, 'tools', 'qa', 'tests-vitest.sh'))
    escribir(os.path.join(r, 'tools', 'qa', 'host.sh'), host)
    escribir(os.path.join(r, 'backend', 'src', 'a.ts'), 'export const a = 1\n')
    escribir(os.path.join(r, 'backend', 'src', 'a.integration.test.ts'), '\n')
    escribir(os.path.join(r, 'backend', 'uploads', 'images', 'x.png'), '')
    return r


def correr(r: str, tmp: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(['bash', 'tools/qa/tests-vitest.sh', *args], cwd=r, capture_output=True, text=True,
                          env={**ENV_GIT, 'TMPDIR': tmp})


def ruta_del_log(salida: str) -> str:
    linea = [l for l in salida.splitlines() if 'log completo en ' in l]
    return linea[0].split('log completo en ')[1].rstrip(')') if linea else ''


CASOS = {
    'unidad': ('unidad', 'backend/src/a.ts'),
    'imagenes': ('unidad', 'backend/uploads/images/x.png'),
    'integracion': ('integracion', 'backend/src/a.ts'),
}


class LogsPropios(unittest.TestCase):
    def test_dos_pushes_no_comparten_log(self):
        for caso, args in CASOS.items():
            with self.subTest(caso):
                r, tmp = repo(), carpeta()
                logs = []
                for _ in range(2):
                    p = correr(r, tmp, *args)
                    self.assertEqual(p.returncode, 1, p.stdout + p.stderr)
                    logs.append(ruta_del_log(p.stdout))
                    self.assertTrue(logs[-1].startswith(tmp), p.stdout)
                self.assertNotEqual(logs[0], logs[1], 'dos pushes escriben el mismo log')
                for log in logs:
                    with open(log, encoding='utf-8') as f:
                        self.assertIn('FAIL src/a.test.ts', f.read())

    def test_en_verde_no_deja_logs(self):
        for caso, args in CASOS.items():
            with self.subTest(caso):
                tmp = carpeta()
                p = correr(repo(VERDE), tmp, *args)
                self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
                self.assertEqual(os.listdir(tmp), [])

    def test_sin_carpeta_para_el_log_no_dice_tests_en_rojo(self):
        p = correr(repo(VERDE), os.path.join(carpeta(), 'no-existe'), 'unidad', 'backend/src/a.ts')
        self.assertEqual(p.returncode, 1)
        self.assertIn('no se pudo crear el log de related-backend', p.stderr)
        self.assertNotIn('en rojo', p.stdout)


if __name__ == '__main__':
    unittest.main()
