/// Slug estable a partir de un nombre libre (usado para claves de ImagePrompt de habilidades,
/// que no tienen slug propio en código — ver classAbilities.ts/startingAbilities.ts). Compartido
/// entre seedImagePrompts.ts y world.ts para que ambos generen exactamente la misma clave.
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
