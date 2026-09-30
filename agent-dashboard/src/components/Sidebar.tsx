import { NavLink } from 'react-router-dom';
import {
  Calendar,
  Users,
  MessageSquare,
  ClipboardList,
  FileText,
  Sparkles,
  Settings as SettingsIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './Sidebar.css';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: Calendar, end: true },
  { to: '/debtors', label: 'Debtors', icon: Users },
  { to: '/communication-tools', label: 'Communication Tools', icon: MessageSquare },
  { to: '/actions', label: 'Actions', icon: ClipboardList },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/copilot', label: 'Copilot', icon: Sparkles, disabled: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-text">GORKA</span>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.to}
                className="sidebar__item sidebar__item--disabled"
              >
                <Icon size={16} strokeWidth={1.7} />
                <span>{item.label}</span>
                <span className="sidebar__badge">Soon</span>
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar__item${isActive ? ' sidebar__item--active' : ''}`
              }
            >
              <Icon size={16} strokeWidth={1.7} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}