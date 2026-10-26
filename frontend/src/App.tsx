import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { WorldSelect } from './pages/WorldSelect'
import { CharacterSelect } from './pages/CharacterSelect'
import { CharacterSaves } from './pages/CharacterSaves'
import { GameView } from './pages/GameView'
import { ComingSoon } from './pages/ComingSoon'
import { AdminEnciclopedia } from './pages/AdminEnciclopedia'
import { AdminLibro } from './pages/AdminLibro'
import { AdminUI } from './pages/AdminUI'
import { esEmpaquetado } from './lib/empaquetado'

function App() {
  const empaquetado = esEmpaquetado()
  return (
    <div className="wood-grain mx-auto flex h-svh w-full max-w-[1600px] flex-col overflow-y-auto border-x border-iron-800">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/solitario" element={<WorldSelect />} />
        <Route path="/solitario/mundo/:worldId" element={<CharacterSelect />} />
        <Route path="/solitario/mundo/:worldId/personaje/:characterId" element={<CharacterSaves />} />
        <Route path="/solitario/partida/:id" element={<GameView />} />
        <Route path="/multijugador" element={<ComingSoon />} />
        {/* Solo admin (petición explícita de Álvaro, 2026-09-21) — sin enlace en ningún flujo de
            jugador salvo el texto discreto de Home.tsx; no se lleva al instalador. */}
        {/* INS-33: en el juego empaquetado (`window.__TARKOR__`) estas rutas no se montan (no hay ruta comodín: la URL queda en blanco). */}
        {!empaquetado && (
          <>
            <Route path="/admin/enciclopedia" element={<AdminEnciclopedia />} />
            {/* Libro de Sucesos de una partida (CR-4, hito 0.2) — solo admin, mismo criterio. */}
            <Route path="/admin/partida/:id/libro" element={<AdminLibro />} />
            {/* Catálogo visual de componentes (BAS-9, hito 0.2) — solo admin, mismo criterio. */}
            <Route path="/admin/ui" element={<AdminUI />} />
          </>
        )}
      </Routes>
    </div>
  )
}

export default App
