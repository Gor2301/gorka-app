import { useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Avatar } from './primitives';
import './TopHeader.css';
import SyncIndicator from './SyncIndicator';

const TITLES: Record<string, string> = {
  '/': 'Today',
  '/plan': 'Plan',
  '/debtors': 'Debtors',
  '/communication-tools': 'Communication Tools',
  '/actions': 'Actions',
  '/documents': 'Documents',
  '/copilot': 'Copilot',
  '/support': 'Support',
  '/settings': 'Settings',
};

interface TopHeaderProps {
  onLogout: () => void;
}

export default function TopHeader({ onLogout }: TopHeaderProps) {
  const location = useLocation();
  const title =
    TITLES[location.pathname] ??
    (location.pathname.startsWith('/debtors/') ? 'Debtor Profile' : 'GORKA');

  return (
    <header className="top-header">
      <h1 className="top-header__title">{title}</h1>

      <div className="top-header__right">
        <SyncIndicator />

        <Avatar name="Agent" size={28} />

        <button
          type="button"
          className="top-header__logout"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={18} strokeWidth={1.7} />
        </button>
      </div>
    </header>
  );
}