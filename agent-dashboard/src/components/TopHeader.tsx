import { useLocation } from 'react-router-dom';
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

export default function TopHeader() {
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
      </div>
    </header>
  );
}