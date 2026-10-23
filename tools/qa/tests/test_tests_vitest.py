"""Retro del piloto de Galivelop-workflow (2026-10-23, propuesta 4): `tests-vitest.sh` escribe cada log en un
archivo propio de `mktemp`, no en una ruta fija de /tmp que pisan dos pushes a la vez (dos sesiones en la Deck)."""
import os
import shutil
import subprocess
import unittest

from comun import QA, ENV_GIT, carpeta, escribir, git


def repo_con_host_rojo() -> str:
    """Un repo con `tests-vitest.sh` y un `host.sh` falso que escribe su salida y falla, como un vitest en rojo."""
    repo = carpeta()
    git(repo, 'init', '-q')
    os.makedirs(os.path.join(repo, 'tools', 'qa'))
    shutil.copy(os.path.join(QA, 'tests-vitest.sh'), os.path.join(repo, 'tools', 'qa', 'tests-vitest.sh'))
    escribir(os.path.join(repo, 'tools', 'qa', 'host.sh'), 'echo "FAIL src/a.test.ts"\nexit 1\n')
    escribir(os.path.join(repo, 'backend', 'src', 'a.ts'), 'export const a = 1\n')
    escribir(os.path.join(repo, 'backend', 'src', 'a.integration.test.ts'), '\n')
    return repo


def correr(repo: str, *args: str) -> subprocess.CompletedProcess:
    tmp = carpeta()
    return subprocess.run(['bash', 'tools/qa/tests-vitest.sh', *args], cwd=repo, capture_output=True, text=True,
                          env={**ENV_GIT, 'TMPDIR': tmp})


class LogsPropios(unittest.TestCase):
    def comprobar(self, *args: str, fija: str):
        r = correr(repo_con_host_rojo(), *args)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        linea = [l for l in r.stdout.splitlines() if 'log completo en' in l]
        self.assertTrue(linea, r.stdout)
        log = linea[0].split('log completo en ')[1].rstrip(')')
        self.assertNotEqual(log, fija, 'el log sigue en una ruta fija de /tmp')
        self.assertTrue(os.path.isfile(log), log)
        with open(log, encoding='utf-8') as f:
            self.assertIn('FAIL src/a.test.ts', f.read())

    def test_unidad_en_un_log_propio(self):
        self.comprobar('unidad', 'backend/src/a.ts', fija='/tmp/pre-push-related-backend.log')

    def test_integracion_en_un_log_propio(self):
        self.comprobar('integracion', 'backend/src/a.ts', fija='/tmp/pre-push-integracion.log')

    def test_imagenes_en_un_log_propio(self):
        repo = repo_con_host_rojo()
        escribir(os.path.join(repo, 'backend', 'uploads', 'images', 'x.png'), '')
        r = correr(repo, 'unidad', 'backend/uploads/images/x.png')
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn('log completo en', r.stdout)
        self.assertNotIn('/tmp/pre-push-imagenes.log', r.stdout)


if __name__ == '__main__':
    unittest.main()
