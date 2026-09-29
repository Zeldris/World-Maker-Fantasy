interface OfferCardAction {
  label: string
  onClick: () => void
  tone: 'primary' | 'danger' | 'accent' | 'neutral'
  disabled?: boolean
}

interface OfferCardProps {
  tone: 'quest' | 'accent2' | 'danger'
  icon: string
  title: string
  /// Segunda línea opcional (contexto/descripción antes de decidir) — `questOffer` la usaba con
  /// `description`, `dynamicModeOffer` con la frase de "puedes hablar con..." (B.10).
  subtitle?: string
  /// Aviso de riesgo (F9-1, decisión de Álvaro, 2026-09-29) — línea de color entre el subtítulo y las
  /// acciones: ámbar para 'alto', rojo para 'mortal'. Solo informa, nunca bloquea las acciones.
  warning?: { nivel: 'alto' | 'mortal'; text: string }
  /// Error visible tras un intento fallido (A.7) — nunca sustituye las acciones, se muestra debajo.
  error?: string
  actions: OfferCardAction[]
  /// "Ya resuelto" (convalecienteOffers) — sustituye las acciones por un texto plano.
  resolvedText?: string
}

const CARD_TONE: Record<OfferCardProps['tone'], string> = {
  quest: 'border-quest-600/50 bg-quest-500/10',
  accent2: 'border-accent2-600/50 bg-accent2-500/10',
  danger: 'border-danger-600/50 bg-danger-500/10',
}

const TITLE_TONE: Record<OfferCardProps['tone'], string> = {
  quest: 'text-quest-400',
  accent2: 'text-accent2-400',
  danger: 'text-danger-400',
}

const ACTION_TONE: Record<OfferCardAction['tone'], string> = {
  primary: 'border-quest-500/60 bg-quest-500/20 text-quest-300 hover:border-quest-400 hover:bg-quest-500/35',
  accent: 'border-accent-500/60 bg-accent-500/20 text-accent-300 hover:border-accent-400 hover:bg-accent-500/35',
  danger: 'border-danger-500/60 bg-danger-500/20 text-danger-300 hover:border-danger-400 hover:bg-danger-500/35',
  neutral: 'border-iron-700 bg-wood-950/40 text-wood-400 hover:border-iron-500 hover:text-wood-200',
}

/// Tarjeta de oferta genérica en el log (B.1, checklist frontend 2026-08-27) — `questOffer`,
/// `dynamicModeOffer` y `convalecienteOffers` (LogPanel.tsx) repetían el mismo esqueleto (contenedor
/// con borde/fondo por color semántico, título con emoji, fila de 2-3 botones) casi byte a byte,
/// tres veces. Un cuarto tipo de oferta no necesitaría reinventar el markup, solo pasar `tone`/
/// `actions` nuevos.
export function OfferCard({ tone, icon, title, subtitle, warning, error, actions, resolvedText }: OfferCardProps) {
  return (
    <div className={`mt-2 rounded-lg border px-2.5 py-2 ${CARD_TONE[tone]}`}>
      <p className={`flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] ${TITLE_TONE[tone]}`}>
        <span aria-hidden="true">{icon}</span>
        <span>{title}</span>
      </p>
      {subtitle && <p className="mt-1 text-2xs text-wood-300">{subtitle}</p>}
      {warning && (
        <p role="alert" data-riesgo={warning.nivel} className={`mt-1 text-2xs font-semibold ${warning.nivel === 'mortal' ? 'text-red-400' : 'text-amber-400'}`}>
          <span aria-hidden="true">⚠️ </span>
          {warning.text}
        </p>
      )}
      {error && <p className="mt-1 text-2xs text-red-400">{error}</p>}
      {resolvedText ? (
        <p className="mt-1 text-2xs text-wood-400">{resolvedText}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className={`tactile rounded-lg border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_TONE[action.tone]}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
