import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useAuth, RedirectToSignIn } from '@clerk/react'
import LandingPage from './pages/LandingPage'
import GenerateImage from './pages/GenerateImage'
import AdminView from './pages/AdminView'
import Lobby from './pages/Lobby'
import JoinGame from './pages/JoinGame'
import GameHost from './pages/GameHost'
import PlayerGame from './pages/PlayerGame'
import CreateGame from './pages/CreateGame'

function ProtectedRoute({ element }: { element: React.ReactElement }) {
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return null
  if (!isSignedIn) return <RedirectToSignIn />
  return element
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<ProtectedRoute element={<AdminView />} />} />
        <Route path="/generate" element={<ProtectedRoute element={<GenerateImage />} />} />
        <Route path="/create" element={<ProtectedRoute element={<CreateGame />} />} />
        <Route path="/join" element={<JoinGame />} />
        <Route path="/lobby/:code" element={<Lobby />} />
        <Route path="/game/:code" element={<GameHost />} />
        <Route path="/play/:code" element={<PlayerGame />} />
      </Routes>
    </Router>
  )
}

export default App
