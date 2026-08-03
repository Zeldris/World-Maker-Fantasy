import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/// Red de seguridad de React (auditoría 2026-08-03, "análisis completo backend/frontend"): sin
/// esto, cualquier fallo al renderizar (un campo inesperado null, un bug real) dejaba la app
/// entera en pantalla en blanco, sin ningún aviso ni forma de recuperarse salvo recargar a ciegas
/// — en una partida narrativa larga eso es perder el hilo sin ninguna explicación. Solo cubre
/// errores de RENDER (los de red/async de cada página ya se manejan aparte, con sus propios
/// try/catch) — es la contraparte, del lado del cliente, de `app.setErrorHandler` en server.ts.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] fallo de render no capturado:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="wood-grain flex h-svh w-full flex-col items-center justify-center gap-4 border-x border-iron-800 px-6 text-center">
          <p className="text-lg font-semibold text-wood-100">Algo se rompió al mostrar la partida.</p>
          <p className="max-w-md text-sm text-wood-400">
            No se ha perdido tu progreso guardado — recarga para volver a intentarlo. Si vuelve a pasar, avisa con lo que estabas haciendo.
          </p>
          <Button onClick={() => window.location.reload()}>Recargar</Button>
        </div>
      )
    }
    return this.props.children
  }
}
