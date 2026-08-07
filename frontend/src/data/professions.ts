export interface Profession {
  id: string
  name: string
  description: string
  /// Rediseño de profesiones (2026-08-07, petición explícita): distingue recolectoras/
  /// transformadoras (extraen materia prima del mundo — minería, tala, desuello) de creadoras
  /// (combinan materiales en un objeto — herrería, carpintería, peletería/curtidor, construcción).
  /// Cada recolectora alimenta a una creadora concreta: minería→herrería, tala→carpintería,
  /// desuello→peletería (curtidor). Opcional: las profesiones sin encaje en este modelo
  /// (cazador/domador/sanador/rastreador/mercader) se quedan sin categoría — puramente
  /// narrativas, sin barra ni recetas especiales en Habilidades > Profesiones.
  category?: 'recoleccion' | 'creacion'
}

// Catálogo curado a partir de docs/rpgtarkor/areas.md y personajes.md — centrado en lo que
// tendría sentido para un orco de las Llanuras del Viento Rojo (el continente/región de Gorhorn,
// el único personaje probado). `id` es también el `oficio` que referencian las recetas de
// crafting.ts/construction.ts (sesión de diseño 2026-07-23, ProfessionProgress en el backend):
// ejercerla sigue dando contexto narrativo, pero además el oficio ahora sube de nivel de verdad
// craftereando/construyendo con él (backend/src/services/professionProgress.ts).
export const professions: Profession[] = [
  {
    id: 'cazador',
    name: 'Cazador de Corredores de Cauce',
    description:
      'Caza en las carreras rituales que los clanes usan como prueba de valor, siguiendo las manadas de Corredores de Cauce a lo largo de las corrientes subterráneas de las Llanuras.',
  },
  {
    id: 'herrero',
    name: 'Herrero de campamento',
    description:
      'Trabaja metal y hueso volcánico para armar y reparar armas orcas — sin las fraguas fijas de una ciudad-fortaleza Goirntes, todo su taller cabe en un carro.',
    category: 'creacion',
  },
  {
    id: 'domador',
    name: 'Guía de Gargantúas de Ceniza',
    description:
      'Aprende de las Terk\'ikar el don de comunión con las Gargantúas de Ceniza, los reptiles que transportan comunidades enteras en las migraciones estacionales.',
  },
  {
    id: 'sanador',
    name: 'Sanador de hierbas de las Llanuras',
    description:
      'Conoce la Salvia del Polvo y otras hierbas que crecen en terreno árido — no magia, remedios de verdad para cortar hemorragias y limpiar heridas, aprendidos por necesidad.',
  },
  {
    id: 'rastreador',
    name: 'Rastreador de tormentas',
    description:
      'Lee el cielo y el polvo para anticipar las tormentas de arena magnética — una habilidad que decide si un campamento sobrevive la noche.',
  },
  {
    id: 'mercader',
    name: 'Mercader de paso',
    description:
      'Comercia en El Cruce de las Cenizas y otros puntos de paso, moviéndose entre el territorio orco y las patrullas de la Concordia de Hierro sin pertenecer del todo a ninguno.',
  },
  {
    id: 'carpintero',
    name: 'Carpintero de campamento',
    description:
      'Trabaja madera de matorral de cuerno y de los Trepadores Ocaso de la Ciénaga — chozas, atalayas y armazones, todo lo que un clan sin ciudad fija necesita construir con lo que hay a mano.',
    category: 'creacion',
  },
  {
    id: 'curtidor',
    name: 'Curtidor de pieles',
    description:
      'Cura y trabaja las pieles de la caza — de Corredor de Cauce a gargantúa — para ropa, arneses y correas. Oficio silencioso, imprescindible en cualquier campamento orco.',
    category: 'creacion',
  },
  {
    id: 'minero',
    name: 'Minero de las Llanuras',
    description:
      'Excava vetas de mena de hierro y otros minerales expuestos en el basalto de las Llanuras del Viento Rojo — trabajo duro y solitario, la materia prima que después el herrero funde y forja.',
    category: 'recoleccion',
  },
  {
    id: 'desollador',
    name: 'Desollador de presas',
    description:
      'Despelleja y despieza la caza con precisión — de un Corredor de Cauce a una gargantúa caída, cada piel, hueso y tendón se aprovecha entero si el corte es limpio.',
    category: 'recoleccion',
  },
  {
    id: 'talador',
    name: 'Talador de matorral de cuerno',
    description:
      'Tala y acarrea madera de matorral de cuerno y de los Trepadores Ocaso — trabajo previo y necesario para que el carpintero tenga con qué construir.',
    category: 'recoleccion',
  },
  {
    id: 'constructor',
    name: 'Constructor de campamento',
    description:
      'Levanta y mantiene lo que un clan sin ciudad fija necesita en pie — atalayas, empalizadas, el propio Ayuntamiento — dirigiendo el trabajo que el carpintero y el talador dejan listo.',
    category: 'creacion',
  },
]
