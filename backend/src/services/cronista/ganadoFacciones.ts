// Ganado de las facciones (CR-55 paso 55f, hito 0.3 — Q9/Q14 de la ronda de CR-55: el mismo sistema
// que el Reino de la jugadora, en agregado). El rebaño va por cohortes (`GanadoFaccion`): animales de
// la misma especie, sexo y día de nacimiento. Cada día, con las reglas de `ganaderia.ts`:
// - ganaderos: 1 por cada 5 animales de cada especie, sacados de sus trabajadores;
// - fibreros: los que hagan falta para el forraje (10 por trabajador; con pasto, la mitad de forraje);
// - esos trabajadores no dan la comida pasiva (Q15); a cambio, la leche y los huevos van a su comida;
// - una vez por semana: una cría por corral con pareja adulta y plaza, y la facción sacrifica lo viejo
//   y lo que no cabe para dejar sitio a las crías (la carne va a su comida).
// Puro, salvo el azar de la muerte de viejo (`random`).
import { ANIMALES_POR_GANADERO, consumoCorral, etapaDe, etapasDe, fraccionQueMuere, muertesPorCarencia, probMuerteDeViejoPorDia, produccionDelDia, tocaCria, type Etapa, type Sexo } from './ganaderia.js';

export interface Cohorte {
  especie: string;
  sexo: Sexo;
  nacidoEnDia: number;
  cantidad: number;
}

/// Plazas de corral de cada facción, por especie, sembradas por el canon hasta que las facciones
/// construyan (`CR-36`). Serhu: el gran recinto de Múrgol de Karot Veku.
export const PLAZAS_GANADO_FACCION: Record<string, Record<string, number>> = {
  'clan-serhu': { murgol: 80, corretolvas: 30 },
};

const anio = 120;
/// Rebaño inicial (Q14): Serhu, 60 Múrgol y 20 Corretolvas. Edades relativas al día de la siembra.
export const REBANO_INICIAL: Record<string, { especie: string; sexo: Sexo; edadDias: number; cantidad: number }[]> = {
  'clan-serhu': [
    { especie: 'murgol', sexo: 'F', edadDias: 3 * anio, cantidad: 26 },
    { especie: 'murgol', sexo: 'M', edadDias: 3 * anio, cantidad: 10 },
    { especie: 'murgol', sexo: 'F', edadDias: 60, cantidad: 6 },
    { especie: 'murgol', sexo: 'M', edadDias: 60, cantidad: 6 },
    { especie: 'murgol', sexo: 'F', edadDias: 10, cantidad: 6 },
    { especie: 'murgol', sexo: 'M', edadDias: 10, cantidad: 6 },
    { especie: 'corretolvas', sexo: 'F', edadDias: 200, cantidad: 10 },
    { especie: 'corretolvas', sexo: 'M', edadDias: 200, cantidad: 4 },
    { especie: 'corretolvas', sexo: 'F', edadDias: 5, cantidad: 3 },
    { especie: 'corretolvas', sexo: 'M', edadDias: 5, cantidad: 3 },
  ],
};

/// Corrales (de 20 plazas, Gran obrador) que tiene una facción para una especie: una cría por semana
/// en cada uno.
export function corralesDeFaccion(plazas: number): number {
  return Math.max(1, Math.ceil(plazas / 20));
}

export interface DatosDiaFaccion {
  dia: number;
  trabajadores: number;
  pasto: boolean;
  plazas: Record<string, number>;
  categoria: Record<string, string | null>;
  /// Comida que da sacrificar un adulto de cada especie (la carne).
  carnePorAnimal: Record<string, number>;
  /// Comida (de la gente) de la que pueden comer los carnívoros.
  comidaDisponible: number;
  /// Días seguidos sin comer del rebaño hasta ayer.
  diasSinComer: number;
  /// Agua de la que puede beber el rebaño y días seguidos sin beber hasta ayer (revisión del PR: el
  /// ganado de las facciones bebe, como el del Reino).
  bebidaDisponible: number;
  diasSinBeber: number;
  /// Valor en comida de cada producto comestible (por unidad, en curaHambre).
  valorComestible: Record<string, number>;
}

export interface ResultadoDiaFaccion {
  cohortes: Cohorte[];
  ganaderos: number;
  fibreros: number;
  comido: boolean;
  diasSinComer: number;
  bebido: boolean;
  diasSinBeber: number;
  bebidaConsumida: number;
  /// Comida que entra (leche, huevos, carne de lo sacrificado) menos la que comen los carnívoros.
  comidaNeta: number;
  /// Productos que no se comen (lana, plumas…), para el almacén de la facción.
  otros: Record<string, number>;
  crias: number;
  sacrificados: number;
  muertos: number;
}

const edad = (c: Cohorte, dia: number) => Math.max(0, dia - c.nacidoEnDia);

