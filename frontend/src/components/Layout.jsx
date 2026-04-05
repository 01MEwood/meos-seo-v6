import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '◉', roles: ['ADMIN', 'POWERUSER', 'REDAKTEUR'] },
  { path: '/content', label: 'Content', icon: '✎', roles: ['ADMIN', 'POWERUSER', 'REDAKTEUR'] },
  { path: '/tracking', label: 'Keywords', icon: '⬆', roles: ['ADMIN', 'POWERUSER'] },
  { path: '/llm', label: 'LLM-Tracker', icon: '◎', roles: ['ADMIN', 'POWERUSER'] },
  { path: '/audit', label: 'SEO-Agent', icon: '⚙', roles: ['ADMIN', 'POWERUSER'] },
  { path: '/timeline', label: 'Zeitschiene', icon: '━', roles: ['ADMIN', 'POWERUSER', 'REDAKTEUR'] },
  { path: '/alerts', label: 'Alerts', icon: '!', roles: ['ADMIN', 'POWERUSER'] },
  { path: '/jobs', label: 'Jobs', icon: '⟳', roles: ['ADMIN', 'POWERUSER'] },
  { type: 'divider' },
  { path: '/skills', label: 'Skills', icon: '☰', roles: ['ADMIN'] },
  { path: '/users', label: 'Nutzer', icon: '♟', roles: ['ADMIN'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    api.get('/alerts', { unreadOnly: 'true', limit: '100' })
      .then(alerts => setAlertCount(alerts.length))
      .catch(() => {});
    const interval = setInterval(() => {
      api.get('/alerts', { unreadOnly: 'true', limit: '100' })
        .then(alerts => setAlertCount(alerts.length))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const visibleItems = NAV_ITEMS.filter(
    item => item.type === 'divider' || item.roles.includes(user.role)
  );

  return (
    <div className="flex h-screen">
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <div className="w-8 h-8 rounded-lg bg-[#EE7E00] flex items-center justify-center text-white font-bold text-sm">M</div>
            {sidebarOpen && <span className="font-bold text-sm">MEOS:SEO <span className="text-gray-400 font-normal">v6</span></span>}
          </div>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {visibleItems.map((item, i) => {
            if (item.type === 'divider') {
              return <div key={i} className="my-2 mx-3 border-t border-gray-100" />;
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-orange-50 text-[#EE7E00] font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`
                }
              >
                <span className="w-5 text-center text-base">{item.icon}</span>
                {sidebarOpen && (
                  <span className="flex-1">{item.label}</span>
                )}
                {sidebarOpen && item.path === '/alerts' && alertCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {alertCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                {user.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-gray-400">{user.role}</p>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} className="text-gray-400 hover:text-red-500 text-sm" title="Abmelden">✕</button>
            </div>
          ) : (
            <button onClick={() => { logout(); navigate('/login'); }} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs" title="Abmelden">
              {user.name?.charAt(0)}
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 bg-[#f6f8f5]">
        <Outlet />
      </main>
    </div>
  );
}
