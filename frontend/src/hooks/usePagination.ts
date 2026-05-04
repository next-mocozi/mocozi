'use client';

import { useEffect, useState } from 'react';

export type UsePaginationOptions = {
  totalItems: number;
  pageSize: number;
  initialPage?: number;
};

export type UsePaginationResult = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  setPage: (page: number) => void;
  goPrev: () => void;
  goNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  startIndex: number;
  endIndex: number;
};

export function usePagination({
  totalItems,
  pageSize,
  initialPage = 1,
}: UsePaginationOptions): UsePaginationResult {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const setPage = (page: number) => {
    const clamped = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(clamped);
  };

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    currentPage,
    totalPages,
    pageSize,
    setPage,
    goPrev: () => setPage(currentPage - 1),
    goNext: () => setPage(currentPage + 1),
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    startIndex,
    endIndex,
  };
}
