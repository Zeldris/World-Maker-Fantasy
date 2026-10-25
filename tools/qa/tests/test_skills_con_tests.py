"""QA-236: tools/qa/skills-con-tests.py, sobre un repo falso con una skill con tests y otra sin ellos."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir

CI = 'python3 -m unittest discover -s .claude/skills/mia/scripts\n'


class SkillsConTests(unittest.TestCase):
    def repo(self, ci: str) -> str:
        r = carpeta()
        for n in ('medir.py', 'test_medir.py'):
            escribir(os.path.join(r, '.claude', 'skills', 'mia', 'scripts', n), '')
        escribir(os.path.join(r, '.claude', 'skills', 'sin', 'scripts', 'medir.py'), '')  # sin tests: nada que correr
        escribir(os.path.join(r, '.github', 'workflows', 'ci.yml'), ci)
        escribir(os.path.join(r, 'tools', 'qa', 'ci-local.sh'), ci)
        return r

    def correr(self, raiz: str):
        return subprocess.run(['python3', os.path.join(QA, 'skills-con-tests.py'), raiz], capture_output=True, text=True)

    def test_tests_que_corre_el_ci_pasan(self):
        r = self.correr(self.repo(CI))
        self.assertEqual((r.returncode, r.stderr), (0, ''))

    def test_tests_que_el_ci_no_corre_fallan_por_cada_archivo(self):
        r = self.correr(self.repo('nada\n'))
        self.assertEqual(r.returncode, 1)
        self.assertIn('.github/workflows/ci.yml no corre los tests de mia', r.stderr)
        self.assertIn('tools/qa/ci-local.sh no corre los tests de mia', r.stderr)
        self.assertNotIn('de sin', r.stderr)


if __name__ == '__main__':
    unittest.main()
