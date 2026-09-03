/// Géneros de flora (2026-09-04, diseño cerrado con la usuaria) — sistema PARALELO a
/// `FaunaCategoria` (faunaAbilities.ts) pero sin habilidades de combate propias (la flora no
/// combate ni tiene nivel/progresión) — agrupa qué tipo de recursos suele dar cada género, para
/// poder reutilizar el mismo género con una variedad regional nueva si en el futuro se amplía a
/// otra región (ej. Cristal Helado), sin inventar una especie sin relación cada vez. Mismo
/// criterio que Telda (Común/Ceniza/Atardecer) o Pasto (Solar/de Sangre) ya aplicaban de forma
/// intuitiva antes de que existiera este campo.
///
/// Usos reales confirmados (2026-09-04, la usuaria descartó explícitamente un 4º uso — bonus de
/// recolección por profesión afín al género, no se implementa):
/// 1. **Filtro de terreno derivado** — al asignar `harvestSourceTerrainTag` (worldCatalog.ts) a un
///    elemento nuevo, el género sugiere un terreno por defecto coherente con el resto de su
///    familia (VELDRIAS→vegetacion/humedo, MARELAS→costero/humedo, VETRIAS→rocoso...) — no
///    sustituye la asignación manual, pero un elemento cuyo tag no encaje con el patrón típico de
///    su género es candidato a revisar antes de darlo por bueno.
/// 2. **Filtro de Enciclopedia** — mismo patrón que ya usa `faunaCategoria` en el frontend para
///    agrupar fauna por tipo en su ficha — exponer este campo permite la misma navegación por
///    género en la flora ("ver todas las VELDRIAS del mundo").
/// 3. **Pista narrativa para el Narrador** — mismo espíritu que otros campos de `bio`/`role` que ya
///    alimentan el contexto del LLM: el género puede dar al Narrador una pista de "sabor" o tono
///    compartido al describir un recurso nuevo de un género ya visto antes, aunque cambie la
///    especie concreta.
///
/// Las 13 categorías agrupan por Semilla creadora (docs/rpgtarkor/genesis.md), igual que
/// `FaunaCategoria`:
/// - Florial ("El que Brota", raíz/savia/estación, creadora de flora junto a Ferios): VELDRIAS
///   (árboles con madera+resina emparejada), ZARCOS (arbustos de leña sin resina), HELDRAS
///   (hierbas/pastos base), GRANOLES (cereales silvestres), TRENIAS (fibra para tejido/cordaje),
///   MARELAS (algas de costa/charca), BULVIAS (raíces/tubérculos de agua), MUSCARIAS (líquenes/
///   musgos, cobertura de superficie sin tallo propio), SALVIRAS (flores/plantas de alquimia y
///   curación de campo), FONGARES (setas), VETRIAS (flora con mineral real incrustado en su
///   propia estructura, no solo en el suelo donde crece).
/// - Tarkor (magia Salvaje derramada tras el Estallido): BROTES_SALVAJES (flora normal mutada por
///   la magia — especie base real reconocible con algo imposible ya en su bio, ej. Raíz de Fuego
///   acumulando calor volcánico hasta el punto de inflamarse, o Cardo Brújula con fibra imantada
///   que siempre señala el mismo rumbo) y ROKTARS_FLORARES (flora nacida DIRECTAMENTE de la magia
///   Salvaje, sin especie base real — mismo concepto que ROKRATS_ESTALLIDO en fauna, nombre
///   deliberadamente emparentado: "Roktars" es el mismo juego de palabras con "Tarkor" al revés,
///   "Florares" marca que es la rama de flora — sin fauna real asignada todavía, tipo reservado
///   para contenido futuro).
export type FloraCategoria =
  | 'VELDRIAS'
  | 'ZARCOS'
  | 'HELDRAS'
  | 'GRANOLES'
  | 'TRENIAS'
  | 'MARELAS'
  | 'BULVIAS'
  | 'MUSCARIAS'
  | 'SALVIRAS'
  | 'FONGARES'
  | 'VETRIAS'
  | 'BROTES_SALVAJES'
  | 'ROKTARS_FLORARES';
