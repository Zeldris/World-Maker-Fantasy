import { afterEach } from 'vitest'

// QA-94 (retro del 2026-10-17): un aviso de React por la consola hace fallar el test que lo provoca. P197 (dos
// «Salir» en un menú) dejaba «Encountered two children with the same key» en cada render y la suite seguía en
// verde. Lo que React avisa así es un fallo de la interfaz (claves repetidas, props desconocidas, `act`).
const AVISO_DE_REACT = /Encountered two children with the same key|Each child in a list should have a unique "key"|React does not recognize the|Unknown event handler property|not wrapped in act\(|Received `(true|false)` for a non-boolean attribute|Invalid DOM property/

const avisos: string[] = []
const original = console.error
console.error = (...args: unknown[]) => {
  const texto = args.map(String).join(' ')
  if (AVISO_DE_REACT.test(texto)) avisos.push(texto.slice(0, 300))
  original(...args)
}

afterEach(() => {
  if (avisos.length === 0) return
  const lista = avisos.splice(0)
  throw new Error(`React avisó por la consola (QA-94):\n${lista.join('\n')}`)
})
