"""QA-113: tools/qa/mapa-agente.py (QA-108), sobre un repo de prueba."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir, git

CODIGO = '''export function calcular(a: number) {
  return pasoUno(a);
}
class Turno {
  private async resolver(x: string): Promise<void> {
  }
}
const llamada = resolverOtro(1);
'''


class MapaAgente(unittest.TestCase):
    def setUp(self):
        self.repo = carpeta()
        git(self.repo, 'init', '-q')
        escribir(os.path.join(self.repo, 'backend/src/a.ts'), CODIGO)

    def comprobar(self, mapa: str) -> subprocess.CompletedProcess:
        escribir(os.path.join(self.repo, 'docs/mapa-agente.md'), mapa)
        return subprocess.run(['python3', os.path.join(QA, 'mapa-agente.py')], cwd=self.repo, capture_output=True, text=True)

    def test_referencias_buenas_pasan(self):
        r = self.comprobar('- `b/a.ts#calcular` llama a `pasoUno`; método `b/a.ts#resolver`; carpeta `backend/src/`.\n')
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn('0 referencias rotas en 4', r.stdout)

    def test_archivo_que_no_existe_falla(self):
        r = self.comprobar('- `b/no.ts`\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('mapa-agente.md:1: no existe backend/src/no.ts', r.stdout)

    def test_una_llamada_no_cuenta_como_definicion(self):
        r = self.comprobar('- `b/a.ts#resolverOtro`\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('no define resolverOtro', r.stdout)

    def test_nombre_suelto_ausente_falla_con_la_linea_de_la_vineta(self):
        r = self.comprobar('# Título\n\n- `b/a.ts#calcular` y\n  luego `pasoDos`\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('mapa-agente.md:3: backend/src/a.ts no define pasoDos', r.stdout)

    def test_nombre_suelto_sin_archivo_delante_no_se_mira(self):
        self.assertEqual(self.comprobar('- `cualquierCosa` en `b/`\n').returncode, 0)


if __name__ == '__main__':
    unittest.main()
