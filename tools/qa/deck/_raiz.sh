# Solo se carga con `source` (no se ejecuta): `. "$(dirname "$0")/_raiz.sh"` deja RAIZ (raíz del repo) y DECK (esta carpeta) y entra en la raíz.
DECK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$DECK/../../.." && pwd)"
cd "$RAIZ"
