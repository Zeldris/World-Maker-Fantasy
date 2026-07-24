import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

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
}

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`tactile inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
