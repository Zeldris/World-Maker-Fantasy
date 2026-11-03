"""IMG-27: image-generator/scripts/encuadre.py pasa el `encuadre` de la ficha a HERO y MANADA de montar.sh."""
import os
import subprocess
import sys
import unittest

from comun import RAIZ, carpeta, escribir

SCRIPTS = os.path.join(RAIZ, 'image-generator', 'scripts')
sys.path.insert(0, SCRIPTS)
import encuadre as en  # noqa: E402

CON_MANADA = {'prompt': {'manada': 'a pack'}}


def copias(manada: str) -> list:
    return [tuple(int(v) for v in c.split(':')[:3]) for c in manada.split()]


def ficha(**encuadre):
    return {**CON_MANADA, 'encuadre': encuadre}


class Posiciones(unittest.TestCase):
    def pos(self, f, ancho=640, alto=256):
        return en.posiciones(en.leer(f), ancho, alto)

    def test_por_defecto_sujeto_a_la_izquierda_y_tres_copias(self):
        hero, manada = self.pos(CON_MANADA)
        self.assertEqual(hero, '19:246:288')
        self.assertEqual(len(manada.split()), 3)

    def test_escala_con_el_ancho(self):
        f = ficha(sujeto={'lado': 'derecha', 'ancho': 0.5}, manada={'numero': 4})
        h1, m1 = self.pos(f, 640, 256)
        h2, m2 = self.pos(f, 1280, 512)
        for a, b in zip([tuple(map(int, h1.split(':')))] + copias(m1), [tuple(map(int, h2.split(':')))] + copias(m2)):
            for x, y in zip(a, b):
                self.assertLessEqual(abs(2 * x - y), 2, (h1, m1, h2, m2))

    def test_lado_del_sujeto(self):
        x = {lado: int(self.pos(ficha(sujeto={'lado': lado, 'ancho': 0.5}))[0].split(':')[0])
             for lado in ('izquierda', 'centro', 'derecha')}
        self.assertEqual(x, {'izquierda': 19, 'centro': 160, 'derecha': 301})

    def test_perspectiva_la_manada_pisa_entre_horizonte_y_sujeto_y_mengua_hacia_el_fondo(self):
        f = ficha(horizonte=0.4, sujeto={'ancho': 0.5, 'pie': 0.9}, manada={'numero': 5, 'distancia': 'cerca'})
        hero, manada = self.pos(f)
        c = copias(manada)  # orden de pintado: de la más lejana a la más cercana
        anchos, pies = [w for _, _, w in c], [p for _, p, _ in c]
        self.assertEqual(anchos, sorted(anchos))
        self.assertEqual(pies, sorted(pies))
        self.assertTrue(all(0.4 * 256 < p < 0.9 * 256 for p in pies), pies)
        self.assertEqual(anchos[-1], round(0.6 * 320))  # la más cercana: la fracción de «cerca» del ancho del sujeto
        self.assertEqual(anchos[0], round(0.3 * 320))  # la más lejana, a la mitad

    def test_la_copia_mayor_va_al_lado_libre(self):
        for lado, mayor_a_la_derecha in (('izquierda', True), ('derecha', False)):
            c = copias(self.pos(ficha(sujeto={'lado': lado, 'ancho': 0.4}, manada={'numero': 3}))[1])
            self.assertEqual(c[-1][0] > c[0][0], mayor_a_la_derecha, (lado, c))

    def test_las_copias_no_se_salen_del_lienzo(self):
        c = copias(self.pos(ficha(sujeto={'ancho': 1.0}, manada={'numero': 1, 'distancia': 'cerca'}))[1])
        self.assertTrue(all(0 <= x and x + w <= 640 for x, _, w in c), c)

    def test_alternar_voltea_una_de_cada_dos(self):
        m = self.pos(ficha(manada={'numero': 4, 'alternar': True}))[1].split()
        self.assertEqual([c.endswith(':v') for c in m], [True, False, True, False])

    def test_sin_manada_en_el_prompt_no_hay_copias(self):
        self.assertEqual(self.pos({'prompt': {}})[1], '')
        self.assertEqual(len(self.pos({'prompt': {}, 'encuadre': {'manada': {'numero': 2}}})[1].split()), 2)


class Rangos(unittest.TestCase):
    def falla(self, f, motivo):
        with self.assertRaises(en.ReglaRota) as e:
            en.leer(f)
        self.assertIn(motivo, str(e.exception))

    def test_valores_fuera_de_rango_dicen_cual(self):
        self.falla(ficha(sujeto={'lado': 'arriba'}), "sujeto.lado='arriba'; los que hay son: izquierda, centro, derecha")
        self.falla(ficha(sujeto={'ancho': 1.5}), 'sujeto.ancho=1.5 fuera de rango (de 0.1 a 1.0)')
        self.falla(ficha(horizonte=0.6, sujeto={'pie': 0.65}), 'sujeto.pie=0.65 fuera de rango (de 0.7 a 1.0)')
        self.falla(ficha(manada={'numero': 2.5}), 'manada.numero=2.5 tiene que ser un entero')
        self.falla(ficha(manada={'numero': 9}), 'manada.numero=9 fuera de rango (de 0 a 8)')
        self.falla(ficha(manada={'distancia': 'muy lejos'}), "manada.distancia='muy lejos'; los que hay son: cerca, media, lejos")
        self.falla(ficha(manada={'alternar': 'si'}), "manada.alternar='si' tiene que ser true o false")


class Orden(unittest.TestCase):
    def correr(self, *args):
        return subprocess.run([sys.executable, os.path.join(SCRIPTS, 'encuadre.py'), *args], capture_output=True, text=True)

    def test_da_las_variables_para_eval(self):
        r = self.correr('-', '640', '256')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout, "HERO=19:246:288\nMANADA='82:127:50 282:140:76 483:153:101'\n")

    def test_ficha_con_un_valor_malo_sale_con_2_y_el_motivo(self):
        f = os.path.join(carpeta(), 'f.json')
        escribir(f, '{"encuadre": {"sujeto": {"lado": "arriba"}}}')
        r = self.correr(f, '640', '256')
        self.assertEqual(r.returncode, 2)
        self.assertIn("encuadre: sujeto.lado='arriba'", r.stderr)
        self.assertEqual(r.stdout, '')

    def test_sin_tamano_da_el_uso(self):
        r = self.correr('-')
        self.assertEqual(r.returncode, 2)
        self.assertIn('encuadre.py <ficha.json>', r.stderr)


if __name__ == '__main__':
    unittest.main()
