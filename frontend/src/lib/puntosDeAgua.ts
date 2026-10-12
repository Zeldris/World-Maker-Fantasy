// QA-27 P39: puntos de agua real donde se puede beber sin odre. Copia de `PUNTOS_DE_AGUA`
// (backend/src/services/crafting.ts), que es quien decide de verdad: aquí solo sirve para ofrecer
// la opción «Beber de la fuente» en el pop-up de Comer/Beber.
const PUNTOS_DE_AGUA: readonly string[] = ['manaderos', 'pozo-cauce-viejo', 'oasis-de-chudos-rojos']

export const ACCION_BEBER_DE_LA_FUENTE = 'Me agacho y bebo agua de la fuente hasta saciarme.'

export function esPuntoDeAgua(slug: string | null | undefined): boolean {
  return !!slug && PUNTOS_DE_AGUA.includes(slug)
}
