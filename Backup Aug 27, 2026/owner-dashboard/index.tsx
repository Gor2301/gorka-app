import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import AnalyticsPage from './pages/AnalyticsPage';
import BillingPage from './pages/BillingPage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EditClientPage from './pages/EditClientPage';
import SupportPage from './pages/SupportPage';
import SupportTicketDetailPage from './pages/SupportTicketDetailPage';
import InboxPage from './pages/InboxPage';
import InboxTicketDetail from './pages/InboxTicketDetail';

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/clients" element={
          <ProtectedRoute>
            <ClientsPage />
          </ProtectedRoute>
        } />
        <Route path="/clients/:id" element={
          <ProtectedRoute>
            <ClientDetailPage />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        } />
        <Route path="/billing" element={
          <ProtectedRoute>
            <BillingPage />
          </ProtectedRoute>
        } />
        <Route path="/audit" element={
          <ProtectedRoute>
            <AuditPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
<Route path="/register" element={<RegisterPage />} />
<Route path="/clients/:id/edit" element={<EditClientPage />} />
<Route path="/support" element={<SupportPage />} />
<Route path="/support/:id" element={<SupportTicketDetailPage />} />
<Route path="/inbox" element={<InboxPage />} />
<Route path="/inbox/:id" element={<InboxTicketDetail />} />

      </Routes>
    </BrowserRouter>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);