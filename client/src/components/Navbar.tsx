import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from './Button';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function navLinkClass(to: string) {
    const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return active
      ? 'text-sm font-semibold bg-[#BFF143] text-[#121113] px-3 py-1 rounded-full transition-all'
      : 'text-sm text-slate-400 hover:text-white transition-colors';
  }

  return (
    <nav
      className="no-print border-b border-white/10 px-6 py-3 flex items-center justify-between"
      style={{ background: '#121113' }}
    >
      <Link to={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: '#BFF143', color: '#121113' }}
        >
          C
        </div>
        <span className="font-semibold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
          Compass Project
        </span>
      </Link>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <Link to="/admin" className={navLinkClass('/admin')}>
            SOP Library
          </Link>
        )}
        <Link to="/dashboard" className={navLinkClass('/dashboard')}>
          Dashboard
        </Link>

        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-white font-medium leading-none">{user?.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{user?.role}</p>
          </div>
          <Button variant="ghost-dark" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </nav>
  );
}
