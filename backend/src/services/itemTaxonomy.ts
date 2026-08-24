import type { ItemTipo } from '@prisma/client';

/// Categorización mecánica de objetos (2026-07-29) — vocabulario de `ItemCatalog.category`
/// (subtipo fino) válido dentro de cada `ItemCatalog.tipo` (bucket mecánico amplio, ver schema).
/// `arma/herramienta/ropa/consumible/medicinal/documento/valor` son el vocabulario de siempre,
/// sin cambios de significado; `piel/hueso/madera/piedra/mena/hierba/metal/bloque` son nuevos,
/// para distinguir recurso crudo de material ya procesado (antes todo caía en un único
/// `category: 'material'` genérico).
export const CATEGORY_VOCAB_BY_TIPO: Record<ItemTipo, string[]> = {
  // Auditoría 2026-08-23 (Grupo 3, al descubrir que `seed-catalog` llevaba rota — 19 objetos de
  // varias sesiones de lore usaban categorías nunca dadas de alta aquí): 'planta'/'cera'/
  // 'alimento'/'pelo'/'filtro'/'medicinal'/'cuerno'/'garra' añadidas — vocabulario ya en uso real
  // y consistente en el catálogo, solo faltaba aquí. No son sinónimos de nada existente (a
  // diferencia de 'fibra'/'escama', normalizadas a sus plurales ya válidos en los propios objetos).
  RECURSO: [
    'piel', 'hueso', 'madera', 'piedra', 'mena', 'hierba', 'pluma', 'quitina', 'resina', 'fibras', 'tendon', 'escamas', 'semilla',
    'planta', 'cera', 'alimento', 'pelo', 'filtro', 'medicinal', 'cuerno', 'garra',
  ],
  // 'quitina' (2026-08-23): forma YA PROCESADA ("pieza de quitina roja... trabajados hasta formar
  // una pieza completa lista para crafteo") — mismo criterio que 'metal'/'bloque', su versión
  // cruda vive en RECURSO.
  MATERIAL: ['metal', 'bloque', 'quitina'],
  EQUIPABLE: ['arma', 'herramienta', 'ropa','accesorio','armadura'],
  CONSUMIBLE: ['consumible', 'medicinal'],
  // 'cosmetico' añadido 2026-08-03 (petición explícita: "crear... una categoría que es
  // cosméticos") — mismo bucket NARRATIVO que 'valor' (equipable por sabor, sin bonus por
  // defecto), no EQUIPABLE: los cosméticos especiales que sí den bonus (mochila con más espacio,
  // etc.) siguen sin bonus "de arma", son casos concretos con su propio efecto — no cambia el
  // criterio de qué tipo mecánico les corresponde.
  NARRATIVO: ['documento', 'valor', 'cosmetico'],
  // ESPECIAL (2026-08-03, "items de tipo Especial... efecto más complejo o útil para la
  // narración") — un único subtipo por ahora, todos comparten el mismo mecanismo (`effectKey`).
  ESPECIAL: ['especial'],
};

/// Falla rápido en seed-catalog.ts ante un typo de categoría o una combinación tipo/categoría que
/// no tiene sentido (p.ej. tipo=RECURSO con category='arma') — mejor un error de arranque del
/// script que una fila silenciosamente inconsistente en producción.
export function assertValidCategory(tipo: ItemTipo, category: string, context: string): void {
  const validCategories = CATEGORY_VOCAB_BY_TIPO[tipo];
  if (!validCategories.includes(category)) {
    throw new Error(
      `[itemTaxonomy] "${context}": category "${category}" no es válida para tipo "${tipo}" — válidas: ${validCategories.join(', ')}`,
    );
  }
}
