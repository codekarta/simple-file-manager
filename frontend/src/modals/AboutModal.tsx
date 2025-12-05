import { useState, useEffect } from 'react';
import { FolderOpen, ExternalLink, Github } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { useModal } from '../store';
import type { AboutInfo } from '../types';
import * as api from '../api';

export default function AboutModal() {
  const { activeModal, closeModal } = useModal();
  const [aboutInfo, setAboutInfo] = useState<AboutInfo | null>(null);

  const isOpen = activeModal === 'about';

  useEffect(() => {
    if (isOpen) {
      loadAboutInfo();
    }
  }, [isOpen]);

  const loadAboutInfo = async () => {
    try {
      const info = await api.getAboutInfo();
      setAboutInfo(info);
    } catch {
      // Ignore errors
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="About"
      size="sm"
    >
      <div className="flex flex-col items-center text-center">
        {/* Logo */}
        <div className="w-16 h-16 bg-primary flex items-center justify-center mb-4">
          <FolderOpen className="w-10 h-10 text-white" />
        </div>

        {/* Name and Version */}
        <h2 className="text-xl font-semibold text-foreground mb-1">
          Simple File Manager
        </h2>
        <p className="text-sm text-muted mb-4">
          Version {aboutInfo?.version || '...'}
        </p>

        {/* Description */}
        <p className="text-sm text-muted mb-6">
          {aboutInfo?.description || 'A lightweight file management solution with authentication and API access.'}
        </p>

        {/* Built with */}
        <div className="w-full text-left mb-6">
          <h3 className="text-xs font-semibold text-subtle uppercase tracking-wide mb-2">
            Built with
          </h3>
          <ul className="text-sm text-muted space-y-1">
            <li>• Express.js - Web framework</li>
            <li>• React 19 - Frontend library</li>
            <li>• Tailwind CSS - Styling</li>
            <li>• SQLite - File cache database</li>
            <li>• Sharp - Image processing</li>
          </ul>
        </div>

        {/* License */}
        <div className="w-full text-left mb-6">
          <h3 className="text-xs font-semibold text-subtle uppercase tracking-wide mb-2">
            License
          </h3>
          <p className="text-sm text-muted">
            {aboutInfo?.license || 'MIT'} License
          </p>
        </div>

        {/* Links */}
        <div className="flex gap-3 w-full">
          <a
            href="https://github.com/codekarta/simple-file-manager"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="secondary" className="w-full" icon={<Github className="w-4 h-4" />}>
              GitHub
            </Button>
          </a>
          <a
            href="/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="secondary" className="w-full" icon={<ExternalLink className="w-4 h-4" />}>
              API Docs
            </Button>
          </a>
        </div>

        {/* Credits */}
        <div className="mt-6 pt-4 border-t border-border w-full">
          <p className="text-xs text-subtle">
            Powered by AlgoDomain Solutions
          </p>
        </div>
      </div>
    </Modal>
  );
}