/// Un día del rebaño de una facción.
export function diaGanadoFaccion(entrada: Cohorte[], d: DatosDiaFaccion, random: () => number): ResultadoDiaFaccion {
  let cohortes = entrada.filter((c) => c.cantidad > 0).map((c) => ({ ...c }));
  const etapa = (c: Cohorte): Etapa => etapaDe(etapasDe(c.especie, d.categoria[c.especie] ?? null), edad(c, d.dia));
  const especies = [...new Set(cohortes.map((c) => c.especie))];
  const cuantos = (esp: string) => cohortes.filter((c) => c.especie === esp).reduce((s, c) => s + c.cantidad, 0);

  // Ganaderos y fibreros, hasta donde lleguen sus trabajadores.
  let libres = d.trabajadores;
  const ganaderosPorEspecie: Record<string, number> = {};
  for (const esp of especies) {
    const g = Math.min(libres, Math.ceil(cuantos(esp) / ANIMALES_POR_GANADERO));
    ganaderosPorEspecie[esp] = g;
    libres -= g;
  }
  const ganaderos = d.trabajadores - libres;
  const consumo = consumoCorral(
    cohortes.flatMap((c) => Array.from({ length: c.cantidad }, () => ({ a: { especie: c.especie, sexo: c.sexo, edadDias: edad(c, d.dia) }, etapa: etapa(c) }))),
    d.dia,
    d.pasto,
  );
  const fibreros = Math.min(libres, Math.ceil(consumo.forraje / 10));
  const comido = fibreros * 10 >= consumo.forraje && d.comidaDisponible >= consumo.comida;
  const diasSinComer = comido ? 0 : d.diasSinComer + 1;
  const bebido = d.bebidaDisponible >= consumo.agua;
  const diasSinBeber = bebido ? 0 : d.diasSinBeber + 1;
  const bebidaConsumida = Math.min(consumo.agua, d.bebidaDisponible);
  let comidaNeta = -Math.min(consumo.comida, d.comidaDisponible);

  // Producción.
  const otros: Record<string, number> = {};
  if (comido && bebido) {
    for (const esp of especies) {
      const etapas = cohortes.filter((c) => c.especie === esp).flatMap((c) => Array<Etapa>(c.cantidad).fill(etapa(c)));
      for (const [slug, n] of Object.entries(produccionDelDia(esp, etapas, ganaderosPorEspecie[esp] ?? 0, d.dia, true))) {
        if (slug in d.valorComestible) comidaNeta += (d.valorComestible[slug]! * n) / 10;
        else otros[slug] = (otros[slug] ?? 0) + n;
      }
    }
  }

  // Una vez por semana: crías y sacrificio.
  let crias = 0;
  let sacrificados = 0;
  if (d.dia % 7 === 0 && comido && bebido) {
    for (const esp of especies) {
      const plazas = d.plazas[esp] ?? 0;
      const corrales = corralesDeFaccion(plazas);
      // Sacrificio: toda la vejez y, si no queda sitio para las crías, los adultos más viejos (machos
      // primero, que hacen falta menos).
      let n = 0;
      for (const c of cohortes.filter((x) => x.especie === esp && etapa(x) === 'VEJEZ')) {
        n += c.cantidad;
        c.cantidad = 0;
      }
      const sobran = cuantos(esp) - (plazas - corrales);
      if (sobran > 0) {
        let resto = sobran;
        const adultos = cohortes.filter((x) => x.especie === esp && etapa(x) === 'ADULTO').sort((a, b) => (a.sexo === 'M' ? 0 : 1) - (b.sexo === 'M' ? 0 : 1) || a.nacidoEnDia - b.nacidoEnDia);
        for (const c of adultos) {
          const q = Math.min(c.cantidad, resto);
          c.cantidad -= q;
          resto -= q;
          n += q;
          if (resto <= 0) break;
        }
      }
      sacrificados += n;
      comidaNeta += n * (d.carnePorAnimal[esp] ?? 0);
      // La pareja se mira tras el sacrificio (revisión del PR: sin macho vivo no hay cría).
      const lista = cohortes.filter((c) => c.especie === esp && c.cantidad > 0).map((c) => ({ a: { especie: esp, sexo: c.sexo, edadDias: edad(c, d.dia) }, etapa: etapa(c) }));
      const hayPareja = tocaCria(lista, Number.MAX_SAFE_INTEGER, true);
      const nuevas = hayPareja ? Math.min(corrales, Math.max(0, plazas - cuantos(esp))) : 0;
      if (nuevas > 0) {
        const hembras = Math.ceil(nuevas / 2);
        cohortes.push({ especie: esp, sexo: 'F', nacidoEnDia: d.dia, cantidad: hembras });
        if (nuevas - hembras > 0) cohortes.push({ especie: esp, sexo: 'M', nacidoEnDia: d.dia, cantidad: nuevas - hembras });
        crias += nuevas;
      }
    }
  }

  // Muertes por hambre (primero las crías) y de viejos.
  let muertos = 0;
  const total = cohortes.reduce((s, c) => s + c.cantidad, 0);
  let porCarencia = muertesPorCarencia(total, fraccionQueMuere(diasSinComer, diasSinBeber));
  for (const c of [...cohortes].sort((a, b) => b.nacidoEnDia - a.nacidoEnDia)) {
    if (porCarencia <= 0) break;
    const q = Math.min(c.cantidad, porCarencia);
    c.cantidad -= q;
    porCarencia -= q;
    muertos += q;
  }
  for (const c of cohortes) {
    const p = probMuerteDeViejoPorDia(etapasDe(c.especie, d.categoria[c.especie] ?? null), edad(c, d.dia));
    if (p <= 0 || c.cantidad <= 0) continue;
    const q = Math.min(c.cantidad, Math.floor(c.cantidad * p + random()));
    c.cantidad -= q;
    muertos += q;
  }

  cohortes = cohortes.filter((c) => c.cantidad > 0);
  return { cohortes, ganaderos, fibreros, comido, diasSinComer, bebido, diasSinBeber, bebidaConsumida, comidaNeta, otros, crias, sacrificados, muertos };
}
