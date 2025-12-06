import { useState, useCallback, memo } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import FileExplorer from './FileExplorer';

// Import all modals
import UploadModal from '../modals/UploadModal';
import NewFolderModal from '../modals/NewFolderModal';
import NewFileModal from '../modals/NewFileModal';
import RenameModal from '../modals/RenameModal';
import DeleteModal from '../modals/DeleteModal';
import UserModal from '../modals/UserModal';
import SettingsModal from '../modals/SettingsModal';
import AdminModal from '../modals/AdminModal';
import AboutModal from '../modals/AboutModal';
import SlideshowModal from '../modals/SlideshowModal';
import MoveModal from '../modals/MoveModal';
import TenantModal from '../modals/TenantModal';
import TenantUserModal from '../modals/TenantUserModal';

function AppShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleCloseMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const handleOpenMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(true);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={handleCloseMobileMenu}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Header onMenuClick={handleOpenMobileMenu} />

        {/* File Explorer */}
        <FileExplorer />
      </main>

      {/* Modals */}
      <UploadModal />
      <NewFolderModal />
      <NewFileModal />
      <RenameModal />
      <DeleteModal />
      <UserModal />
      <SettingsModal />
      <AdminModal />
      <AboutModal />
      <SlideshowModal />
      <MoveModal />
      <TenantModal />
      <TenantUserModal />
    </div>
  );
}

export default memo(AppShell);
