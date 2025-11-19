import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import GenerateImage from './pages/GenerateImage'
import AdminView from './pages/AdminView'
import Lobby from './pages/Lobby'
import JoinGame from './pages/JoinGame'
import GameHost from './pages/GameHost'
import PlayerGame from './pages/PlayerGame'
import CreateGame from './pages/CreateGame'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="/generate" element={<GenerateImage />} />
        <Route path="/create" element={<CreateGame />} />
        <Route path="/join" element={<JoinGame />} />
        <Route path="/lobby/:code" element={<Lobby />} />
        <Route path="/game/:code" element={<GameHost />} />
        <Route path="/play/:code" element={<PlayerGame />} />
      </Routes>
    </Router>
  )
}

export default App
