import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Home,
  Files,
  Clock,
  Book,
  Info,
  Key,
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useApp, useAuth, useUI, useModal } from '../store';
import { cn } from '../utils';
import { RoleBadge } from './Badge';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { currentPath, loadFiles } = useApp();
  const { sidebarCollapsed, setSidebarCollapsed } = useUI();
  const { openModal } = useModal();

  const isAdmin = user?.role === 'admin';

  const handleNavigation = (path: string) => {
    loadFiles(path);
    onMobileClose?.();
  };

  const handleOpenModal = (type: 'about' | 'user' | 'settings' | 'admin') => {
    openModal(type);
    onMobileClose?.();
  };

  const handleLogout = async () => {
    await logout();
    onMobileClose?.();
  };

  const navItems = [
    { icon: Home, label: 'Home', path: '', active: currentPath === '' },
    { icon: Files, label: 'All Files', path: '', active: false },
    { icon: Clock, label: 'Recent', path: '', active: false, disabled: true },
  ];

  const utilityItems = [
    { icon: Book, label: 'API Docs', href: '/api-docs', external: true },
    { icon: Info, label: 'About', onClick: () => handleOpenModal('about') },
  ];

  const settingsItems = [
    { icon: Key, label: 'API Token', onClick: () => handleOpenModal('user') },
    ...(isAdmin
      ? [
          { icon: Settings, label: 'Settings', onClick: () => handleOpenModal('settings') },
          { icon: Users, label: 'Users', onClick: () => handleOpenModal('admin') },
        ]
      : []),
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary flex items-center justify-center shrink-0">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-semibold text-inverse text-sm whitespace-nowrap"
            >
              File Manager
            </motion.span>
          )}
        </div>
        
        {/* Mobile close button */}
        {isMobileOpen && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1 text-sidebar-text hover:text-inverse"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        
        {/* Collapse button - desktop only */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex p-1 text-sidebar-text hover:text-inverse hover:bg-sidebar-hover transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Main nav */}
        <div className="px-3 mb-6">
          {!sidebarCollapsed && (
            <div className="text-[10px] uppercase tracking-wider text-sidebar-text/50 mb-2 px-2">
              Navigation
            </div>
          )}
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => !item.disabled && handleNavigation(item.path)}
              disabled={item.disabled}
              className={cn(
                'w-full flex items-center gap-3 px-2 py-2 text-sm transition-colors mb-1',
                item.active
                  ? 'bg-sidebar-hover text-sidebar-text-active'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse',
                item.disabled && 'opacity-50 cursor-not-allowed',
                sidebarCollapsed && 'justify-center'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        {/* Utilities */}
        <div className="px-3 mb-6">
          {!sidebarCollapsed && (
            <div className="text-[10px] uppercase tracking-wider text-sidebar-text/50 mb-2 px-2">
              Resources
            </div>
          )}
          {utilityItems.map((item) =>
            item.href ? (
              <a
                key={item.label}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-2 py-2 text-sm transition-colors mb-1',
                  'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse',
                  sidebarCollapsed && 'justify-center'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </a>
            ) : (
              <button
                key={item.label}
                onClick={item.onClick}
                className={cn(
                  'w-full flex items-center gap-3 px-2 py-2 text-sm transition-colors mb-1',
                  'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse',
                  sidebarCollapsed && 'justify-center'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            )
          )}
        </div>

        {/* Settings */}
        <div className="px-3">
          {!sidebarCollapsed && (
            <div className="text-[10px] uppercase tracking-wider text-sidebar-text/50 mb-2 px-2">
              Settings
            </div>
          )}
          {settingsItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={cn(
                'w-full flex items-center gap-3 px-2 py-2 text-sm transition-colors mb-1',
                'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse',
                sidebarCollapsed && 'justify-center'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            'flex items-center gap-3 p-2',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <div className="w-8 h-8 bg-sidebar-hover flex items-center justify-center text-inverse text-sm font-medium shrink-0">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm text-inverse truncate">
                {user?.username}
              </div>
              <RoleBadge role={user?.role || 'user'} />
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-2 py-2 mt-2 text-sm transition-colors',
            'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        transition={{ duration: 0.2 }}
        className="hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-sidebar z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
