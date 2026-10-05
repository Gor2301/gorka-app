import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import './AppShell.css';

interface AppShellProps {
  onLogout: () => void;
}

export default function AppShell({ onLogout }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar onLogout={onLogout} />
      <div className="app-shell__main">
        <TopHeader />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}