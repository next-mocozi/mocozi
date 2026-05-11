'use client';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

const SIBLING_COUNT = 1;

// 윈도우 페이지네이션: 1 ... C-1 C C+1 ... N (최대 7개 노출)
function getPageItems(
  currentPage: number,
  totalPages: number,
): Array<number | 'ellipsis-left' | 'ellipsis-right'> {
  const TOTAL_DISPLAYED = SIBLING_COUNT * 2 + 5;

  if (totalPages <= TOTAL_DISPLAYED) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(currentPage - SIBLING_COUNT, 1);
  const rightSibling = Math.min(currentPage + SIBLING_COUNT, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftCount = 3 + 2 * SIBLING_COUNT;
    const left = Array.from({ length: leftCount }, (_, i) => i + 1);
    return [...left, 'ellipsis-right', totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + 2 * SIBLING_COUNT;
    const right = Array.from(
      { length: rightCount },
      (_, i) => totalPages - rightCount + 1 + i,
    );
    return [1, 'ellipsis-left', ...right];
  }

  const middleCount = 1 + 2 * SIBLING_COUNT;
  const middle = Array.from({ length: middleCount }, (_, i) => leftSibling + i);
  return [1, 'ellipsis-left', ...middle, 'ellipsis-right', totalPages];
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const items = getPageItems(currentPage, totalPages);
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
      className={`flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 ${className}`}
    >
      <button
        type="button"
        onClick={() => handleClick(currentPage - 1)}
        disabled={isFirst}
        className="rounded-full border border-primary-200 px-3 py-1.5 text-sm text-primary-600 transition-all hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
      >
        이전
      </button>
      {items.map((item, idx) => {
        if (item === 'ellipsis-left' || item === 'ellipsis-right') {
          return (
            <span
              key={`${item}-${idx}`}
              className="min-w-[36px] px-2 py-1.5 text-center text-sm text-primary-300"
              aria-hidden="true"
            >
              ⋯
            </span>
          );
        }
        return (
          <button
            key={item}
            type="button"
            onClick={() => handleClick(item)}
            aria-current={item === currentPage ? 'page' : undefined}
            className={`min-w-[36px] rounded-full border px-3 py-1.5 text-sm transition-all ${
              item === currentPage
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-primary-200 text-primary-600 hover:bg-primary-50'
            }`}
          >
            {item}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => handleClick(currentPage + 1)}
        disabled={isLast}
        className="rounded-full border border-primary-200 px-3 py-1.5 text-sm text-primary-600 transition-all hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
      >
        다음
      </button>
    </nav>
  );
}
