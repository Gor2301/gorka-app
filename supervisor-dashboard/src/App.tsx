import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Collections from './pages/Collections';
import DebtorDetail from './pages/DebtorDetail';
import Upload from './pages/Upload';
import Audit from './pages/Audit';
import Permissions from './pages/Permissions';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import Login from './pages/Login';
import UnlockScreen from './components/UnlockScreen';
import ComplianceReport from './pages/ComplianceReport';
import DataFlowAudit from './pages/DataFlowAudit';
import Calendar from './pages/Calendar';
import Connectors from './pages/Connectors';
import { GORKAStatus } from './pages/GORKAStatus';
import Support from './pages/Support';
import MyRequests from './pages/MyRequests';
import MyRequestDetail from './pages/MyRequestDetail';
import { auth } from './services/local.db';

console.log('🔍 auth in App.tsx:', auth);
console.log('🔍 auth.getToken:', auth?.getToken);
console.log('🔍 auth keys:', Object.keys(auth));

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

 const checkAuth = async () => {
  console.log('🔍 [APP] checkAuth called');
  try {
    const token = await auth.getToken();
    console.log('🔍 [APP] checkAuth token:', token ? 'present' : 'null');
    setIsAuthenticated(!!token);
    if (token) {
      console.log('🔍 [APP] checking isUnlocked');
      const unlocked = await auth.isUnlocked();
      console.log('🔍 [APP] isUnlocked:', unlocked);
      setIsUnlocked(unlocked);
    }
  } catch (err) {
    console.error('❌ [APP] Auth check error:', err);
    setIsAuthenticated(false);
  } finally {
    setLoading(false);
  }
};

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = async () => {

console.log('🔍 [APP] handleLoginSuccess called');
    // Re-check auth after login
    await checkAuth();
  };

  const handleUnlockSuccess = () => {
    setIsUnlocked(true);
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
      setIsAuthenticated(false);
      setIsUnlocked(false);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };


  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <BrowserRouter>
      {!isAuthenticated ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : !isUnlocked ? (
        <UnlockScreen onUnlocked={handleUnlockSuccess} />
      ) : (
        <Routes>
          <Route path="/" element={<AppShell onLogout={handleLogout}><Dashboard /></AppShell>} />
          <Route path="/dashboard" element={<AppShell onLogout={handleLogout}><Dashboard /></AppShell>} />
          <Route path="/agents" element={<AppShell onLogout={handleLogout}><Agents /></AppShell>} />
          <Route path="/collections" element={<AppShell onLogout={handleLogout}><Collections /></AppShell>} />
          <Route path="/collections/:id" element={<AppShell onLogout={handleLogout}><DebtorDetail /></AppShell>} />
          <Route path="/upload" element={<AppShell onLogout={handleLogout}><Upload /></AppShell>} />
          <Route path="/audit" element={<AppShell onLogout={handleLogout}><Audit /></AppShell>} />
          <Route path="/permissions" element={<AppShell onLogout={handleLogout}><Permissions /></AppShell>} />
          <Route path="/analytics" element={<AppShell onLogout={handleLogout}><Analytics /></AppShell>} />
          <Route path="/billing" element={<AppShell onLogout={handleLogout}><Billing /></AppShell>} />
          <Route path="/settings" element={<AppShell onLogout={handleLogout}><Settings /></AppShell>} />
          <Route path="/compliance" element={<AppShell onLogout={handleLogout}><ComplianceReport /></AppShell>} />
          <Route path="/data-flow-audit" element={<AppShell onLogout={handleLogout}><DataFlowAudit /></AppShell>} />
          <Route path="/calendar" element={<AppShell onLogout={handleLogout}><Calendar /></AppShell>} />
          <Route path="/connectors" element={<AppShell onLogout={handleLogout}><Connectors /></AppShell>} />
          <Route path="/support" element={<Support />} />
          <Route path="/status" element={<GORKAStatus />} />
          <Route path="/my-requests" element={<MyRequests />} />
          <Route path="/my-requests/:id" element={<MyRequestDetail />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;