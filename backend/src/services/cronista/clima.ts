// Sucesos de clima para el Libro (CR-3, hito 0.2). El clima no se guarda: sale del reloj
// (`worldClock.ts`). Al cruzar días se apuntan las tormentas de la región donde está el personaje
// (las de las 8 regiones llenarían el Libro de ruido) y el cambio de estación.
import { climaFor, estacionFor, estacionNombreFor } from '../worldClock.js';
import type { NuevoSuceso } from './sucesos.js';
import { slugify } from '../../lib/slugify.js';

/// «Las Llanuras…» → «las Llanuras…» para usarlo en mitad de una frase.
const enFrase = (region: string) => region.replace(/^(La|Las|El|Los) /, (m) => m.toLowerCase());

const MINUTOS_DIA = 1440;
/// Tope de días mirados de golpe (un viaje o un descanso muy largo): basta con los últimos.
const MAX_DIAS = 30;

type SucesoClima = Omit<NuevoSuceso, 'saveId' | 'origen'>;

/// Puro: sucesos de clima de los días que empiezan entre `minutosAntes` (excluido) y
/// `minutosDespues` (incluido), para el personaje en `region` (con su nombre de lugar legible).
export function sucesosDeClima(minutosAntes: number, minutosDespues: number, region: string | null, raza: string | null): SucesoClima[] {
  const primerDia = Math.floor(minutosAntes / MINUTOS_DIA) + 1;
  const ultimoDia = Math.floor(minutosDespues / MINUTOS_DIA);
  const sucesos: SucesoClima[] = [];
  for (let d = Math.max(primerDia, ultimoDia - MAX_DIAS + 1); d <= ultimoDia; d++) {
    const inicio = d * MINUTOS_DIA;
    const estacion = estacionFor(inicio);
    if (estacion !== estacionFor(inicio - MINUTOS_DIA)) {
      sucesos.push({ tipo: 'CAMBIO_ESTACION', fictionalMinutes: inicio, actores: [], datos: { estacion: estacionNombreFor(estacion, raza) } });
    }
    const clima = climaFor(inicio, region);
    if (region && (clima === 'TORMENTA_GRANDE' || clima === 'TORMENTA_EXTREMA')) {
      sucesos.push({
        tipo: clima === 'TORMENTA_EXTREMA' ? 'TORMENTA_EXTREMA' : 'TORMENTA',
        fictionalMinutes: inicio,
        regionSlug: slugify(region),
        actores: [{ entidadTipo: 'REGION', entidadId: slugify(region), papel: 'LUGAR' }],
        datos: { region: enFrase(region) },
      });
    }
  }
  return sucesos;
}
