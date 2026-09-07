
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Collections from './pages/Collections';
import Upload from './pages/Upload';
import Audit from './pages/Audit';
import Permissions from './pages/Permissions';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ComplianceReport from './pages/ComplianceReport';
import DataFlowAudit from './pages/DataFlowAudit';
import Calendar from './pages/Calendar';
import Connectors from './pages/Connectors';
import { GORKAStatus } from './pages/GORKAStatus';
import Support from './pages/Support';
import MyRequests from './pages/MyRequests';
import MyRequestDetail from './pages/MyRequestDetail';

function App() {
  const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
  const isAuthenticated = !!token;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={isAuthenticated ? <AppShell><Dashboard /></AppShell> : <Navigate to="/login" />} />
        <Route path="/dashboard" element={isAuthenticated ? <AppShell><Dashboard /></AppShell> : <Navigate to="/login" />} />
        <Route path="/agents" element={isAuthenticated ? <AppShell><Agents /></AppShell> : <Navigate to="/login" />} />
        <Route path="/collections" element={isAuthenticated ? <AppShell><Collections /></AppShell> : <Navigate to="/login" />} />
        <Route path="/upload" element={isAuthenticated ? <AppShell><Upload /></AppShell> : <Navigate to="/login" />} />
        <Route path="/audit" element={isAuthenticated ? <AppShell><Audit /></AppShell> : <Navigate to="/login" />} />
        <Route path="/permissions" element={isAuthenticated ? <AppShell><Permissions /></AppShell> : <Navigate to="/login" />} />
        <Route path="/analytics" element={isAuthenticated ? <AppShell><Analytics /></AppShell> : <Navigate to="/login" />} />
        <Route path="/billing" element={isAuthenticated ? <AppShell><Billing /></AppShell> : <Navigate to="/login" />} />
        <Route path="/settings" element={isAuthenticated ? <AppShell><Settings /></AppShell> : <Navigate to="/login" />} />
        <Route path="/compliance" element={isAuthenticated ? <AppShell><ComplianceReport /></AppShell> : <Navigate to="/login" />} />
        <Route path="/data-flow-audit" element={isAuthenticated ? <AppShell><DataFlowAudit /></AppShell> : <Navigate to="/login" />} />
        <Route path="/calendar" element={isAuthenticated ? <AppShell><Calendar /></AppShell> : <Navigate to="/login" />} />
        <Route path="/connectors" element={isAuthenticated ? <AppShell><Connectors /></AppShell> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
<Route path="/support" element={<Support />} />
<Route path="/status" element={<GORKAStatus />} />
<Route path="/my-requests" element={<MyRequests />} />
<Route path="/my-requests/:id" element={<MyRequestDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;