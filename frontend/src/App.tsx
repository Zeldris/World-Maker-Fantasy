import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { WorldSelect } from './pages/WorldSelect'
import { CharacterSelect } from './pages/CharacterSelect'
import { CharacterSaves } from './pages/CharacterSaves'
import { GameView } from './pages/GameView'
import { ComingSoon } from './pages/ComingSoon'

function App() {
  return (
    <div className="wood-grain mx-auto flex h-svh w-full max-w-[1600px] flex-col overflow-y-auto border-x border-iron-800">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/solitario" element={<WorldSelect />} />
        <Route path="/solitario/mundo/:worldId" element={<CharacterSelect />} />
        <Route path="/solitario/mundo/:worldId/personaje/:characterId" element={<CharacterSaves />} />
        <Route path="/solitario/partida/:id" element={<GameView />} />
        <Route path="/multijugador" element={<ComingSoon />} />
      </Routes>
    </div>
  )
}

export default App
