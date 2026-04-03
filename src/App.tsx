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
import Dashboard from './pages/Dashboard'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import DailyChallenge from './pages/DailyChallenge'
import DailyChallengeArchive from './pages/DailyChallengeArchive'

function ProtectedRoute({ element }: { element: React.ReactElement }) {
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return null
  if (!isSignedIn) return <RedirectToSignIn redirectUrl="/sign-in" />
  return element
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} />} />
        <Route path="/admin" element={<ProtectedRoute element={<AdminView />} />} />
        <Route path="/generate" element={<ProtectedRoute element={<GenerateImage />} />} />
        <Route path="/create" element={<CreateGame />} />
        <Route path="/join" element={<JoinGame />} />
        <Route path="/lobby/:code" element={<Lobby />} />
        <Route path="/game/:code" element={<GameHost />} />
        <Route path="/play/:code" element={<PlayerGame />} />
        <Route path="/daily/archive" element={<DailyChallengeArchive />} />
        <Route path="/daily/:date" element={<DailyChallenge />} />
        <Route path="/daily" element={<DailyChallenge />} />
      </Routes>
    </Router>
  )
}

export default App
