import { useState, useEffect } from 'react';
import { Save, Edit, Lock, ArrowLeft, Sun, Moon } from 'lucide-react';
import MonacoEditor from './MonacoEditor';
import Button from './Button';
import { useApp } from '../store';
import { isTextFile, getMonacoLanguage, getStorageItem, setStorageItem } from '../utils';
import * as api from '../api';

interface FileEditorProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export default function FileEditor({ filePath, fileName, onClose }: FileEditorProps) {
  const { showToast, user, currentTenantId } = useApp();

  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadonly, setIsReadonly] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [theme, setTheme] = useState<'vs-dark' | 'vs'>(() => 
    getStorageItem('monacoEditorTheme', 'vs-dark')
  );

  // Determine tenantId
  const tenantId = currentTenantId || (user?.tenantId || null);

  useEffect(() => {
    if (filePath) {
      loadFileContent();
    }
  }, [filePath]);

  const loadFileContent = async () => {
    setIsLoading(true);
    try {
      const fileContent = await api.readFileContent(filePath, tenantId);
      setContent(fileContent);
      setOriginalContent(fileContent);
      setHasChanges(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load file content', 'error');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== originalContent);
  };

  const handleToggleEdit = () => {
    setIsReadonly(!isReadonly);
  };

  const handleToggleTheme = () => {
    const newTheme = theme === 'vs-dark' ? 'vs' : 'vs-dark';
    setTheme(newTheme);
    setStorageItem('monacoEditorTheme', newTheme);
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      await api.writeFileContent(filePath, content, tenantId);
      setOriginalContent(content);
      setHasChanges(false);
      showToast('File saved successfully', 'success');
      // Optionally reload file list
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save file', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) return;
    }
    onClose();
  };

  if (!isTextFile(fileName)) {
    return null;
  }

  const language = getMonacoLanguage(fileName);

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-secondary shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="p-1.5 text-muted hover:text-foreground hover:bg-surface-tertiary transition-colors"
            title="Back to file list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {fileName}{hasChanges ? ' *' : ''}
            </span>
            <span className="text-xs text-muted truncate">{filePath}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={theme === 'vs-dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            onClick={handleToggleTheme}
            disabled={isLoading}
            title={theme === 'vs-dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'vs-dark' ? 'Light' : 'Dark'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={isReadonly ? <Edit className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            onClick={handleToggleEdit}
            disabled={isLoading}
          >
            {isReadonly ? 'Enable Editing' : 'Disable Editing'}
          </Button>
          {!isReadonly && (
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-4 h-4" />}
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              loading={isSaving}
            >
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted">Loading file content...</div>
          </div>
        ) : (
          <MonacoEditor
            value={content}
            onChange={handleContentChange}
            language={language}
            readonly={isReadonly}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}
