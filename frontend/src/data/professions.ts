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
  category?: 'recolección' | 'creacion'
}

// Catálogo curado a partir de docs/rpgtarkor/areas.md y personajes.md — centrado en lo que
// tendría sentido para un orco de las Llanuras del Viento Rojo (el continente/región de Gorhorn,
// el único personaje probado). `id` es también el `oficio` que referencian las recetas de
// crafting.ts/construction.ts (sesión de diseño 2026-07-23, ProfessionProgress en el backend):
// ejercerla sigue dando contexto narrativo, pero además el oficio ahora sube de nivel de verdad
// craftereando/construyendo con él (backend/src/services/professionProgress.ts).
export const professions: Profession[] = [
  {
    id: 'herrero-orco-llanuras',
    name: 'Herrería de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Herrería de Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'herrero-orco-cristal',
    name: 'Herrería de los Orcos de Cristal Helado',
    description:
      'Herrería de Orcos de Cristal Helado. Esta profesión se centra en los recursos que ofrece la zona de Cristal Helado.',
    category: 'creacion',
  },
  {
    id: 'herrero-orco-cienaga',
    name: 'Herrería de los Orcos de la Ciénaga Troncal',
    description:
      'Herrería de Orcos de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'herrero-nabierus-cienaga',
    name: 'Herrería de Nabierus de la Ciénaga Troncal',
    description:
      'Herrería de Nabierus de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'herrero-nabierus-margen',
    name: 'Herrería de Nabierus del Margen Silencioso',
    description:
      'Herrería de Nabierus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'herrero-faerus-margen',
    name: 'Herrería de faerus del Margen Silencioso',
    description:
      'Herrería de Faerus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'herrero-faerus-llanuras',
    name: 'Herrería de Faerus de las Llanuras del Viento Rojo',
    description:
      'Herrería de Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'herrero-goirntes-meseta',
    name: 'Herrería de Goirntes de la Meseta del Orden',
    description:
      'Herrería de Goirntes de la Meseta del Orden. Esta profesión se centra en los recursos que ofrece la zona de la Meseta del Orden.',
    category: 'creacion',
  },
  {
    id: 'domador-orcos-llanuras',
    name: 'Domador de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Domador de los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en la fauna que ofrece la zona de las Llanuras del Viento Rojo.',
  },
  {
    id: 'domador-orcos-cienaga',
    name: 'Domador de los Orcos de la Ciénaga Troncal',
    description:
      'Domador de los Orcos de la Ciénaga Troncal. Esta profesión se centra en la fauna que ofrece la zona de la Ciénaga Troncal.',
  },
  {
    id: 'domador-orcos-cristal',
    name: 'Domador de los Orcos de Cristal Helado',
    description:
      'Domador de los Orcos de Cristal Helado. Esta profesión se centra en la fauna que ofrece la zona de Cristal Helado.',
  },
  {
    id: 'domador-faerus-llanuras',
    name: 'Domador de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Domador de los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en la fauna que ofrece la zona de las Llanuras del Viento Rojo.',
  },
  {
    id: 'domador-faerus-margen',
    name: 'Domador de los Faerus del Margen Silencioso',
    description:
      'Domador de los Faerus del Margen Silencioso. Esta profesión se centra en la fauna que ofrece la zona del Margen Silencioso.',
  },
  {
    id: 'domador-nabierus-cienaga',
    name: 'Domador de los Nabierus de la Ciénaga Troncal',
    description:
      'Domador de los Nabierus de la Ciénaga Troncal. Esta profesión se centra en la fauna que ofrece la zona de la Ciénaga Troncal.',
  },
  // Recolectora (2026-08-09, aclaración explícita): recoge plantas/hierbas del área — mismo eje
  // que minero/desollador/talador, alimenta a la creadora 'alquimista' (pociones/ungüentos), no a
  // 'sanador' (ya no existe como profesión, ver comentario de ANTIDOTE_RECIPE en crafting.ts).
  {
    id: 'herborista-orcos-llanuras',
    name: 'Herborista de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Herborista de los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en las plantas que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'recolección',
  },
  {
    id: 'herborista-orcos-cienaga',
    name: 'Herborista de los Orcos de la Ciénaga Troncal',
    description:
      'Herborista de los Orcos de la Ciénaga Troncal. Esta profesión se centra en las plantas que ofrece la zona de la Ciénaga Troncal.',
    category: 'recolección',
  },
  {
    id: 'herborista-orcos-cristal',
    name: 'Herborista de los Orcos de Cristal Helado',
    description:
      'Herborista de los Orcos de Cristal Helado. Esta profesión se centra en las plantas que ofrece la zona de Cristal Helado.',
    category: 'recolección',
  },
  {
    id: 'herborista-faerus-llanuras',
    name: 'Herborista de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Herborista de los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en las plantas que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'recolección',
  },
  {
    id: 'herborista-faerus-margen',
    name: 'Herborista de los Faerus del Margen Silencioso',
    description:
      'Herborista de los Faerus del Margen Silencioso. Esta profesión se centra en las plantas que ofrece la zona del Margen Silencioso.',
    category: 'recolección',
  },
  {
    id: 'herborista-nabierus-cienaga',
    name: 'Herborista de los Nabierus de la Ciénaga Troncal',
    description:
      'Herborista de los Nabierus de la Ciénaga Troncal. Esta profesión se centra en las plantas que ofrece la zona de la Ciénaga Troncal.',
    category: 'recolección',
  },
  {
    id: 'herborista-nabierus-margen',
    name: 'Herborista de los Nabierus del Margen Silencioso',
    description:
      'Herborista de los Nabierus del Margen Silencioso. Esta profesión se centra en las plantas que ofrece la zona del Margen Silencioso.',
    category: 'recolección',
  },
  {
    id: 'herborista-goirntes-margen',
    name: 'Herborista de los Goirntes del Margen Silencioso',
    description:
      'Herborista de los Goirntes del Margen Silencioso. Esta profesión se centra en las plantas que ofrece la zona del Margen Silencioso.',
    category: 'recolección',
  },
  {
    id: 'herborista-goirntes-meseta',
    name: 'Herborista de los Goirntes de la Meseta del Orden',
    description:
      'Herborista de los Goirntes de la Meseta del Orden. Esta profesión se centra en las plantas que ofrece la zona de la Meseta del Orden.',
    category: 'recolección',
  },
  {
    id: 'sastre-orcos-llanuras',
    name: 'Sastre de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Crea ropa y accesorios de los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'sastre-orcos-cienaga',
    name: 'Sastre de los Orcos de la Ciénaga Troncal',
    description:
      'Crea ropa y accesorios de los Orcos de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'sastre-orcos-cristal',
    name: 'Sastre de los Orcos de Cristal Helado',
    description:
      'Crea ropa y accesorios de los Orcos de Cristal Helado. Esta profesión se centra en los recursos que ofrece la zona de Cristal Helado.',
    category: 'creacion',
  },
  {
    id: 'sastre-faerus-llanuras',
    name: 'Sastre de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Crea ropa y accesorios de los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'sastre-nabierus-cienaga',
    name: 'Sastre de los Nabierus de la Ciénaga Troncal',
    description:
      'Crea ropa y accesorios de los Nabierus de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'sastre-nabierus-margen',
    name: 'Sastre de los Nabierus del Margen Silencioso',
    description:
      'Crea ropa y accesorios de los Nabierus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'sastre-goirntes-margen',
    name: 'Sastre de los Goirntes del Margen Silencioso',
    description:
      'Crea ropa y accesorios de los Goirntes del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'sastre-goirntes-meseta',
    name: 'Sastre de los Goirntes de la Meseta del Orden',
    description:
      'Crea ropa y accesorios de los Goirntes de la Meseta del Orden. Esta profesión se centra en los recursos que ofrece la zona de la Meseta del Orden.',
    category: 'creacion',
  },
  // Creadora (2026-08-09, aclaración explícita): transforma lo que recoge 'herborista' en
  // pociones/ungüentos/material médico — es el equivalente real de la antigua 'sanador' (ya
  // retirada de este catálogo), no una profesión nueva sin relación.
  {
    // Orcos de las Llanuras del Viento Rojo (Gorhorn/Clan Maktor) no tenían variante propia de
    // alquimista pese a sí tenerla de herborista — añadida para que ANTIDOTE_RECIPE (crafting.ts,
    // el contraveneno de salvia y ceniza del Campamento del Clan Serhu) tenga un oficio real al
    // que enganchar, en vez de reusar el de otra región.
    id: 'alquimista-orcos-llanuras',
    name: 'Alquimista de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Crea pociones y elixires de los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los ingredientes que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'alquimista-orcos-cienaga',
    name: 'Alquimista de los Orcos de la Ciénaga Troncal',
    description:
      'Crea pociones y elixires de los Orcos de la Ciénaga Troncal. Esta profesión se centra en los ingredientes que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'alquimista-nabierus-cienaga',
    name: 'Alquimista de los Nabierus de la Ciénaga Troncal',
    description:
      'Crea pociones y elixires de los Nabierus de la Ciénaga Troncal. Esta profesión se centra en los ingredientes que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'alquimista-nabierus-margen',
    name: 'Alquimista de los Nabierus del Margen Silencioso',
    description:
      'Crea pociones y elixires de los Nabierus del Margen Silencioso. Esta profesión se centra en los ingredientes que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'alquimista-faerus-llanuras',
    name: 'Alquimista de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Crea pociones y elixires de los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en los ingredientes que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'alquimista-faerus-margen',
    name: 'Alquimista de los Faerus del Margen Silencioso',
    description:
      'Crea pociones y elixires de los Faerus del Margen Silencioso. Esta profesión se centra en los ingredientes que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'alquimista-goirntes-margen',
    name: 'Alquimista de los Goirntes del Margen Silencioso',
    description:
      'Crea pociones y elixires de los Goirntes del Margen Silencioso. Esta profesión se centra en los ingredientes que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'alquimista-goirntes-meseta',
    name: 'Alquimista de los Goirntes de la Meseta del Orden',
    description:
      'Crea pociones y elixires de los Goirntes de la Meseta del Orden. Esta profesión se centra en los ingredientes que ofrece la zona de la Meseta del Orden.',
    category: 'creacion',
  },
  {
    id: 'carpintero-orcos-llanuras',
    name: 'Carpintero de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Crea armas, herramientas o recursos de los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'carpintero-orcos-cristal',
    name: 'Carpintero de los Orcos de Cristal Helado',
    description:
      'Crea armas, herramientas o recursos de los Orcos de Cristal Helado. Esta profesión se centra en los recursos que ofrece la zona de Cristal Helado.',
    category: 'creacion',
  },
  {
    id: 'carpintero-orcos-cienaga',
    name: 'Carpintero de los Orcos de la Ciénaga Troncal',
    description:
      'Crea armas, herramientas o recursos de los Orcos de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'carpintero-faerus-llanuras',
    name: 'Carpintero de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Crea armas, herramientas o recursos de los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'carpintero-faerus-margen',
    name: 'Carpintero de los Faerus del Margen Silencioso',
    description:
      'Crea armas, herramientas o recursos de los Faerus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'carpintero-nabierus-cienaga',
    name: 'Carpintero de los Nabierus de la Ciénaga Troncal',
    description:
      'Crea armas, herramientas o recursos de los Nabierus de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'carpintero-nabierus-margen',
    name: 'Carpintero de los Nabierus del Margen Silencioso',
    description:
      'Crea armas, herramientas o recursos de los Nabierus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'carpintero-goirntes-margen',
    name: 'Carpintero de los Goirntes del Margen Silencioso',
    description:
      'Crea armas, herramientas o recursos de los Goirntes del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'carpintero-goirntes-meseta',
    name: 'Carpintero de los Goirntes de la Meseta del Orden',
    description:
      'Crea armas, herramientas o recursos de los Goirntes de la Meseta del Orden. Esta profesión se centra en los recursos que ofrece la zona de la Meseta del Orden.',
    category: 'creacion',
  },
  {
    id: 'curtidor-orcos-llanuras',
    name: 'Curtidor de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Cura y trabaja las pieles de la caza de los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'curtidor-orcos-cristal',
    name: 'Curtidor de los Orcos de Cristal Helado',
    description:
      'Cura y trabaja las pieles de la caza de los Orcos de Cristal Helado. Esta profesión se centra en los recursos que ofrece la zona de Cristal Helado.',
    category: 'creacion',
  },
  {
    id: 'curtidor-orcos-cienaga',
    name: 'Curtidor de los Orcos de la Ciénaga Troncal',
    description:
      'Cura y trabaja las pieles de la caza de los Orcos de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'curtidor-nabierus-cienaga',
    name: 'Curtidor de los Nabierus de la Ciénaga Troncal',
    description:
      'Cura y trabaja las pieles de la caza de los Nabierus de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'curtidor-nabierus-margen',
    name: 'Curtidor de los Nabierus del Margen Silencioso',
    description:
      'Cura y trabaja las pieles de la caza de los Nabierus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'curtidor-faerus-llanuras',
    name: 'Curtidor de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Cura y trabaja las pieles de la caza de los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'curtidor-faerus-margen',
    name: 'Curtidor de los Faerus del Margen Silencioso',
    description:
      'Cura y trabaja las pieles de la caza de los Faerus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'curtidor-goirntes-margen',
    name: 'Curtidor de los Goirntes del Margen Silencioso',
    description:
      'Cura y trabaja las pieles de la caza de los Goirntes del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'curtidor-goirntes-meseta',
    name: 'Curtidor de los Goirntes de la Meseta del Orden',
    description:
      'Cura y trabaja las pieles de la caza de los Goirntes de la Meseta del Orden. Esta profesión se centra en los recursos que ofrece la zona de la Meseta del Orden.',
    category: 'creacion',
  },
  {
    id: 'minero-llanuras',
    name: 'Minero de las Llanuras del Viento Rojo',
    description:
      'Extrae minerales y piedras de las Llanuras del Viento Rojo.',
    category: 'recolección',
  },
  {
    id: 'minero-cienaga',
    name: 'Minero de la Ciénaga Troncal',
    description:
      'Extrae minerales y piedras de la Ciénaga Troncal.',
    category: 'recolección',
  },
  {
    id: 'minero-cristal',
    name: 'Minero de Cristal Helado',
    description:
      'Extrae minerales y piedras de Cristal Helado.',
    category: 'recolección',
  },
  {
    id: 'minero-margen',
    name: 'Minero del Margen Silencioso',
    description:
      'Extrae minerales y piedras del Margen Silencioso.',
    category: 'recolección',
  },
  {
    id: 'minero-meseta',
    name: 'Minero de la Meseta del Orden',
    description:
      'Extrae minerales y piedras de la Meseta del Orden.',
    category: 'recolección',
  },
  // Escalado por raza+región (2026-08-09, petición explícita: "añade también desollador como
  // profesión a cada raza como las demás") — antes solo variaba por región (igual que minero/
  // talador), pero alimenta a 'peletero' (creadora) que SÍ varía por raza, así que ahora copia
  // exactamente los mismos 9 combos raza+región de peletero-*, uno a uno.
  {
    id: 'desollador-orcos-llanuras',
    name: 'Desollador de presas de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Desuella y prepara pieles de presas de los Orcos de las Llanuras del Viento Rojo.',
    category: 'recolección',
  },
  {
    id: 'desollador-orcos-cristal',
    name: 'Desollador de presas de los Orcos de Cristal Helado',
    description:
      'Desuella y prepara pieles de presas de los Orcos de Cristal Helado.',
    category: 'recolección',
  },
  {
    id: 'desollador-orcos-cienaga',
    name: 'Desollador de presas de los Orcos de la Ciénaga Troncal',
    description:
      'Desuella y prepara pieles de presas de los Orcos de la Ciénaga Troncal.',
    category: 'recolección',
  },
  {
    id: 'desollador-nabierus-cienaga',
    name: 'Desollador de presas de los Nabierus de la Ciénaga Troncal',
    description:
      'Desuella y prepara pieles de presas de los Nabierus de la Ciénaga Troncal.',
    category: 'recolección',
  },
  {
    id: 'desollador-nabierus-margen',
    name: 'Desollador de presas de los Nabierus del Margen Silencioso',
    description:
      'Desuella y prepara pieles de presas de los Nabierus del Margen Silencioso.',
    category: 'recolección',
  },
  {
    id: 'desollador-faerus-llanuras',
    name: 'Desollador de presas de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Desuella y prepara pieles de presas de los Faerus de las Llanuras del Viento Rojo.',
    category: 'recolección',
  },
  {
    id: 'desollador-faerus-margen',
    name: 'Desollador de presas de los Faerus del Margen Silencioso',
    description:
      'Desuella y prepara pieles de presas de los Faerus del Margen Silencioso.',
    category: 'recolección',
  },
  {
    id: 'desollador-goirntes-margen',
    name: 'Desollador de presas de los Goirntes del Margen Silencioso',
    description:
      'Desuella y prepara pieles de presas de los Goirntes del Margen Silencioso.',
    category: 'recolección',
  },
  {
    id: 'desollador-goirntes-meseta',
    name: 'Desollador de presas de los Goirntes de la Meseta del Orden',
    description:
      'Desuella y prepara pieles de presas de los Goirntes de la Meseta del Orden.',
    category: 'recolección',
  },
  {
    id: 'talador-llanuras',
    name: 'Talador de madera de las Llanuras del Viento Rojo',
    description:
      'Talador de madera de las Llanuras del Viento Rojo. Extrae madera de los árboles de las Llanuras del Viento Rojo.',
    category: 'recolección',
  },
  {
    id: 'talador-cristal',
    name: 'Talador de madera de Cristal Helado',
    description:
      'Talador de madera de Cristal Helado. Extrae madera de los árboles de Cristal Helado.',
    category: 'recolección',
  },
  {
    id: 'talador-cienaga',
    name: 'Talador de madera de la Ciénaga Troncal',
    description:
      'Talador de madera de la Ciénaga Troncal. Extrae madera de los árboles de la Ciénaga Troncal.',
    category: 'recolección',
  },
  {
    id: 'talador-margen',
    name: 'Talador de madera del Margen Silencioso',
    description:
      'Talador de madera del Margen Silencioso. Extrae madera de los árboles del Margen Silencioso.',
    category: 'recolección',
  },
  {
    id: 'talador-meseta',
    name: 'Talador de madera de la Meseta del Orden',
    description:
      'Talador de madera de la Meseta del Orden. Extrae madera de los árboles de la Meseta del Orden.',
    category: 'recolección',
  },
  {
    id: 'constructor-orcos-llanuras',
    name: 'Constructor de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Constructor de los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'constructor-orcos-cristal',
    name: 'Constructor de los Orcos de Cristal Helado',
    description:
      'Constructor de los Orcos de Cristal Helado. Esta profesión se centra en los recursos que ofrece la zona de Cristal Helado.',
    category: 'creacion',
  },
  {
    id: 'constructor-orcos-cienaga',
    name: 'Constructor de los Orcos de la Ciénaga Troncal',
    description:
      'Constructor de los Orcos de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'constructor-nabierus-cienaga',
    name: 'Constructor de los Nabierus de la Ciénaga Troncal',
    description:
      'Constructor de los Nabierus de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'constructor-nabierus-margen',
    name: 'Constructor de los Nabierus del Margen Silencioso',
    description:
      'Constructor de los Nabierus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'constructor-faerus-llanuras',
    name: 'Constructor de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Constructor de los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'constructor-faerus-margen',
    name: 'Constructor de los Faerus del Margen Silencioso',
    description:
      'Constructor de los Faerus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'constructor-goirntes-margen',
    name: 'Constructor de los Goirntes del Margen Silencioso',
    description:
      'Constructor de los Goirntes del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'constructor-goirntes-meseta',
    name: 'Constructor de los Goirntes de la Meseta del Orden',
    description:
      'Constructor de los Goirntes de la Meseta del Orden. Esta profesión se centra en los recursos que ofrece la zona de la Meseta del Orden.',
    category: 'creacion',
  },
  // Creadora nueva (2026-08-13, petición explícita: "una profesión que sea primeros-auxilios que
  // tenga pocas recetas de objetos básicos con los que te puedes curar... solo objetos tipo
  // mejoran el estado en el que estas") — distinta de 'alquimista' a propósito (esa se reserva
  // para objetos superiores más adelante, decisión explícita de la usuaria: "curandero esa
  // profesión la haremos más adelante"). Mismos 9 combos raza+región que peletero/curtidor/
  // desollador/carpintero/constructor. Cualquier personaje jugable la lleva de serie
  // (startingProfessions.ts la calcula por raza+región, no solo Gorhorn).
  {
    id: 'primeros-auxilios-orcos-llanuras',
    name: 'Primeros auxilios de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Prepara vendajes y cataplasmas básicas de primeros auxilios de los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'primeros-auxilios-orcos-cristal',
    name: 'Primeros auxilios de los Orcos de Cristal Helado',
    description:
      'Prepara vendajes y cataplasmas básicas de primeros auxilios de los Orcos de Cristal Helado. Esta profesión se centra en los recursos que ofrece la zona de Cristal Helado.',
    category: 'creacion',
  },
  {
    id: 'primeros-auxilios-orcos-cienaga',
    name: 'Primeros auxilios de los Orcos de la Ciénaga Troncal',
    description:
      'Prepara vendajes y cataplasmas básicas de primeros auxilios de los Orcos de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'primeros-auxilios-nabierus-cienaga',
    name: 'Primeros auxilios de los Nabierus de la Ciénaga Troncal',
    description:
      'Prepara vendajes y cataplasmas básicas de primeros auxilios de los Nabierus de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'primeros-auxilios-nabierus-margen',
    name: 'Primeros auxilios de los Nabierus del Margen Silencioso',
    description:
      'Prepara vendajes y cataplasmas básicas de primeros auxilios de los Nabierus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'primeros-auxilios-faerus-llanuras',
    name: 'Primeros auxilios de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Prepara vendajes y cataplasmas básicas de primeros auxilios de los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'primeros-auxilios-faerus-margen',
    name: 'Primeros auxilios de los Faerus del Margen Silencioso',
    description:
      'Prepara vendajes y cataplasmas básicas de primeros auxilios de los Faerus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'primeros-auxilios-goirntes-margen',
    name: 'Primeros auxilios de los Goirntes del Margen Silencioso',
    description:
      'Prepara vendajes y cataplasmas básicas de primeros auxilios de los Goirntes del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'primeros-auxilios-goirntes-meseta',
    name: 'Primeros auxilios de los Goirntes de la Meseta del Orden',
    description:
      'Prepara vendajes y cataplasmas básicas de primeros auxilios de los Goirntes de la Meseta del Orden. Esta profesión se centra en los recursos que ofrece la zona de la Meseta del Orden.',
    category: 'creacion',
  },
  {
    id: 'peletero-orcos-llanuras',
    name: 'Peletero de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Peletero que trabaja el cuero y las pieles de los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'peletero-orcos-cristal',
    name: 'Peletero de los Orcos de Cristal Helado',
    description:
      'Peletero que trabaja el cuero y las pieles de los Orcos de Cristal Helado. Esta profesión se centra en los recursos que ofrece la zona de Cristal Helado.',
    category: 'creacion',
  },
  {
    id: 'peletero-orcos-cienaga',
    name: 'Peletero de los Orcos de la Ciénaga Troncal',
    description:
      'Peletero que trabaja el cuero y las pieles de los Orcos de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'peletero-nabierus-cienaga',
    name: 'Peletero de los Nabierus de la Ciénaga Troncal',
    description:
      'Peletero que trabaja el cuero y las pieles de los Nabierus de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'peletero-nabierus-margen',
    name: 'Peletero de los Nabierus del Margen Silencioso',
    description:
      'Peletero que trabaja el cuero y las pieles de los Nabierus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'peletero-faerus-llanuras',
    name: 'Peletero de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Peletero que trabaja el cuero y las pieles de los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'peletero-faerus-margen',
    name: 'Peletero de los Faerus del Margen Silencioso',
    description:
      'Peletero que trabaja el cuero y las pieles de los Faerus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'peletero-goirntes-margen',
    name: 'Peletero de los Goirntes del Margen Silencioso',
    description:
      'Peletero que trabaja el cuero y las pieles de los Goirntes del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'peletero-goirntes-meseta',
    name: 'Peletero de los Goirntes de la Meseta del Orden',
    description:
      'Peletero que trabaja el cuero y las pieles de los Goirntes de la Meseta del Orden. Esta profesión se centra en los recursos que ofrece la zona de la Meseta del Orden.',
    category: 'creacion',
  },
  {
    id: 'cocinero-orco-llanuras',
    name: 'Cocinero de los Orcos de las Llanuras del Viento Rojo',
    description:
      'Cocinero que prepara comidas y bebidas para los Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'cocinero-orco-cristal',
    name: 'Cocinero de los Orcos de las Llanuras de Cristal Helado',
    description:
      'Cocinero que prepara comidas y bebidas para los Orcos de las Llanuras de Cristal Helado. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras de Cristal Helado.',
    category: 'creacion',
  },
  {
    id: 'cocinero-orco-cienaga',
    name: 'Cocinero de los Orcos de la Ciénaga Troncal',
    description:
      'Cocinero que prepara comidas y bebidas para los Orcos de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'cocinero-faerus-llanuras',
    name: 'Cocinero de los Faerus de las Llanuras del Viento Rojo',
    description:
      'Cocinero que prepara comidas y bebidas para los Faerus de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos que ofrece la zona de las Llanuras del Viento Rojo.',
    category: 'creacion',
  },
  {
    id: 'cocinero-faerus-margen',
    name: 'Cocinero de los Faerus del Margen Silencioso',
    description:
      'Cocinero que prepara comidas y bebidas para los Faerus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'cocinero-nabierus-cienaga',
    name: 'Cocinero de los Nabierus de la Ciénaga Troncal',
    description:
      'Cocinero que prepara comidas y bebidas para los Nabierus de la Ciénaga Troncal. Esta profesión se centra en los recursos que ofrece la zona de la Ciénaga Troncal.',
    category: 'creacion',
  },
  {
    id: 'cocinero-nabierus-margen',
    name: 'Cocinero de los Nabierus del Margen Silencioso',
    description:
      'Cocinero que prepara comidas y bebidas para los Nabierus del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'cocinero-goirntes-margen',
    name: 'Cocinero de los Goirntes del Margen Silencioso',
    description:
      'Cocinero que prepara comidas y bebidas para los Goirntes del Margen Silencioso. Esta profesión se centra en los recursos que ofrece la zona del Margen Silencioso.',
    category: 'creacion',
  },
  {
    id: 'cocinero-goirntes-meseta',
    name: 'Cocinero de los Goirntes de la Meseta del Orden',
    description:
      'Cocinero que prepara comidas y bebidas para los Goirntes de la Meseta del Orden. Esta profesión se centra en los recursos que ofrece la zona de la Meseta del Orden.',
    category: 'creacion',
  },
]
