import { memo, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Files,
  Book,
  Info,
  Key,
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  List,
  Plus,
} from 'lucide-react';
import { useApp, useAuth, useUI, useModal } from '../store';
import { cn } from '../utils';
import { RoleBadge } from './Badge';
import Tooltip from './Tooltip';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { currentPath, loadFiles, setCurrentTenantId, currentTenantId } = useApp();
  const { sidebarCollapsed, setSidebarCollapsed } = useUI();
  const { openModal } = useModal();

  const isAdmin = useMemo(() => user?.role === 'super_admin' || user?.role === 'tenant_admin', [user?.role]);
  const isSuperAdmin = useMemo(() => user?.role === 'super_admin', [user?.role]);

  const handleNavigation = useCallback((path: string) => {
    // Handle "All Files" path for super admin
    if (isSuperAdmin && path === 'all-files') {
      // Load files from root but with a marker to skip tenant list
      setCurrentTenantId(null);
      loadFiles('__all_files__');
      onMobileClose?.();
      return;
    }
    // For super admin at home, reset tenant to clear files and show dashboard
    if (isSuperAdmin && path === '' && !currentTenantId) {
      setCurrentTenantId(null); // This will clear files and reset path
    } else {
      loadFiles(path);
    }
    onMobileClose?.();
  }, [isSuperAdmin, currentTenantId, setCurrentTenantId, loadFiles, onMobileClose]);

  const handleOpenModal = useCallback((type: 'about' | 'user' | 'settings' | 'admin') => {
    openModal(type);
    onMobileClose?.();
  }, [openModal, onMobileClose]);

  const handleLogout = useCallback(async () => {
    await logout();
    onMobileClose?.();
  }, [logout, onMobileClose]);

  const navItems = useMemo(() => [
    { icon: Home, label: 'Home', path: '', active: currentPath === '' && !currentTenantId },
    ...(isSuperAdmin ? [{ icon: Files, label: 'All Files', path: 'all-files', active: currentPath === 'all-files' }] : [{ icon: Files, label: 'All Files', path: '', active: false }]),
  ], [currentPath, isSuperAdmin, currentTenantId]);

  const handleAboutClick = useCallback(() => {
    handleOpenModal('about');
  }, [handleOpenModal]);

  const utilityItems = useMemo(() => [
    { icon: Book, label: 'API Docs', href: '/api-docs', external: true },
    { icon: Info, label: 'About', onClick: handleAboutClick },
  ], [handleAboutClick]);

  const handleListTenants = useCallback(() => {
    // Navigate to root to show all tenant folders
    setCurrentTenantId(null);
    loadFiles('');
    onMobileClose?.();
  }, [setCurrentTenantId, loadFiles, onMobileClose]);

  const handleCreateTenant = useCallback(() => {
    openModal('tenantCreate');
  }, [openModal]);

  const tenantItems = useMemo(() => isSuperAdmin
    ? [
        { icon: List, label: 'List Tenants', onClick: handleListTenants },
        { icon: Plus, label: 'Create Tenant', onClick: handleCreateTenant },
      ]
    : [], [isSuperAdmin, handleListTenants, handleCreateTenant]);

  const handleApiTokenClick = useCallback(() => {
    handleOpenModal('user');
  }, [handleOpenModal]);

  const handleUsersClick = useCallback(() => {
    handleOpenModal('admin');
  }, [handleOpenModal]);

  const handleSettingsClick = useCallback(() => {
    handleOpenModal('settings');
  }, [handleOpenModal]);

  const settingsItems = useMemo(() => [
    { icon: Key, label: 'API Token', onClick: handleApiTokenClick },
    ...(isAdmin
      ? [
          { icon: Users, label: 'Users', onClick: handleUsersClick },
        ]
      : []),
    ...(isSuperAdmin
      ? [
          { icon: Settings, label: 'Settings', onClick: handleSettingsClick },
        ]
      : []),
  ], [isAdmin, isSuperAdmin, handleApiTokenClick, handleUsersClick, handleSettingsClick]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src="/sfm-logo.png" alt="Logo" className="w-8 h-8 object-contain shrink-0" />
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
            <div className="text-[10px] uppercase tracking-wider text-sidebar-text/70 mb-2 px-2">
              Navigation
            </div>
          )}
          {navItems.map((item) => {
            const button = (
              <button
                key={item.label}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  'w-full flex items-center text-sm transition-colors mb-1',
                  sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-2 py-2',
                  item.active
                    ? 'bg-sidebar-hover text-sidebar-active'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );

            return sidebarCollapsed ? (
              <Tooltip key={item.label} content={item.label} position="right">
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </div>

        {/* Tenants (Super Admin) */}
        {tenantItems.length > 0 && (
          <div className="px-3 mb-6">
            {!sidebarCollapsed && (
              <div className="text-[10px] uppercase tracking-wider text-sidebar-text/70 mb-2 px-2">
                Tenants
              </div>
            )}
            {tenantItems.map((item) => {
              const button = (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={cn(
                    'w-full flex items-center text-sm transition-colors mb-1',
                    sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-2 py-2',
                    'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse'
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );

              return sidebarCollapsed ? (
                <Tooltip key={item.label} content={item.label} position="right">
                  {button}
                </Tooltip>
              ) : (
                button
              );
            })}
          </div>
        )}

        {/* Utilities */}
        <div className="px-3 mb-6">
          {!sidebarCollapsed && (
            <div className="text-[10px] uppercase tracking-wider text-sidebar-text/70 mb-2 px-2">
              Resources
            </div>
          )}
          {utilityItems.map((item) => {
            const linkOrButton = item.href ? (
              <a
                key={item.label}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className={cn(
                  'w-full flex items-center text-sm transition-colors mb-1',
                  sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-2 py-2',
                  'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse'
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
                  'w-full flex items-center text-sm transition-colors mb-1',
                  sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-2 py-2',
                  'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );

            return sidebarCollapsed ? (
              <Tooltip key={item.label} content={item.label} position="right">
                {linkOrButton}
              </Tooltip>
            ) : (
              linkOrButton
            );
          })}
        </div>

        {/* Settings */}
        <div className="px-3">
          {!sidebarCollapsed && (
            <div className="text-[10px] uppercase tracking-wider text-sidebar-text/70 mb-2 px-2">
              Settings
            </div>
          )}
          {settingsItems.map((item) => {
            const button = (
              <button
                key={item.label}
                onClick={item.onClick}
                className={cn(
                  'w-full flex items-center text-sm transition-colors mb-1',
                  sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-2 py-2',
                  'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );

            return sidebarCollapsed ? (
              <Tooltip key={item.label} content={item.label} position="right">
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
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
              {user?.username?.toLowerCase() !== user?.role?.toLowerCase() && (
                <RoleBadge role={user?.role || 'user'} />
              )}
            </div>
          )}
        </div>
{(() => {
          const logoutButton = (
            <button
              onClick={handleLogout}
              className={cn(
                'w-full flex items-center mt-2 text-sm transition-colors',
                sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-2 py-2',
                'text-sidebar-text hover:bg-sidebar-hover hover:text-inverse'
              )}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          );

          return sidebarCollapsed ? (
            <Tooltip content="Logout" position="right">
              {logoutButton}
            </Tooltip>
          ) : (
            logoutButton
          );
        })()}
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

export default memo(Sidebar);
