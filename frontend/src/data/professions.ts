export interface Profession {
  id: string
  name: string
  description: string
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
  },
  {
    id: 'curtidor',
    name: 'Curtidor de pieles',
    description:
      'Cura y trabaja las pieles de la caza — de Corredor de Cauce a gargantúa — para ropa, arneses y correas. Oficio silencioso, imprescindible en cualquier campamento orco.',
  },
]
