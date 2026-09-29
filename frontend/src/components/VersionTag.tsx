import { useEffect, useState } from 'react'
import { getServerVersion } from '../lib/api'

/// Versionado (2026-09-29): versión del build del frontend, discreta. Si el backend devuelve otra
/// distinta, muestra también la suya para que un desajuste (frontend/servidor de commits
/// distintos) sea visible. Si el backend no responde, solo se ve la del frontend.
export function VersionTag() {
  const [servidor, setServidor] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getServerVersion()
      .then((v) => {
        if (!cancelled) setServidor(v)
      })
      .catch(() => {
        if (!cancelled) setServidor(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <p className="text-2xs text-wood-600" data-testid="version-tag">
      v{__APP_VERSION__}
      {servidor && servidor !== __APP_VERSION__ && <> · servidor v{servidor}</>}
    </p>
  )
}
