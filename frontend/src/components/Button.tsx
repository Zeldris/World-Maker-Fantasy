import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent2' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-accent-400 to-accent-600 text-wood-950 border border-accent-600 font-semibold hover:from-accent-300 hover:to-accent-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_12px_-4px_var(--color-accent-500)] disabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]',
  secondary:
    'bg-wood-800 text-wood-100 border border-iron-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-accent-600/60 hover:bg-accent-500/10 hover:text-accent-300',
  ghost: 'text-wood-300 hover:text-wood-100 hover:bg-wood-800/60',
  // checklist consolidado P2.1 (2026-08-27) — mismo patrón visual que `primary` (gradiente
  // pesado, acción destacada) pero en el canal "El mundo" (accent2/azulado en vez de dorado),
  // ya usado sin componente compartido en DynamicModeModal.tsx/KingdomFoundingModal.tsx.
  accent2:
    'bg-gradient-to-b from-accent2-400 to-accent2-600 text-wood-950 border border-accent2-600 font-semibold hover:from-accent2-300 hover:to-accent2-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_12px_-4px_var(--color-accent2-500)] disabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]',
  // Mismo criterio que `secondary` (fondo plano) pero en rojo, para acciones irreversibles/
  // destructivas — mismo tono ya usado suelto en HealthBar.tsx/HealSelectionModal.tsx.
  danger:
    'bg-wood-800 text-danger-300 border border-danger-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-danger-500 hover:bg-danger-500/10 hover:text-danger-200',
}

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button type="button"
      className={`tactile inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
