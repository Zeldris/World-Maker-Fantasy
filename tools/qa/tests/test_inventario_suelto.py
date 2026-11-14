"""QA-301: tools/qa/inventario-suelto.py, sobre un backend falso con consultas buenas y malas."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir


class InventarioSuelto(unittest.TestCase):
    def correr(self, codigo: str, nombre: str = 'services/x.ts'):
        r = carpeta()
        escribir(os.path.join(r, 'backend', 'src', nombre), codigo)
        return subprocess.run(['python3', os.path.join(QA, 'inventario-suelto.py'), r], capture_output=True, text=True)

    def test_con_dueno_nulo_pasa(self):
        p = self.correr('await tx.inventoryItem.findMany({ where: { saveId, slot: null, companionId: null, subjectId: null } });\n')
        self.assertEqual((p.returncode, p.stdout), (0, ''))

    def test_sin_slot_null_pasa(self):
        p = self.correr('await prisma.inventoryItem.findMany({ where: { saveId } });\nawait tx.inventoryItem.updateMany({ where: { companionId: c }, data: { slot: null } });\n')
        self.assertEqual((p.returncode, p.stdout), (0, ''))

    def test_slot_null_sin_companion_falla_por_ese_motivo(self):
        p = self.correr('\nconst a = 1;\nawait tx.inventoryItem.findFirst({\n  where: { saveId, slot: null },\n});\n')
        self.assertEqual(p.returncode, 1)
        self.assertIn('services/x.ts:3: findFirst con slot: null sin companionId|subjectId', p.stdout)

    def test_falta_solo_el_subdito(self):
        p = self.correr('await db.item.count({ where: { slot: null, companionId: null } });\n')
        self.assertEqual(p.returncode, 1)
        self.assertIn('count con slot: null sin subjectId', p.stdout)
        self.assertNotIn('companionId|', p.stdout)

    def test_relacion_anidada(self):
        p = self.correr('const s = await prisma.save.findUnique({ select: { inventoryItems: { where: { slot: null } } } });\n')
        self.assertEqual(p.returncode, 1)
        self.assertIn('inventoryItems con slot: null', p.stdout)

    def test_data_slot_null_no_es_consulta(self):
        p = self.correr('await tx.inventoryItem.update({ where: { id }, data: { slot: null } });\n')
        self.assertEqual((p.returncode, p.stdout), (0, ''))

    def test_comentario_de_excusa_en_la_linea_anterior_o_la_misma(self):
        p = self.correr('// inventario: todos (también lo de compañeros)\nawait tx.inventoryItem.deleteMany({ where: { saveId, slot: null } });\n'
                        'await tx.inventoryItem.count({ where: { slot: null } }); // inventario: todos\n')
        self.assertEqual((p.returncode, p.stdout), (0, ''))

    def test_excusa_lejana_no_vale(self):
        p = self.correr('// inventario: todos\n\nawait tx.inventoryItem.count({ where: { slot: null } });\n')
        self.assertEqual(p.returncode, 1)

    def test_los_tests_no_se_miran(self):
        r = carpeta()
        malo = 'await tx.inventoryItem.count({ where: { slot: null } });\n'
        escribir(os.path.join(r, 'backend', 'src', 'a.test.ts'), malo)
        escribir(os.path.join(r, 'backend', 'src', '__tests__', 'b.ts'), malo)
        p = subprocess.run(['python3', os.path.join(QA, 'inventario-suelto.py'), r], capture_output=True, text=True)
        self.assertEqual((p.returncode, p.stdout), (0, ''))

    def test_strings_y_comentarios_no_confunden(self):
        p = self.correr('const t = "tx.inventoryItem.count({ where: { slot: null } })";\n// prisma.inventoryItem.count({ where: { slot: null } })\n')
        self.assertEqual((p.returncode, p.stdout), (0, ''))

    def test_companion_id_sin_null_literal_falla(self):
        p = self.correr('await tx.inventoryItem.count({ where: { slot: null, companionId, subjectId: null } });\n')
        self.assertEqual(p.returncode, 1)
        self.assertIn('count con slot: null sin companionId', p.stdout)
        self.assertNotIn('companionId|', p.stdout)

    def test_where_anidado_antes_del_de_primer_nivel_no_lo_tapa(self):
        p = self.correr('await prisma.inventoryItem.findMany({\n  include: { x: { where: { slot: null, companionId: null, subjectId: null } } },\n'
                        '  where: { slot: null },\n});\n')
        self.assertEqual(p.returncode, 1)
        self.assertIn('findMany con slot: null sin companionId|subjectId', p.stdout)

    def test_where_anidado_solo_no_cuenta_como_primer_nivel(self):
        p = self.correr('await prisma.inventoryItem.findMany({ include: { x: { where: { slot: null } } }, where: { saveId } });\n')
        self.assertEqual((p.returncode, p.stdout), (0, ''))

    def test_los_spec_no_se_miran(self):
        r = carpeta()
        escribir(os.path.join(r, 'backend', 'src', 'a.spec.ts'), 'await tx.inventoryItem.count({ where: { slot: null } });\n')
        p = subprocess.run(['python3', os.path.join(QA, 'inventario-suelto.py'), r], capture_output=True, text=True)
        self.assertEqual((p.returncode, p.stdout), (0, ''))


if __name__ == '__main__':
    unittest.main()
