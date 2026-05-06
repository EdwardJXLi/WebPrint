import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '../context/useAuth';
import Badge from './Badge';
import PoweredByFooter from './PoweredByFooter';
import PrinterMark from './PrinterMark';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1.5 text-sm font-medium transition sm:px-3 sm:py-2 ${
    isActive ? 'bg-green-50 text-green-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
  }`;

export default function Layout({ children }: { children: ReactNode }) {
  const { config, logout, user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <PrinterMark className="h-8 w-8 sm:h-9 sm:w-9" />
            <div className="text-base font-semibold text-slate-950 sm:text-lg">{config.appName}</div>
          </div>

          <nav className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:px-0">
            <NavLink className={navLinkClass} to="/">
              Dashboard
            </NavLink>
            <NavLink className={navLinkClass} end to="/jobs">
              Jobs
            </NavLink>
            <NavLink className={navLinkClass} to="/jobs/new">
              New Print Job
            </NavLink>
            {user.role === 'admin' && (
              <NavLink className={navLinkClass} to="/admin">
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-950">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email || 'Signed in'}</div>
            </div>
            <Badge tone={user.role}>{user.role}</Badge>
            <button className="button-secondary" onClick={logout} type="button">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8">{children}</main>
      <PoweredByFooter />
    </div>
  );
}
