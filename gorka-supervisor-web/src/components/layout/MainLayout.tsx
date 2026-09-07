import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/agents': return 'Agents';
      case '/upload': return 'Data Upload';
      case '/logs': return 'Audit Logs';
      case '/permissions': return 'Permissions';
      case '/analytics': return 'Analytics';
      default: return 'Dashboard';
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f6f8fa]">

      {/* ============================================================ */}
      {/* SIDEBAR - Navigation only (no GORKA logo) */}
      {/* ============================================================ */}
      <div className="w-[240px] min-h-screen bg-[#fafafa] border-r border-[#e4e4e7] flex flex-col fixed left-0 top-0">

        {/* NAVIGATION - starts directly, no logo */}
        <nav className="flex-1 px-3 py-4 flex flex-col space-y-0.5">
          <Link to="/" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === '/' ? 'bg-[#f0edfc] text-[#7c3aed]' : 'text-[#3f3f46] hover:bg-[#f4f4f5]'}`}>
            <span>📊</span> Dashboard
          </Link>
          <Link to="/agents" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === '/agents' ? 'bg-[#f0edfc] text-[#7c3aed]' : 'text-[#3f3f46] hover:bg-[#f4f4f5]'}`}>
            <span>👤</span> Agents
          </Link>
          <Link to="/upload" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === '/upload' ? 'bg-[#f0edfc] text-[#7c3aed]' : 'text-[#3f3f46] hover:bg-[#f4f4f5]'}`}>
            <span>📁</span> Data Upload
          </Link>
          <Link to="/logs" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === '/logs' ? 'bg-[#f0edfc] text-[#7c3aed]' : 'text-[#3f3f46] hover:bg-[#f4f4f5]'}`}>
            <span>📋</span> Audit Logs
          </Link>
          <Link to="/permissions" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === '/permissions' ? 'bg-[#f0edfc] text-[#7c3aed]' : 'text-[#3f3f46] hover:bg-[#f4f4f5]'}`}>
            <span>🔒</span> Permissions
          </Link>
          <Link to="/analytics" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === '/analytics' ? 'bg-[#f0edfc] text-[#7c3aed]' : 'text-[#3f3f46] hover:bg-[#f4f4f5]'}`}>
            <span>📈</span> Analytics
          </Link>

          {/* Divider */}
          <div className="my-4 border-t border-[#e4e4e7]"></div>

          {/* WORKSPACE */}
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa] px-3 py-1">
            WORKSPACE
          </div>
          <Link to="/billing" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#3f3f46] hover:bg-[#f4f4f5] transition-colors">
            <span>💳</span> Billing
          </Link>
          <Link to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#3f3f46] hover:bg-[#f4f4f5] transition-colors">
            <span>⚙️</span> Settings
          </Link>
        </nav>

        {/* BOTTOM */}
        <div className="px-5 py-4 border-t border-[#e4e4e7]">
          <div className="text-sm text-[#8b949e] hover:text-[#18181b] cursor-pointer py-1 transition-colors">💜 Changelog</div>
          <div className="text-sm text-[#8b949e] hover:text-[#18181b] cursor-pointer py-1 transition-colors">💜 Invite a friend</div>
          <div className="text-sm text-[#8b949e] hover:text-[#18181b] cursor-pointer py-1 transition-colors">💜 Contact support</div>
          <div className="flex items-center gap-2 text-sm text-[#8b949e] mt-3">
            <span className="w-2 h-2 bg-[#22c55e] rounded-full"></span>
            All services up
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MAIN CONTENT */}
      {/* ============================================================ */}
      <div className="ml-[240px] flex-1 min-h-screen">

        {/* TOP BAR - GORKA in red on LEFT, user on RIGHT */}
        <div className="h-[60px] bg-white border-b border-[#e4e4e7] px-6 flex items-center justify-between sticky top-0 z-40">
          {/* Left: GORKA in red - like DeepSeek/Render */}
          <div className="text-[#dc2626] font-bold text-xl">GORKA</div>

          {/* Right: User info */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#8b949e]">John Supervisor</span>
            <div className="w-8 h-8 rounded-full bg-[#7c3aed] flex items-center justify-center text-white text-sm font-semibold">JS</div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};