import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { formatearVersion } from './src/lib/version.ts'

// Versionado (2026-09-29, docs/producto/21-roadmap.md § Versionado): mismo cálculo que el backend
// (`git describe`); sin git, sin etiquetas o ante cualquier error cae a `<package.json>-dev`.
function calcularVersion(): string {
  try {
    const salida = execFileSync('git', ['describe', '--tags', '--long', '--match', 'v*'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    })
    const version = formatearVersion(salida)
    if (version) return version
  } catch {
    // sin git / sin etiquetas: respaldo de abajo
  }
  try {
    const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string }
    return `${pkg.version ?? '0.0.0'}-dev`
  } catch {
    return '0.0.0-dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(calcularVersion()),
  },
})
