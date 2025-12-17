import { Routes, Route, Navigate } from 'react-router-dom';
import TVApp from './components/tv/TVApp';
import ClientApp from './components/client/ClientApp';

function App() {
  return (
    <Routes>
      <Route path="/tv" element={<TVApp />} />
      <Route path="/join/:sessionId" element={<ClientApp />} />
      <Route path="/" element={<Navigate to="/tv" replace />} />
    </Routes>
  );
}

export default App;
