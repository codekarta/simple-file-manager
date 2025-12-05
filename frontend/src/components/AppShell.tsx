import { useState } from 'react';
import { motion } from 'framer-motion';
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

export default function AppShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
      >
        {/* Header */}
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />

        {/* File Explorer */}
        <FileExplorer />
      </motion.main>

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
