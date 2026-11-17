import React from 'react';
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Home,
  Library,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  TrendingUp,
  X,
} from 'lucide-react';
import type { NavRoute } from '../types/learning';
import { SrvLogo } from './SrvLogo';

interface SidebarProps {
  activeRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  savedLessonsCount: number;
  isAdmin: boolean;
  userDisplayName: string;
  userEmail: string;
  userPhotoUrl?: string | null;
  onSignOut: () => void;
}

interface NavItem {
  id: NavRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'learn', label: 'Learn', icon: BookOpen },
  { id: 'my-learning', label: 'My Learning', icon: Library },
  { id: 'tutor', label: 'AI Tutor', icon: MessageSquare },
  { id: 'assessments', label: 'Assessments', icon: ClipboardCheck },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeRoute,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  savedLessonsCount,
  isAdmin,
  userDisplayName,
  userEmail,
  userPhotoUrl,
  onSignOut,
}) => {
  const handleSelect = (route: NavRoute) => {
    onNavigate(route);
    onCloseMobile();
  };

  const navItems: NavItem[] = isAdmin
    ? [
        ...BASE_NAV_ITEMS.slice(0, 6),
        { id: 'growth', label: 'Platform Growth', icon: TrendingUp },
        BASE_NAV_ITEMS[6],
      ]
    : BASE_NAV_ITEMS;

  const initials = (userDisplayName || userEmail || 'S')
    .slice(0, 1)
    .toUpperCase();

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#080D1A] border-r border-slate-800/80 select-none">
      {/* Brand Lockup */}
      <div
        className={`flex h-16 items-center border-b border-slate-800/80 px-4 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg p-1"
          aria-label="SmartEd Home"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600/10 border border-sky-500/30">
            <SrvLogo size={32} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
                SmartEd
              </div>
              <div className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                by ST Group
              </div>
            </div>
          )}
        </button>

        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onCloseMobile}
          className="flex lg:hidden h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/70 hover:text-white transition-colors"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 min-h-[44px] text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                collapsed ? 'justify-center px-2' : 'justify-between'
              } ${
                isActive
                  ? 'bg-sky-600/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </span>
              {!collapsed && item.id === 'my-learning' && savedLessonsCount > 0 && (
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {savedLessonsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account Footer + Collapse Expand */}
      <div className="border-t border-slate-800/80 p-3 space-y-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onSignOut}
              title={`Sign out (${userEmail})`}
              aria-label="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/70 hover:text-rose-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex w-full h-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 transition-colors"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 px-1">
            <div className="flex items-center gap-2.5">
              {userPhotoUrl ? (
                <img
                  src={userPhotoUrl}
                  alt={userDisplayName}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600/20 border border-sky-500/35 text-xs font-semibold text-sky-300">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-white">
                  {userDisplayName}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {userEmail}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-[#060913] hover:border-slate-600 hover:text-white px-3 py-2 min-h-[36px] text-xs font-medium text-slate-300 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[252px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
