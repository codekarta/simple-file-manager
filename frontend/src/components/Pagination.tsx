import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFiles, useUI } from '../store';
import Button from './Button';
import { cn } from '../utils';

export default function Pagination() {
  const { pagination, loadFiles, currentPath } = useFiles();
  const { itemsPerPage, setItemsPerPage } = useUI();

  if (!pagination || pagination.total === 0) {
    return null;
  }

  const { page, total, totalPages, hasNext, hasPrev } = pagination;
  const start = (page - 1) * itemsPerPage + 1;
  const end = Math.min(page * itemsPerPage, total);

  const goToPage = (newPage: number) => {
    loadFiles(currentPath, newPage);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate range around current page
      let startPage = Math.max(2, page - 1);
      let endPage = Math.min(totalPages - 1, page + 1);
      
      // Adjust if at edges
      if (page <= 3) {
        endPage = Math.min(maxVisible, totalPages - 1);
      } else if (page >= totalPages - 2) {
        startPage = Math.max(2, totalPages - maxVisible + 1);
      }
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push('ellipsis');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-border bg-surface-secondary">
      {/* Info */}
      <div className="text-sm text-muted">
        Showing <span className="font-medium text-foreground">{start}</span>-
        <span className="font-medium text-foreground">{end}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span> items
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          icon={<ChevronLeft className="w-4 h-4" />}
          onClick={() => goToPage(page - 1)}
          disabled={!hasPrev}
        >
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers().map((pageNum, index) =>
            pageNum === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-subtle">
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                onClick={() => goToPage(pageNum)}
                className={cn(
                  'min-w-[32px] h-8 px-2 text-sm font-medium transition-colors',
                  pageNum === page
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-foreground hover:bg-surface-tertiary'
                )}
              >
                {pageNum}
              </button>
            )
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<ChevronRight className="w-4 h-4" />}
          iconPosition="right"
          onClick={() => goToPage(page + 1)}
          disabled={!hasNext}
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
      </div>

      {/* Items per page */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="hidden sm:inline">Items per page:</span>
        <select
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            loadFiles(currentPath, 1);
          }}
          className="h-8 px-2 bg-surface border border-border text-sm focus:outline-none focus:border-primary"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
      </div>
    </div>
  );
}
