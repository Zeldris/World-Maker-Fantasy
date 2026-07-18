import type { WorldTheme } from '../types'

const VAR_MAP: Record<keyof WorldTheme, string> = {
  accent300: '--color-accent-300',
  accent400: '--color-accent-400',
  accent500: '--color-accent-500',
  accent600: '--color-accent-600',
  accent2300: '--color-accent2-300',
  accent2400: '--color-accent2-400',
  accent2500: '--color-accent2-500',
  accent2600: '--color-accent2-600',
}

export function applyWorldTheme(theme: WorldTheme | null) {
  const root = document.documentElement.style
  if (!theme) {
    Object.values(VAR_MAP).forEach((cssVar) => root.removeProperty(cssVar))
    return
  }
  ;(Object.keys(theme) as Array<keyof WorldTheme>).forEach((key) => {
    root.setProperty(VAR_MAP[key], theme[key])
  })
}
