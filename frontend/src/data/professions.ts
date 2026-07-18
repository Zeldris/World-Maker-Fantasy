export interface Profession {
  id: string
  name: string
  description: string
}

// Catálogo curado a partir de docs/rpgtarkor/areas.md y personajes.md — centrado en lo que
// tendría sentido para un orco de las Llanuras del Viento Rojo (el continente/región de Gorhorn,
// el único personaje probado). Contenido narrativo, sin bonificadores mecánicos (misma
// filosofía que el inventario, docs/06-decisiones-mecanicas.md decisión 5) — ejercer una
// profesión da contexto al Narrador, no un número fijo a una tirada.
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
    description: 'Conoce las hierbas y ungüentos que se dan en terreno árido — no magia, remedios de verdad aprendidos por necesidad.',
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
]
