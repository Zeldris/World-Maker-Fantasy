// UX-41 — pictograma de la marca: la imagen si existe, si no el emoji de reserva. Decorativo siempre
// (`aria-hidden`, `alt=""`): el texto que lo acompaña es el que se lee.

export function Pictograma({ src, emoji, className = 'h-5 w-5' }: { src?: string; emoji?: string; className?: string }) {
  if (!src) return emoji ? <span aria-hidden="true">{emoji}</span> : null
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-pictograma
      className={`inline-block shrink-0 select-none object-contain align-middle ${className}`}
    />
  )
}
