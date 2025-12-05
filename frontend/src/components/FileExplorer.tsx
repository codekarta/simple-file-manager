import { useFiles, useUI } from '../store';
import FileTable from './FileTable';
import FileGrid from './FileGrid';
import Pagination from './Pagination';
import EmptyState from './EmptyState';
import { LoadingOverlay } from './Spinner';

export default function FileExplorer() {
  const { optimisticFiles, isLoading } = useFiles();
  const { viewMode, searchQuery } = useUI();

  const isEmpty = optimisticFiles.length === 0;

  return (
    <div className="flex-1 flex flex-col bg-surface relative min-h-0">
      {isLoading && <LoadingOverlay />}

      {isEmpty ? (
        <EmptyState
          type={searchQuery ? 'search' : 'empty'}
          searchQuery={searchQuery}
        />
      ) : (
        <>
          <div className="flex-1 overflow-auto">
            {viewMode === 'table' ? <FileTable /> : <FileGrid />}
          </div>
          <Pagination />
        </>
      )}
    </div>
  );
}
