import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CreateGame from './pages/CreateGame';
import Lobby from './pages/Lobby';
import JoinGame from './pages/JoinGame';
import GameHost from './pages/GameHost';
import PlayerGame from './pages/PlayerGame';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<CreateGame />} />
        <Route path="/join" element={<JoinGame />} />
        <Route path="/lobby/:code" element={<Lobby />} />
        <Route path="/game/:code" element={<GameHost />} />
        <Route path="/play/:code" element={<PlayerGame />} />
      </Routes>
    </Router>
  );
}

export default App;
