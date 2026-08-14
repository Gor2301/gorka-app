import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import { authService } from './services/auth.service';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = authService.getUser();
  
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{
        width: '240px',
        background: '#1a1a2e',
        color: 'white',
        padding: '20px 0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '0 20px', marginBottom: '32px' }}>
          <h1 style={{ color: '#F01428', fontSize: '24px', margin: 0 }}>GORKA</h1>
          <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>Super Admin</p>
        </div>
        
        <nav style={{ flex: 1 }}>
          <Link to="/dashboard" style={{
            display: 'block',
            padding: '12px 20px',
            color: '#ccc',
            textDecoration: 'none',
            borderLeft: '3px solid transparent'
          }}>
            📊 Dashboard
          </Link>
          <Link to="/clients" style={{
            display: 'block',
            padding: '12px 20px',
            color: '#ccc',
            textDecoration: 'none',
            borderLeft: '3px solid transparent'
          }}>
            🏢 Clients
          </Link>
        </nav>
        
        <div style={{ padding: '20px', borderTop: '1px solid #333' }}>
          <div style={{ fontSize: '14px', color: '#888' }}>{user?.email}</div>
          <button
            onClick={() => {
              authService.logout();
              window.location.href = '/';
            }}
            style={{
              marginTop: '8px',
              background: 'transparent',
              color: '#F01428',
              border: '1px solid #F01428',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, background: '#f5f5f5' }}>
        {children}
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <PrivateRoute>
              <Layout>
                <Clients />
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;