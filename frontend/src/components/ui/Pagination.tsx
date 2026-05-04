'use client';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  const handleClick = (page: number) => {
    if (page === currentPage) return;
    onPageChange(page);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav
      aria-label="페이지네이션"
      className={`flex items-center justify-center gap-2 ${className}`}
    >
      <button
        type="button"
        onClick={() => handleClick(currentPage - 1)}
        disabled={isFirst}
        className="rounded-full border border-blue-200 px-4 py-1.5 text-sm text-blue-600 transition-all hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        이전
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => handleClick(page)}
          aria-current={page === currentPage ? 'page' : undefined}
          className={`min-w-[36px] rounded-full border px-3 py-1.5 text-sm transition-all ${
            page === currentPage
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-blue-200 text-blue-600 hover:bg-blue-50'
          }`}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        onClick={() => handleClick(currentPage + 1)}
        disabled={isLast}
        className="rounded-full border border-blue-200 px-4 py-1.5 text-sm text-blue-600 transition-all hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        다음
      </button>
    </nav>
  );
}
