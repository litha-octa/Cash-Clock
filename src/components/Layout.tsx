import { Outlet, Link, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Dashboard', icon: '\u{1F3E0}' },
  { path: '/log', label: 'Log', icon: '\u{1F4DD}' },
  { path: '/needs', label: 'Needs', icon: '\u{1F4CB}' },
  { path: '/settings', label: 'Settings', icon: '\u2699\uFE0F' },
];

export default function Layout() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-gray-900">
      {/* Content area */}
      <main className="px-4 pb-24 pt-6">
        <Outlet />
      </main>

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
                  active ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
                {active && (
                  <span className="mt-0.5 h-0.5 w-4 rounded-full bg-emerald-400" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
