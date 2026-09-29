import { invoke } from '@tauri-apps/api/core';
import { Button } from './primitives';
import './AppShell.css';

interface AppShellProps {
  onLogout: () => void;
}

export default function AppShell({ onLogout }: AppShellProps) {
  const handleLogout = async () => {
    try {
      await invoke('logout');
    } catch {
      // Even if the backend call fails, drop the user back to Login
      // so they are not stuck inside the shell.
    }
    onLogout();
  };

  return (
    <div className="app-shell-placeholder">
      <div className="app-shell-placeholder__box">
        <h1 className="app-shell-placeholder__title">Entry flow complete</h1>
        <p className="app-shell-placeholder__text">
          The main Agent shell is built in Stage D.3.
        </p>
        <Button variant="ghost" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </div>
  );
}