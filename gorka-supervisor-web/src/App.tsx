import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/upload" element={<div className="p-8 text-[#18181b]">📁 Data Upload Page</div>} />
          <Route path="/logs" element={<div className="p-8 text-[#18181b]">📋 Audit Logs Page</div>} />
          <Route path="/permissions" element={<div className="p-8 text-[#18181b]">🔒 Permissions Page</div>} />
          <Route path="/analytics" element={<div className="p-8 text-[#18181b]">📈 Analytics Page</div>} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;