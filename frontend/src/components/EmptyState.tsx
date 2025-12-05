import { motion } from 'framer-motion';
import { FolderOpen, Upload, Search } from 'lucide-react';
import Button from './Button';
import { useModal } from '../store';

interface EmptyStateProps {
  type?: 'empty' | 'search';
  searchQuery?: string;
}

export default function EmptyState({ type = 'empty', searchQuery }: EmptyStateProps) {
  const { openModal } = useModal();

  if (type === 'search') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 px-4"
      >
        <div className="w-16 h-16 flex items-center justify-center bg-surface-secondary mb-4">
          <Search className="w-8 h-8 text-subtle" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No results found
        </h3>
        <p className="text-sm text-muted text-center max-w-sm">
          No files or folders match "{searchQuery}". Try adjusting your search or
          check if regex mode is enabled.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="w-16 h-16 flex items-center justify-center bg-surface-secondary mb-4">
        <FolderOpen className="w-8 h-8 text-subtle" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        This folder is empty
      </h3>
      <p className="text-sm text-muted text-center max-w-sm mb-6">
        Upload files or create a new folder to get started.
      </p>
      <div className="flex gap-3">
        <Button
          variant="primary"
          icon={<Upload className="w-4 h-4" />}
          onClick={() => openModal('upload')}
        >
          Upload Files
        </Button>
      </div>
    </motion.div>
  );
}
