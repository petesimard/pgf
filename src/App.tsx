import { Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import TVApp from './components/tv/TVApp';
import ClientApp from './components/client/ClientApp';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/tv" element={<TVApp />} />
      <Route path="/join/:sessionId" element={<ClientApp />} />
    </Routes>
  );
}

export default App;
